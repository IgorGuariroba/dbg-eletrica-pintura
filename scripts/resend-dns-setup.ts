/**
 * Configura o domínio de envio da Resend criando os registros DNS na Cloudflare.
 *
 * O que o script faz (idempotente — pode rodar várias vezes sem duplicar):
 *   1. Resend: acha o domínio (ou cria) e lê os registros DNS exigidos (SPF/DKIM/DMARC/MX).
 *   2. Cloudflare: cria ou atualiza cada registro na zona (sempre DNS-only, sem proxy).
 *   3. Resend: dispara o verify e imprime o status de cada registro.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CONTEXTO — por que isto existe
 *   Resend só entrega e-mail a clientes reais a partir de um DOMÍNIO VERIFICADO.
 *   O sender de teste `onboarding@resend.dev` só entrega para o dono da conta.
 *   Domínio escolhido: dbgservicos.eu.org (grátis via eu.org + DNS grátis na Cloudflare).
 *
 * PRÉ-REQUISITOS DE INFRA (feito uma vez, fora deste script):
 *   a) Cloudflare: "Add a domain" -> dbgservicos.eu.org (plano Free). Anote os 2 nameservers.
 *   b) eu.org (nic.eu.org): New domain request com esses 2 nameservers. Aguardar APROVAÇÃO
 *      MANUAL (dias). Quando aprovar, a zona na Cloudflare fica "Active".
 *
 * QUANDO A ZONA ESTIVER "ACTIVE" — passos para rodar este script:
 *   1. Resend API key FULL ACCESS (https://resend.com/api-keys -> permissão Full).
 *      A key send-only atual NÃO lista/cria domínios. (Alternativa: adicionar o domínio
 *      no painel https://resend.com/domains à mão; o script então só sincroniza a Cloudflare.)
 *   2. Cloudflare API token: https://dash.cloudflare.com/profile/api-tokens
 *      -> template "Edit zone DNS" -> zona dbgservicos.eu.org.
 *   3. Cloudflare Zone ID: painel da zona > Overview > coluna direita "API".
 *   4. Preencher no .env.local:
 *        RESEND_API_KEY=re_...                 (FULL access)
 *        CLOUDFLARE_API_TOKEN=...
 *        CLOUDFLARE_ZONE_ID=...
 *        RESEND_DOMINIO=dbgservicos.eu.org     (opcional; este é o default)
 *   5. Rodar:  npx tsx scripts/resend-dns-setup.ts
 *   6. DNS propaga em minutos. Rodar de novo até o status virar "verified".
 *
 * DEPOIS DE "verified":
 *   - Ajustar RESEND_FROM_EMAIL para um e-mail do domínio, ex:
 *       DBG Elétrica e Pintura <notificacoes@dbgservicos.eu.org>
 *     no .env.local E na Vercel (Production/Preview/Development).
 *   - A partir daí o e-mail chega em QUALQUER cliente (fecha o critério DKIM/SPF da issue #31).
 *
 * SEGURANÇA: o CLOUDFLARE_API_TOKEN é credencial sensível. Escope só "DNS edit" desta
 *   zona e revogue depois se não for reutilizar. Nunca commitar .env.local.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Uso:
 *   npx tsx scripts/resend-dns-setup.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const RESEND_API = "https://api.resend.com";
const CF_API = "https://api.cloudflare.com/client/v4";

const RESEND_KEY = req("RESEND_API_KEY");
const CF_TOKEN = req("CLOUDFLARE_API_TOKEN");
const ZONE_ID = req("CLOUDFLARE_ZONE_ID");
const DOMINIO = process.env.RESEND_DOMINIO || "dbgservicos.eu.org";

function req(nome: string): string {
  const v = process.env[nome];
  if (!v) {
    console.error(`✖ Falta a variável ${nome} no .env.local`);
    process.exit(1);
  }
  return v;
}

// ---- Tipos mínimos das APIs ----
interface ResendRecord {
  record: string; // "SPF" | "DKIM" | "DMARC" | ...
  name: string; // host (pode ser relativo, "@", ou FQDN)
  type: string; // "MX" | "TXT" | "CNAME"
  value: string;
  ttl?: string | number;
  priority?: number;
  status?: string;
}
interface ResendDomain {
  id: string;
  name: string;
  status: string;
  records?: ResendRecord[];
}

async function resend<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RESEND_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend ${path} -> ${res.status}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

async function cloudflare<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CF_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || (body && body.success === false)) {
    throw new Error(`Cloudflare ${path} -> ${res.status}: ${JSON.stringify(body.errors || body)}`);
  }
  return body as T;
}

/** Garante o FQDN do registro (Resend às vezes manda host relativo ou "@"). */
function fqdn(name: string): string {
  if (!name || name === "@" || name === DOMINIO) return DOMINIO;
  if (name.endsWith(`.${DOMINIO}`) || name === DOMINIO) return name;
  return `${name}.${DOMINIO}`;
}

