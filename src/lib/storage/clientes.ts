import { S3Client } from "@aws-sdk/client-s3";

// Clientes S3 únicos e lazy do módulo Storage — credenciais lidas num lugar
// só. Privado: fotos de OS, assinaturas, PDFs, fotos de garantia/solicitação.
// Público: fotos do catálogo e do portfólio (servidas por R2_PUBLIC_BASE_URL).

let privadoCache: { client: S3Client; bucket: string } | null = null;
let publicoCache: { client: S3Client; bucket: string } | null = null;

// Resiliência a erro transiente do R2 (throttle/5xx/reset). Sob concorrência
// (ex.: suíte de integração inteira), um round-trip pode falhar e — como o
// despacho de notificação engole o erro (fire-and-forget) — o e-mail de
// conclusão + PDF some silenciosamente. `adaptive` adiciona rate limiting
// client-side que recua diante de throttling; mais tentativas cobrem o pico.
const RETRY_R2 = { maxAttempts: 5, retryMode: "adaptive" as const };

function r2PrivadoConfigurado(): boolean {
  return Boolean(
    process.env.R2_PRIVATE_ACCOUNT_ID &&
      process.env.R2_PRIVATE_ACCESS_KEY_ID &&
      process.env.R2_PRIVATE_SECRET_ACCESS_KEY &&
      process.env.R2_PRIVATE_BUCKET,
  );
}

/**
 * Storage degrada pra mock quando o R2 privado não está configurado — mesma
 * postura do e-mail (`criarEmailService`: sem RESEND_API_KEY → mock), para o
 * CI custo-zero (ADR 0003) exercitar o wiring de notificação/documentos sem
 * credenciais externas. Guardrail no estilo do dev-bypass: em produção a falta
 * de R2 ainda LANÇA (fail-loud em `clientePrivado`), nunca mocka silenciosamente.
 */
export function usarMockPrivado(): boolean {
  return !r2PrivadoConfigurado() && process.env.NODE_ENV !== "production";
}

export function clientePrivado(): { client: S3Client; bucket: string } {
  if (privadoCache) return privadoCache;
  const accountId = process.env.R2_PRIVATE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_PRIVATE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_PRIVATE_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_PRIVATE_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 privado não configurado (verifique R2_PRIVATE_*)");
  }
  privadoCache = {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      ...RETRY_R2,
    }),
    bucket,
  };
  return privadoCache;
}

export function clientePublico(): { client: S3Client; bucket: string } {
  if (publicoCache) return publicoCache;
  const accountId = process.env.R2_PUBLIC_ACCOUNT_ID;
  const accessKeyId = process.env.R2_PUBLIC_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_PUBLIC_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_PUBLIC_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 público não configurado (verifique R2_PUBLIC_*)");
  }
  publicoCache = {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      ...RETRY_R2,
    }),
    bucket,
  };
  return publicoCache;
}
