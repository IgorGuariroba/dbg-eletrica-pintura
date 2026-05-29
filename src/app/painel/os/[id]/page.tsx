import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cliente, ordemServico, solicitacao } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { exigirFila } from "../../guard";

const LABEL_CATEGORIA: Record<string, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

const ESTADO_LABEL: Record<string, string> = {
  NOVA: "Nova",
  ORCADA: "Orçada — aguardando o cliente",
  APROVADA: "Aprovada",
  REJEITADA: "Recusada",
  EXPIRADA: "Expirada",
};

async function origem(): Promise<string> {
  // URL canônica do site é a fonte da verdade — o header Host é influenciável
  // pelo cliente e geraria um link de aprovação apontando para outro domínio.
  const canonica = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.AUTH_URL;
  if (canonica) return canonica.replace(/\/$/, "");
  // Fallback confiável na Vercel: domínio de produção injetado pela plataforma
  // (estável, não vem do request) — cobre preview e prod sem env manual.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  // Em produção sem nenhuma origem confiável, falha em vez de usar o header
  // Host (vetor de phishing).
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Defina NEXT_PUBLIC_SITE_URL/AUTH_URL para gerar o link de aprovação",
    );
  }
  // Fora de produção, deriva do request para conveniência de dev.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export default async function OsDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { usuario } = await exigirFila();

  const [os] = await db
    .select({
      id: ordemServico.id,
      estado: ordemServico.estado,
      categoria: ordemServico.categoria,
      tecnicoId: ordemServico.tecnicoId,
      token: solicitacao.token,
      clienteNome: cliente.nome,
      clienteWhatsapp: cliente.whatsapp,
    })
    .from(ordemServico)
    .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
    .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
    .where(eq(ordemServico.id, id))
    .limit(1);

  // Só o técnico atribuído (ou painel completo) acessa o detalhe.
  const podeVer =
    os &&
    (usuario.role === "admin_raiz" ||
      usuario.modulos.includes("OPERACAO") ||
      (Boolean(usuario.membroId) && os.tecnicoId === usuario.membroId));
  if (!os || !podeVer) redirect("/painel/fila");

  const link = `${await origem()}/s/${os.token}`;
  const protocolo = os.token.slice(0, 8).toUpperCase();
  const numero = os.clienteWhatsapp.replace(/\D/g, "");
  const mensagem =
    `Olá, ${os.clienteNome.split(" ")[0]}! Seu orçamento da DBG ` +
    `(#${protocolo}) está pronto. Veja e aprove por aqui: ${link}`;
  const waUrl = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          OS · {LABEL_CATEGORIA[os.categoria] ?? os.categoria}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{os.clienteNome}</p>
      </div>

      <div className="rounded-lg border bg-background p-5">
        <Badge variant={os.estado === "ORCADA" ? "default" : "outline"}>
          {ESTADO_LABEL[os.estado] ?? os.estado}
        </Badge>

        {os.estado === "NOVA" && (
          <div className="mt-4">
            <Link
              href={`/painel/os/${os.id}/orcamento` as Route}
              className={buttonVariants()}
            >
              Montar orçamento
            </Link>
          </div>
        )}

        {os.estado === "ORCADA" && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Envie o link de aprovação ao cliente pelo WhatsApp.
            </p>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants()}
            >
              Enviar ao cliente
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