async function acharOuCriarDominio(): Promise<ResendDomain> {
  const lista = await resend<{ data: ResendDomain[] }>("/domains");
  const existente = lista.data?.find((d) => d.name === DOMINIO);
  if (existente) {
    console.log(`• Domínio já existe na Resend: ${DOMINIO} (status: ${existente.status})`);
    return resend<ResendDomain>(`/domains/${existente.id}`);
  }
  console.log(`• Criando domínio na Resend: ${DOMINIO}`);
  return resend<ResendDomain>("/domains", {
    method: "POST",
    body: JSON.stringify({ name: DOMINIO }),
  });
}

async function upsertCloudflare(rec: ResendRecord): Promise<void> {
  const name = fqdn(rec.name);
  const type = rec.type.toUpperCase();
  const content = rec.value;

  // procura registro existente de mesmo type+name
  const q = new URLSearchParams({ type, name }).toString();
  const atual = await cloudflare<{ result: Array<{ id: string; content: string }> }>(
    `/zones/${ZONE_ID}/dns_records?${q}`,
  );

  const payload: Record<string, unknown> = {
    type,
    name,
    content,
    ttl: 1, // auto
    proxied: false, // MX/TXT/DKIM nunca proxied
  };
  if (type === "MX") payload.priority = rec.priority ?? 10;

  if (atual.result.length > 0) {
    const id = atual.result[0].id;
    await cloudflare(`/zones/${ZONE_ID}/dns_records/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    console.log(`  ↻ atualizado  ${type.padEnd(5)} ${name} -> ${content.slice(0, 50)}${content.length > 50 ? "…" : ""}`);
  } else {
    await cloudflare(`/zones/${ZONE_ID}/dns_records`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    console.log(`  ＋ criado     ${type.padEnd(5)} ${name} -> ${content.slice(0, 50)}${content.length > 50 ? "…" : ""}`);
  }
}

async function main() {
  console.log(`\n=== Resend ↔ Cloudflare DNS setup ===`);
  console.log(`Domínio: ${DOMINIO}\nZona CF: ${ZONE_ID}\n`);

  const dominio = await acharOuCriarDominio();
  const registros = dominio.records ?? [];
  if (registros.length === 0) {
    throw new Error("Resend não retornou registros DNS para o domínio.");
  }

  console.log(`\n• Aplicando ${registros.length} registro(s) na Cloudflare:`);
  for (const rec of registros) {
    await upsertCloudflare(rec);
  }

  console.log(`\n• Disparando verify na Resend…`);
  await resend(`/domains/${dominio.id}/verify`, { method: "POST" });

  // re-lê status
  const atualizado = await resend<ResendDomain>(`/domains/${dominio.id}`);
  console.log(`\n• Status do domínio: ${atualizado.status}`);
  for (const r of atualizado.records ?? []) {
    console.log(`   - ${r.record.padEnd(6)} ${r.type.padEnd(5)} ${fqdn(r.name).padEnd(40)} ${r.status ?? "?"}`);
  }

  console.log(
    `\n✔ Pronto. DNS pode levar minutos a propagar. Rode de novo este script para re-verificar` +
      ` até o status virar "verified". Depois, ajuste RESEND_FROM_EMAIL para um e-mail @${DOMINIO}.\n`,
  );
}

main().catch((e) => {
  console.error("\n✖ FALHA:", e.message);
  process.exit(1);
});
