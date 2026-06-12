import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { ordemServico, transicaoOs } from "@/db/schema";
import type { EmailService } from "./email-service";
import { notificar } from "./notificar";
import type { GatewayWhatsApp } from "./whatsapp-gateway";

export const TIPOS_PAGAVEIS = ["NORMAL", "EXPRESS", "COMPLEMENTAR"] as const;

const HORAS_DIA1 = 24;
const HORAS_DIA3 = 72;

export interface ProcessarLembretesDeps {
  /** Gateway da Cloud API (default: real/mock por env). */
  gateway?: GatewayWhatsApp;
  /** Adapter de e-mail (default: Resend/mock por env). */
  email?: EmailService;
  /** Relógio injetável (default: agora). */
  agora?: Date;
}

export interface ProcessarLembretesResultado {
  enviados: number;
}

/**
 * Job diário de Lembrete de Pagamento: varre as OS CONCLUÍDA sem PAGA, de tipo
 * pagável, decide a banda pela idade da conclusão (dia1 ≥24h, dia3 ≥72h) e
 * emite o Evento de Notificação `os.lembrete_pagamento` por item — o envio
 * (canais, idempotência via Marco) é do contexto Notificação, não do job.
 */
export async function processarLembretesPagamento(
  deps: ProcessarLembretesDeps = {},
): Promise<ProcessarLembretesResultado> {
  const agora = deps.agora ?? new Date();

  // Candidatas: CONCLUÍDA (logo, ainda não PAGA) e de tipo que cobra pagamento.
  const candidatas = await db
    .select()
    .from(ordemServico)
    .where(
      and(
        eq(ordemServico.estado, "CONCLUIDA"),
        inArray(ordemServico.tipo, [...TIPOS_PAGAVEIS]),
      ),
    );

  let enviados = 0;

  for (const os of candidatas) {
    const banda = bandaAplicavel(await concluidaEm(os.id), agora);
    if (!banda) continue;

    const resultado = await notificar(
      { tipo: "os.lembrete_pagamento", osId: os.id, banda },
      { whatsapp: deps.gateway, email: deps.email, agora },
    );

    const whatsappSaiu =
      resultado.whatsapp?.status === "enviado" ||
      resultado.whatsapp?.status === "enfileirado";
    if (whatsappSaiu || resultado.email?.status === "sent") enviados += 1;
  }

  return { enviados };
}

/** Timestamp em que a OS entrou em CONCLUÍDA (transição mais recente), ou null. */
async function concluidaEm(osId: string): Promise<Date | null> {
  const [t] = await db
    .select({ em: transicaoOs.em })
    .from(transicaoOs)
    .where(and(eq(transicaoOs.osId, osId), eq(transicaoOs.estadoNovo, "CONCLUIDA")))
    .orderBy(desc(transicaoOs.em))
    .limit(1);
  return t?.em ?? null;
}

/** Banda aplicável pela idade da conclusão (banda única por execução). */
function bandaAplicavel(
  concluida: Date | null,
  agora: Date,
): "dia1" | "dia3" | null {
  if (!concluida) return null;
  const horas = (agora.getTime() - concluida.getTime()) / 3_600_000;
  if (horas >= HORAS_DIA3) return "dia3";
  if (horas >= HORAS_DIA1) return "dia1";
  return null;
}
