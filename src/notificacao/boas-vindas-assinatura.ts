import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { assinatura, cliente, plano } from "@/db/schema";
import type { GatewayAssinatura } from "@/assinatura/gateway";
import { criarGatewayMercadoPagoAssinatura } from "@/lib/mercadopago";
import {
  criarEmailService,
  renderizarEmailBoasVindas,
  type EmailService,
} from "./email-service";
import { claimMarco } from "./marco";
import type { NotificacaoResultado } from "./notificador";

/** Adapter MP necessário para resolver a próxima cobrança (variante normal). */
export type ConsultaAssinaturaMp = Pick<GatewayAssinatura, "buscarAssinatura">;

interface DadosBoasVindas {
  assinaturaId: string;
  clienteNome: string;
  clienteEmail: string | null;
  planoNome: string;
  beneficios: string | null;
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
 * Boas-vindas de assinatura (eventos `assinatura.criada` e `criada_combo`):
 * carrega cliente+plano (por preapproval ou id local), resolve a próxima
 * cobrança (gateway MP na variante normal; "a confirmar" no combo, que não
 * tem pre-approval — #65) e envia via Resend. Idempotência via Marco de
 * Notificação (assinaturaId, boas_vindas). Cliente sem e-mail → skip logado.
 */
export async function notificarBoasVindasAssinatura(
  evento:
    | { tipo: "assinatura.criada"; preapprovalIdMp: string }
    | { tipo: "assinatura.criada_combo"; assinaturaId: string },
  deps: { email?: EmailService; mpAssinatura?: ConsultaAssinaturaMp } = {},
): Promise<NotificacaoResultado> {
  const row =
    evento.tipo === "assinatura.criada"
      ? await carregarPorPreapproval(evento.preapprovalIdMp)
      : await carregarPorId(evento.assinaturaId);

  if (!row) return { status: "skipped", motivo: "assinatura não encontrada" };
  if (!row.clienteEmail) {
    console.log(
      `[boas-vindas] skipped: cliente ${row.clienteNome} sem e-mail cadastrado.`,
    );
    return { status: "skipped", motivo: "cliente sem e-mail" };
  }

  // Reivindica o marco ANTES de enviar: reexecução do webhook/fluxo não reenvia.
  if (!(await claimMarco(row.assinaturaId, "boas_vindas"))) {
    return { status: "skipped", motivo: "boas-vindas já enviadas (marco)" };
  }

  let proximaCobranca = "a confirmar";
  if (evento.tipo === "assinatura.criada") {
    const mp = deps.mpAssinatura ?? criarGatewayMercadoPagoAssinatura();
    const recurso = await mp.buscarAssinatura(evento.preapprovalIdMp);
    if (recurso.nextPaymentDate) {
      proximaCobranca = new Date(recurso.nextPaymentDate).toLocaleDateString(
        "pt-BR",
      );
    }
  }

  const html = await renderizarEmailBoasVindas({
    clienteNome: row.clienteNome,
    planoNome: row.planoNome,
    beneficios: parseBeneficios(row.beneficios),
    proximaCobranca,
  });

  const emailService = deps.email ?? criarEmailService();
  const res = await emailService.enviar({
    para: row.clienteEmail,
    assunto: `Bem-vindo(a) ao plano ${row.planoNome} — DBG Elétrica e Pintura`,
    html,
  });

  return { status: "sent", emailId: res?.id };
}

async function carregarPorPreapproval(
  preapprovalIdMp: string,
): Promise<DadosBoasVindas | undefined> {
  const [row] = await db
    .select({
      assinaturaId: assinatura.id,
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
  return row;
}

async function carregarPorId(
  assinaturaId: string,
): Promise<DadosBoasVindas | undefined> {
  const [row] = await db
    .select({
      assinaturaId: assinatura.id,
      clienteNome: cliente.nome,
      clienteEmail: cliente.email,
      planoNome: plano.nome,
      beneficios: plano.beneficios,
    })
    .from(assinatura)
    .innerJoin(cliente, eq(assinatura.clienteId, cliente.id))
    .innerJoin(plano, eq(assinatura.planoId, plano.id))
    .where(eq(assinatura.id, assinaturaId))
    .limit(1);
  return row;
}
