import { db } from "@/db/client";
import { eq, desc } from "drizzle-orm";
import {
  ordemServico,
  solicitacao,
  cliente,
  membro,
  orcamento,
  orcamentoItem,
  servico,
} from "@/db/schema";
import { gerarPdfOrcamento, gerarPdfConclusao } from "./pdf-gerador";
import { enviarPdfDocumento, obterUrlLeituraAssinada, listarFotosOs } from "@/operacao/r2-privado";
import {
  criarEmailService,
  renderizarEmailOrcamento,
  renderizarEmailConclusao,
  renderizarEmailPedidoAvaliacao,
} from "./email-service";

export interface NotificacaoResultado {
  status: "skipped" | "sent";
  motivo?: string;
  emailId?: string;
  pdfUrl?: string;
}

export async function notificarMudancaEstadoOs(
  osId: string,
  estadoNovo: string,
  config: { forceMock?: boolean } = {},
): Promise<NotificacaoResultado> {
  // Apenas e-mails para ORCADA, CONCLUIDA e PEDIDO_AVALIACAO
  if (estadoNovo !== "ORCADA" && estadoNovo !== "CONCLUIDA" && estadoNovo !== "PEDIDO_AVALIACAO") {
    return { status: "skipped", motivo: `estado ${estadoNovo} não dispara e-mail` };
  }

  // 1. Carrega OS
  const [os] = await db.select().from(ordemServico).where(eq(ordemServico.id, osId)).limit(1);
  if (!os) {
    return { status: "skipped", motivo: "OS não encontrada" };
  }

  // 2. Carrega Solicitação
  const [sol] = await db.select().from(solicitacao).where(eq(solicitacao.id, os.solicitacaoId)).limit(1);
  if (!sol) {
    return { status: "skipped", motivo: "solicitação não encontrada" };
  }

  // 3. Carrega Cliente
  const [cli] = await db.select().from(cliente).where(eq(cliente.id, sol.clienteId)).limit(1);
  if (!cli) {
    return { status: "skipped", motivo: "cliente não encontrado" };
  }

  // 4. Se cliente não tem e-mail, log de skip, sem lançar erro
  if (!cli.email) {
    console.log(`[notificador] notificacao_skipped: cliente ${cli.nome} (${cli.whatsapp}) não possui e-mail cadastrado.`);
    return { status: "skipped", motivo: "cliente sem e-mail" };
  }

  // 5. Carrega o técnico
  let tecnicoNome = "Não atribuído";
  if (os.tecnicoId) {
    const [tec] = await db.select().from(membro).where(eq(membro.id, os.tecnicoId)).limit(1);
    if (tec) {
      tecnicoNome = tec.nome;
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const urlPortal = `${siteUrl}/s/${sol.token}`;
  const emailService = criarEmailService(config);

  // ============================================================
  // Caso ORCADA
  // ============================================================
  if (estadoNovo === "ORCADA") {
    const [orc] = await db
      .select()
      .from(orcamento)
      .where(eq(orcamento.osId, osId))
      .orderBy(desc(orcamento.criadoEm))
      .limit(1);

    if (!orc) {
      return { status: "skipped", motivo: "orçamento não encontrado para a OS" };
    }

    const itensComServico = await db
      .select({
        quantidade: orcamentoItem.quantidade,
        precoUnitario: orcamentoItem.precoUnitario,
        subtotal: orcamentoItem.subtotal,
        nomeServico: servico.nome,
      })
      .from(orcamentoItem)
      .innerJoin(servico, eq(orcamentoItem.servicoId, servico.id))
      .where(eq(orcamentoItem.orcamentoId, orc.id));

    const dadosPdf = {
      numeroOS: osId.slice(0, 8).toUpperCase(),
      clienteNome: cli.nome,
      clienteWhatsapp: cli.whatsapp,
      endereco: `${sol.endereco.logradouro}, ${sol.endereco.numero || "S/N"} - ${sol.endereco.bairro || ""}, ${sol.endereco.cidade} - ${sol.endereco.uf}`,
      tecnicoNome,
      validade: new Date(orc.validoAte).toLocaleDateString("pt-BR"),
      itens: itensComServico.map((item) => ({
        descricao: item.nomeServico,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        subtotal: item.subtotal,
      })),
      totalMaoDeObra: orc.totalMaoDeObra,
      totalDeslocamento: orc.totalDeslocamento,
      total: orc.total,
    };

    const pdfBuffer = await gerarPdfOrcamento(dadosPdf);
    const key = `orcamentos/os-${osId}-${Date.now()}.pdf`;
    
    await enviarPdfDocumento(key, pdfBuffer);
    const pdfUrl = await obterUrlLeituraAssinada(key);

    const html = await renderizarEmailOrcamento({
      clienteNome: cli.nome,
      numeroOS: osId.slice(0, 8).toUpperCase(),
      total: orc.total,
      urlPortal,
    });

    const res = await emailService.enviar({
      para: cli.email,
      assunto: `Orçamento Disponível - OS ${osId.slice(0, 8).toUpperCase()}`,
      html,
      anexos: [
        {
          filename: `orcamento_${osId.slice(0, 8).toUpperCase()}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    return {
      status: "sent",
      emailId: res?.id,
      pdfUrl,
    };
  }

  // ============================================================
  // Caso PEDIDO_AVALIACAO
  // ============================================================
  if (estadoNovo === "PEDIDO_AVALIACAO") {
    const html = await renderizarEmailPedidoAvaliacao({
      clienteNome: cli.nome,
      urlPortal,
    });

    const res = await emailService.enviar({
      para: cli.email,
      assunto: `Como foi o nosso atendimento? - DBG Elétrica e Pintura`,
      html,
    });

    return {
      status: "sent",
      emailId: res?.id,
    };
  }

  // ============================================================
  // Caso CONCLUIDA
  // ============================================================
  if (estadoNovo === "CONCLUIDA") {
    // Carrega assinatura presencial se houver
    const orcamentoAssinatura = await db
      .select({
        assinaturaUrl: orcamento.assinaturaUrl,
      })
      .from(orcamento)
      .where(eq(orcamento.osId, osId))
      .orderBy(desc(orcamento.criadoEm))
      .limit(1);

    let assinaturaUrl: string | undefined = undefined;
    if (orcamentoAssinatura[0]?.assinaturaUrl) {
      try {
        assinaturaUrl = await obterUrlLeituraAssinada(orcamentoAssinatura[0].assinaturaUrl);
      } catch (e) {
        console.error("Erro ao assinar URL de assinatura:", e);
      }
    }

    // Carrega materiais e observações dos metadados da OS
    const metadados = (os.metadados as any) || {};
    const materiais = (metadados.materiais || []).map((m: any) => ({
      item: m.item,
      quantidade: Number(m.quantidade),
    }));
    const observacoes = metadados.notaServico || "Serviço executado com sucesso.";

    // Busca e assina as fotos de execução (antes/depois) salvadas no R2
    const fotosAntesChaves = await listarFotosOs(osId, "ANTES");
    const fotosDepoisChaves = await listarFotosOs(osId, "DEPOIS");

    const fotosAntes = await Promise.all(
      fotosAntesChaves.slice(0, 4).map((k) => obterUrlLeituraAssinada(k, 3600))
    );
    const fotosDepois = await Promise.all(
      fotosDepoisChaves.slice(0, 4).map((k) => obterUrlLeituraAssinada(k, 3600))
    );

    const dadosPdf = {
      numeroOS: osId.slice(0, 8).toUpperCase(),
      clienteNome: cli.nome,
      clienteWhatsapp: cli.whatsapp,
      endereco: `${sol.endereco.logradouro}, ${sol.endereco.numero || "S/N"} - ${sol.endereco.bairro || ""}, ${sol.endereco.cidade} - ${sol.endereco.uf}`,
      tecnicoNome,
      concluidoEm: new Date(os.atualizadoEm || new Date()).toLocaleString("pt-BR"),
      observacoes,
      materiais,
      assinaturaUrl,
      fotosAntes,
      fotosDepois,
    };

    const pdfBuffer = await gerarPdfConclusao(dadosPdf);
    const key = `conclusoes/os-${osId}-${Date.now()}.pdf`;
    
    await enviarPdfDocumento(key, pdfBuffer);
    const pdfUrl = await obterUrlLeituraAssinada(key);

    const html = await renderizarEmailConclusao({
      clienteNome: cli.nome,
      numeroOS: osId.slice(0, 8).toUpperCase(),
      urlPortal,
    });

    const res = await emailService.enviar({
      para: cli.email,
      assunto: `Serviço Concluído - OS ${osId.slice(0, 8).toUpperCase()}`,
      html,
      anexos: [
        {
          filename: `relatorio_conclusao_${osId.slice(0, 8).toUpperCase()}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    return {
      status: "sent",
      emailId: res?.id,
      pdfUrl,
    };
  }

  return { status: "skipped", motivo: "estado desconhecido" };
}
