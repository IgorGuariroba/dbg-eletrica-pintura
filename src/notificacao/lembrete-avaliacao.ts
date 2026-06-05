import { and, eq, inArray, notInArray, isNull, or, desc } from "drizzle-orm";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { normalizarWhatsapp, ordenarVariaveis } from "./templates";
import { whatsappConfigurado } from "./whatsapp-gateway";
import { notificarMudancaEstadoOs } from "./notificador";
import { TIPOS_PAGAVEIS } from "./lembrete-pagamento";

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

async function dispararCanaisLembrete(
  cli: typeof schema.cliente.$inferSelect,
  token: string,
  anchorOsId: string,
  deps: {
    gateway?: any;
    enviarEmail?: (osId: string, estado: string) => Promise<any>;
    agora?: Date;
  }
): Promise<boolean> {
  const agora = deps.agora ?? new Date();
  let algumCanal = false;

  // WhatsApp
  const destinatario = normalizarWhatsapp(cli.whatsapp);
  if (destinatario && (deps.gateway || whatsappConfigurado())) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const link = `${siteUrl}/s/${token}/avaliar`;
    const repo = await import("./templates").then(m => m.criarTemplateRepo());
    const padrao = await repo.obterVariaveis("pedido_avaliacao");
    const variaveis = ordenarVariaveis("pedido_avaliacao", {
      ...padrao,
      nome_cliente: cli.nome,
      link,
    });

    const wppRes = await import("./enviar-template").then(m =>
      m.enviarTemplate(
        { destinatario, template: "pedido_avaliacao", variaveis },
        { gateway: deps.gateway, agora }
      )
    );
    if (wppRes.status === "enviado") {
      algumCanal = true;
    }
  }

  // E-mail
  if (cli.email) {
    const enviarEmail = deps.enviarEmail ?? ((id, est) => notificarMudancaEstadoOs(id, est));
    await enviarEmail(anchorOsId, "PEDIDO_AVALIACAO");
    algumCanal = true;
  }

  return algumCanal;
}

export async function processarLembretesAvaliacao(
  deps: {
    gateway?: any;
    enviarEmail?: (osId: string, estado: string) => Promise<any>;
    agora?: Date;
  } = {}
) {
  const agora = deps.agora ?? new Date();
  const limite48h = new Date(agora.getTime() - 48 * 60 * 60 * 1000);

  // 1. Get all OSs that are terminal and have no evaluations
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

  // Group candidates by solicitation
  const solIds = [...new Set(osCandidatas.map(o => o.solicitacaoId))];

  for (const solId of solIds) {
    // Check if the solicitation has already sent the reminder
    const [solInfo] = await db
      .select({
        id: schema.solicitacao.id,
        token: schema.solicitacao.token,
        lembreteAvaliacaoEnviado: schema.solicitacao.lembreteAvaliacaoEnviado,
        clienteId: schema.solicitacao.clienteId,
      })
      .from(schema.solicitacao)
      .where(eq(schema.solicitacao.id, solId))
      .limit(1);

    if (!solInfo || solInfo.lembreteAvaliacaoEnviado) continue;

    // Get the OSs for this solicitation
    const solOsList = osCandidatas.filter(o => o.solicitacaoId === solId);
    
    // Check the latest transition date among these OSs to ensure at least one has been terminal for >=48h
    const { elegivel, anchorOsId } = await checarElegibilidadeLembrete(solOsList, limite48h);

    if (!elegivel) continue;

    // 2. Claim atomically
    const claim = await db
      .update(schema.solicitacao)
      .set({ lembreteAvaliacaoEnviado: true })
      .where(
        and(
          eq(schema.solicitacao.id, solId),
          eq(schema.solicitacao.lembreteAvaliacaoEnviado, false)
        )
      )
      .returning({ id: schema.solicitacao.id });

    if (claim.length === 0) continue;

    // Get client details
    const [cli] = await db
      .select()
      .from(schema.cliente)
      .where(eq(schema.cliente.id, solInfo.clienteId))
      .limit(1);
    
    if (!cli) continue;

    const enviado = await dispararCanaisLembrete(cli, solInfo.token, anchorOsId, deps);

    if (enviado) {
      enviados++;
    }
  }

  return { enviados };
}

