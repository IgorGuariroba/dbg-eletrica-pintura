import { and, desc, eq, inArray, isNull, notInArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import type { EmailService } from "./email-service";
import { TIPOS_PAGAVEIS } from "./tipos-pagaveis";
import { notificar } from "./notificar";
import type { GatewayWhatsApp } from "./whatsapp-gateway";

interface LembreteAvaliacaoDeps {
  /** Gateway da Cloud API (default: real/mock por env). */
  gateway?: GatewayWhatsApp;
  /** Adapter de e-mail (default: Resend/mock por env). */
  email?: EmailService;
  /** Relógio injetável (default: agora). */
  agora?: Date;
}

async function checarElegibilidadeLembrete(
  solOsList: { id: string; tipo: string; estado: string }[],
  limite48h: Date
): Promise<{ elegivel: boolean; anchorOsId: string }> {
  for (const os of solOsList) {
    const pagavel = (TIPOS_PAGAVEIS as readonly string[]).includes(os.tipo);
    const estadoAlvo = pagavel ? "PAGA" : "CONCLUIDA";
    const [trans] = await db
      .select({ em: schema.transicaoOs.em })
      .from(schema.transicaoOs)
      .where(
        and(
          eq(schema.transicaoOs.osId, os.id),
          eq(schema.transicaoOs.estadoNovo, estadoAlvo)
        )
      )
      .orderBy(desc(schema.transicaoOs.em))
      .limit(1);

    if (trans && trans.em.getTime() <= limite48h.getTime()) {
      return { elegivel: true, anchorOsId: os.id };
    }
  }
  return { elegivel: false, anchorOsId: "" };
}

/**
 * Job de Lembrete de Avaliação 48h: varre as OS no estado terminal do cliente
 * sem avaliação, agrupa por Solicitação e emite o Evento de Notificação
 * `os.lembrete_avaliacao` com a OS âncora elegível — envio, canais e
 * idempotência (Marco por Solicitação) são do contexto Notificação.
 */
export async function processarLembretesAvaliacao(
  deps: LembreteAvaliacaoDeps = {}
) {
  const agora = deps.agora ?? new Date();
  const limite48h = new Date(agora.getTime() - 48 * 60 * 60 * 1000);

  // 1. OS no estado terminal do cliente (PAGA/CONCLUIDA por tipo) e sem avaliação.
  const osCandidatas = await db
    .select({
      id: schema.ordemServico.id,
      tipo: schema.ordemServico.tipo,
      estado: schema.ordemServico.estado,
      solicitacaoId: schema.ordemServico.solicitacaoId,
    })
    .from(schema.ordemServico)
    .leftJoin(schema.avaliacao, eq(schema.ordemServico.id, schema.avaliacao.osId))
    .where(
      and(
        or(
          and(
            inArray(schema.ordemServico.tipo, [...TIPOS_PAGAVEIS]),
            eq(schema.ordemServico.estado, "PAGA")
          ),
          and(
            notInArray(schema.ordemServico.tipo, [...TIPOS_PAGAVEIS]),
            eq(schema.ordemServico.estado, "CONCLUIDA")
          )
        ),
        isNull(schema.avaliacao.id)
      )
    );

  if (osCandidatas.length === 0) {
    return { enviados: 0 };
  }

  let enviados = 0;

  // Agrupa as candidatas por Solicitação (1 lembrete por Solicitação).
  const solIds = [...new Set(osCandidatas.map(o => o.solicitacaoId))];

  for (const solId of solIds) {
    // OS desta Solicitação; elegível se ao menos uma está terminal há ≥48h.
    const solOsList = osCandidatas.filter(o => o.solicitacaoId === solId);

    const { elegivel, anchorOsId } = await checarElegibilidadeLembrete(solOsList, limite48h);

    if (!elegivel) continue;

    const resultado = await notificar(
      { tipo: "os.lembrete_avaliacao", osId: anchorOsId },
      { whatsapp: deps.gateway, email: deps.email, agora },
    );

    const whatsappSaiu =
      resultado.whatsapp?.status === "enviado" ||
      resultado.whatsapp?.status === "enfileirado";
    if (whatsappSaiu || resultado.email?.status === "sent") enviados++;
  }

  return { enviados };
}
