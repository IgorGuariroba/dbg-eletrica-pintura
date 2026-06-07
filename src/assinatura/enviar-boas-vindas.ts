import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { assinatura, cliente, plano } from "@/db/schema";
import {
  criarEmailService,
  renderizarEmailBoasVindas,
} from "@/notificacao/email-service";
import { criarGatewayMercadoPagoAssinatura } from "./mercadopago-assinatura";

export interface EnviarBoasVindasConfig {
  /** Força o mock do Resend (testes/local). */
  forceMock?: boolean;
  /** Resolve a data da próxima cobrança (default: gateway MP). */
  obterProximaCobranca?: (preapprovalIdMp: string) => Promise<string | undefined>;
}

/** Quebra o texto de benefícios (uma linha cada) em itens não-vazios. */
function parseBeneficios(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/**
 * Envia o e-mail de boas-vindas da assinatura (Issue #56). Carrega cliente +
 * plano pela `preapproval_id`, resolve a próxima cobrança e dispara via Resend.
 * Cliente sem e-mail → pula sem lançar (mesmo contrato do notificador de OS).
 */
export async function enviarBoasVindas(
  preapprovalIdMp: string,
  config: EnviarBoasVindasConfig = {},
): Promise<{ status: "sent" | "skipped"; motivo?: string }> {
  const [row] = await db
    .select({
      clienteNome: cliente.nome,
      clienteEmail: cliente.email,
      planoNome: plano.nome,
      beneficios: plano.beneficios,
    })
    .from(assinatura)
    .innerJoin(cliente, eq(assinatura.clienteId, cliente.id))
    .innerJoin(plano, eq(assinatura.planoId, plano.id))
    .where(eq(assinatura.preapprovalIdMp, preapprovalIdMp))
    .limit(1);

  if (!row) return { status: "skipped", motivo: "assinatura não encontrada" };
  if (!row.clienteEmail) {
    console.log(
      `[boas-vindas] skipped: cliente ${row.clienteNome} sem e-mail cadastrado.`,
    );
    return { status: "skipped", motivo: "cliente sem e-mail" };
  }

  const obterProximaCobranca =
    config.obterProximaCobranca ??
    (async (id) => {
      const recurso = await criarGatewayMercadoPagoAssinatura().buscarAssinatura(
        id,
      );
      return recurso.nextPaymentDate;
    });
  const proximaIso = await obterProximaCobranca(preapprovalIdMp);
  const proximaCobranca = proximaIso
    ? new Date(proximaIso).toLocaleDateString("pt-BR")
    : "a confirmar";

  const html = await renderizarEmailBoasVindas({
    clienteNome: row.clienteNome,
    planoNome: row.planoNome,
    beneficios: parseBeneficios(row.beneficios),
    proximaCobranca,
  });

  const emailService = criarEmailService({ forceMock: config.forceMock });
  await emailService.enviar({
    para: row.clienteEmail,
    assunto: `Bem-vindo(a) ao plano ${row.planoNome} — DBG Elétrica e Pintura`,
    html,
  });

  return { status: "sent" };
}
