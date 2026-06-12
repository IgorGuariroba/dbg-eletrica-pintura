import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cliente,
  orcamento,
  ordemServico,
  solicitacao,
  transicaoOs,
} from "@/db/schema";
import { criarEmailService, renderizarEmailLembretePagamento } from "./email-service";
import { enviarTemplate } from "./enviar-template";
import { claimMarco } from "./marco";
import {
  criarTemplateRepo,
  normalizarWhatsapp,
  ordenarVariaveis,
  type TemplateRepo,
} from "./templates";
import { whatsappConfigurado, type GatewayWhatsApp } from "./whatsapp-gateway";

export const TIPOS_PAGAVEIS = ["NORMAL", "EXPRESS", "COMPLEMENTAR"] as const;

const HORAS_DIA1 = 24;
const HORAS_DIA3 = 72;

export interface LembreteEmailInput {
  para: string;
  clienteNome: string;
  numeroOS: string;
  valor: string;
  link: string;
}

export interface ProcessarLembretesDeps {
  /** Gateway da Cloud API (default: real/mock por env). */
  gateway?: GatewayWhatsApp;
  /** Relógio injetável (default: agora). */
  agora?: Date;
  /** Repo de variáveis padrão dos templates (default: Drizzle). */
  templateRepo?: TemplateRepo;
  /** Envio do e-mail de lembrete (default: Resend via EmailService). */
  enviarEmail?: (input: LembreteEmailInput) => Promise<{ id: string } | null>;
  /** Força mock no e-mail default. */
  forceMock?: boolean;
}

export interface ProcessarLembretesResultado {
  enviados: number;
}

/**
 * Job diário de Lembrete de Pagamento: varre as OS CONCLUÍDA sem PAGA, de tipo
 * pagável, e dispara o lembrete por WhatsApp + e-mail conforme a idade da
 * conclusão (dia1 ≥24h, dia3 ≥72h). A idempotência vem do Marco de Notificação:
 * cada (osId, marco) é reivindicado uma única vez — reexecuções do job no mesmo
 * dia não reenviam. WhatsApp passa por `enviarTemplate` (respeita horário/fila).
 */
export async function processarLembretesPagamento(
  deps: ProcessarLembretesDeps = {},
): Promise<ProcessarLembretesResultado> {
  const agora = deps.agora ?? new Date();
  const templateRepo = deps.templateRepo ?? criarTemplateRepo();
  const padrao = await templateRepo.obterVariaveis("lembrete_pagamento");
  const enviarEmail = deps.enviarEmail ?? emailLembretePadrao(deps.forceMock);

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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  for (const os of candidatas) {
    const marco = marcoAplicavel(await concluidaEm(os.id), agora);
    if (!marco) continue;

    // Reivindica o marco ANTES de enviar: se já existe, outro disparo cobriu.
    if (!(await claimMarco(os.id, marco))) continue;

    const ctx = await carregarContexto(os.id, os.solicitacaoId);
    if (!ctx) continue;
    const { cli, token, total } = ctx;
    const link = `${siteUrl}/s/${token}`;
    const numeroOS = os.id.slice(0, 8).toUpperCase();
    let algumCanal = false;

    // WhatsApp (ação imediata). Sem gateway injetado nem Cloud API configurada,
    // pula o canal (e-mail segue).
    const destinatario = normalizarWhatsapp(cli.whatsapp);
    if (destinatario && (deps.gateway || whatsappConfigurado())) {
      await enviarTemplate(
        {
          destinatario,
          template: "lembrete_pagamento",
          // Ordem posicional fixada no catálogo — deve casar com o template Meta.
          variaveis: ordenarVariaveis("lembrete_pagamento", {
            ...padrao,
            nome_cliente: cli.nome,
            valor: Number(total).toFixed(2),
            link,
          }),
        },
        { gateway: deps.gateway, agora },
      );
      algumCanal = true;
    } else {
      console.log(
        `[lembrete] whatsapp_skipped: cliente ${cli.nome} sem WhatsApp válido (${cli.whatsapp}).`,
      );
    }

    // E-mail (documento/cobrança).
    if (cli.email) {
      await enviarEmail({
        para: cli.email,
        clienteNome: cli.nome,
        numeroOS,
        valor: Number(total).toFixed(2),
        link,
      });
      algumCanal = true;
    } else {
      console.log(`[lembrete] email_skipped: cliente ${cli.nome} sem e-mail.`);
    }

    if (algumCanal) enviados += 1;
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

/** Marco aplicável pela idade da conclusão (banda única por execução). */
function marcoAplicavel(concluida: Date | null, agora: Date): string | null {
  if (!concluida) return null;
  const horas = (agora.getTime() - concluida.getTime()) / 3_600_000;
  if (horas >= HORAS_DIA3) return "lembrete_pagamento:dia3";
  if (horas >= HORAS_DIA1) return "lembrete_pagamento:dia1";
  return null;
}

async function carregarContexto(osId: string, solicitacaoId: string) {
  const [sol] = await db
    .select({ token: solicitacao.token, clienteId: solicitacao.clienteId })
    .from(solicitacao)
    .where(eq(solicitacao.id, solicitacaoId))
    .limit(1);
  if (!sol) return null;

  const [cli] = await db
    .select()
    .from(cliente)
    .where(eq(cliente.id, sol.clienteId))
    .limit(1);
  if (!cli) return null;

  const [orc] = await db
    .select({ total: orcamento.total })
    .from(orcamento)
    .where(eq(orcamento.osId, osId))
    .orderBy(desc(orcamento.criadoEm))
    .limit(1);

  return { cli, token: sol.token, total: orc?.total ?? "0" };
}

/** EmailService default: renderiza o template e envia via Resend (ou mock). */
function emailLembretePadrao(forceMock?: boolean) {
  return async (input: LembreteEmailInput) => {
    const html = await renderizarEmailLembretePagamento({
      clienteNome: input.clienteNome,
      numeroOS: input.numeroOS,
      valor: input.valor,
      urlPortal: input.link,
    });
    return criarEmailService({ forceMock }).enviar({
      para: input.para,
      assunto: `Pagamento pendente - OS ${input.numeroOS}`,
      html,
    });
  };
}
