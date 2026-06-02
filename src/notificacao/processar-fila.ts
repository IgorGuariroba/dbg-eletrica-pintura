import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { filaWhatsapp } from "@/db/schema";
import { enviarAgora } from "./enviar-template";
import {
  criarGatewayWhatsApp,
  type GatewayWhatsApp,
} from "./whatsapp-gateway";

export interface ProcessarFilaDeps {
  /** Gateway da Cloud API (default: real/mock por env). */
  gateway?: GatewayWhatsApp;
}

/**
 * Processa a Fila de Envio: drena os pendentes (gerados fora do Horário
 * Restrito), dispara cada template pela Cloud API e marca a linha como enviada.
 * Pensado para rodar às 8h. O wiring do cron fica na Fase 5 (ver doc do PR);
 * por ora a função é exposta e testável isoladamente.
 */
export async function processarFilaWhatsapp(
  deps: ProcessarFilaDeps = {},
): Promise<{ processados: number }> {
  const gateway = deps.gateway ?? criarGatewayWhatsApp();

  const pendentes = await db
    .select()
    .from(filaWhatsapp)
    .where(eq(filaWhatsapp.status, "pendente"));

  let processados = 0;
  for (const item of pendentes) {
    await enviarAgora(
      {
        destinatario: item.destinatario,
        template: item.template,
        variaveis: item.variaveis,
      },
      gateway,
    );
    await db
      .update(filaWhatsapp)
      .set({ status: "enviado", processadoEm: new Date() })
      .where(eq(filaWhatsapp.id, item.id));
    processados += 1;
  }

  return { processados };
}
