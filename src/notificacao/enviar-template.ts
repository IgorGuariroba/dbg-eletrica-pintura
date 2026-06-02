import { db } from "@/db/client";
import { filaWhatsapp, notificacaoWhatsapp } from "@/db/schema";
import { dentroHorarioRestrito } from "./horario-restrito";
import {
  criarGatewayWhatsApp,
  type GatewayWhatsApp,
} from "./whatsapp-gateway";

export interface EnviarTemplateInput {
  /** WhatsApp do destinatário em E.164 sem `+`. */
  destinatario: string;
  /** Nome do template aprovado na Meta. */
  template: string;
  /** Variáveis do corpo do template. */
  variaveis: Record<string, string>;
  /**
   * `emergencia_premium` bypassa Horário Restrito e Fila, e desvia o envio para
   * o admin (alerta) — nunca para o cliente. Default: `normal`.
   */
  prioridade?: "normal" | "emergencia_premium";
}

export interface EnviarTemplateDeps {
  /** Gateway da Cloud API (default: real/mock por env). */
  gateway?: GatewayWhatsApp;
  /** Relógio injetável (default: agora). Usado pela janela de horário restrito. */
  agora?: Date;
  /** WhatsApp do admin (destino do alerta de emergência). Default: env `META_ADMIN_WHATSAPP`. */
  adminWhatsapp?: string;
}

export interface EnviarTemplateResultado {
  status: "enviado" | "enfileirado";
  messageId?: string;
  registroId?: string;
}

/**
 * Dispara um template proativo pela Cloud API. Aplica as regras de Notificação:
 * emergência Premium alerta o admin imediatamente (bypassa horário e fila);
 * fora da janela 8h–20h o envio entra na Fila; dentro da janela envia e
 * registra na hora.
 */
export async function enviarTemplate(
  input: EnviarTemplateInput,
  deps: EnviarTemplateDeps = {},
): Promise<EnviarTemplateResultado> {
  const gateway = deps.gateway ?? criarGatewayWhatsApp();
  const agora = deps.agora ?? new Date();
  const emergencia = input.prioridade === "emergencia_premium";

  // Emergência Premium: alerta imediato ao admin, ignorando horário e fila. O
  // cliente nunca recebe — é para o admin reagir (ver CONTEXT.md).
  if (emergencia) {
    const destinoAdmin = deps.adminWhatsapp ?? process.env.META_ADMIN_WHATSAPP;
    if (!destinoAdmin) {
      throw new Error(
        "Emergência Premium sem destino: configure META_ADMIN_WHATSAPP",
      );
    }
    return enviarAgora({ ...input, destinatario: destinoAdmin }, gateway);
  }

  // Fora da janela 8h–20h: enfileira para o processador das 8h, sem tocar a
  // Cloud API nem criar registro de envio.
  if (!dentroHorarioRestrito(agora)) {
    const [item] = await db
      .insert(filaWhatsapp)
      .values({
        destinatario: input.destinatario,
        template: input.template,
        variaveis: input.variaveis,
        status: "pendente",
      })
      .returning({ id: filaWhatsapp.id });
    return { status: "enfileirado", registroId: item.id };
  }

  return enviarAgora(input, gateway);
}

/**
 * Envia pela Cloud API e persiste o registro de envio. Reusado pelo disparo em
 * horário, pelo bypass de emergência e pelo processador da Fila de Envio.
 */
export async function enviarAgora(
  input: EnviarTemplateInput,
  gateway: GatewayWhatsApp,
): Promise<EnviarTemplateResultado> {
  const { messageId } = await gateway.enviarTemplate({
    destinatario: input.destinatario,
    template: input.template,
    variaveis: input.variaveis,
  });

  const [registro] = await db
    .insert(notificacaoWhatsapp)
    .values({
      destinatario: input.destinatario,
      template: input.template,
      variaveis: input.variaveis,
      status: "enviado",
      messageId,
    })
    .returning({ id: notificacaoWhatsapp.id });

  return { status: "enviado", messageId, registroId: registro.id };
}
