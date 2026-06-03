import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cliente,
  membro,
  orcamento,
  orcamentoItem,
  ordemServico,
  pagamento,
  servico,
  solicitacao,
} from "@/db/schema";
import {
  criarEmailService,
  renderizarEmailDocumentos,
  type EmailService,
} from "@/notificacao/email-service";
import type { EstadoOs } from "@/operacao/orcamento-repo";
import { montarDadosCertificado } from "./dados-certificado";
import { montarDadosFatura, numeroCurtoOs } from "./dados-fatura";
import { gerarCertificadoPdf } from "./certificado-garantia";
import { gerarFaturaPdf } from "./fatura";
import { resolverJanelaGarantia } from "./janela-garantia";
import {
  r2PrivadoPdf,
  salvarPDFR2,
  type ArmazenamentoPdf,
} from "./pdf/salvar-pdf-r2";
import { planejarDocumentos } from "./planejar-documentos";
import { chaveCertificado, chaveFatura } from "./chaves";

export interface GerarDocumentosDeps {
  /** Armazenamento de PDFs (default: R2 privado). */
  armazenamento?: ArmazenamentoPdf;
  /** Serviço de e-mail (default: Resend/mock por env). */
  email?: EmailService;
  forceMock?: boolean;
}

export interface DocumentoGerado {
  chave: string;
  url: string;
}

export interface GerarDocumentosResultado {
  fatura?: DocumentoGerado;
  certificado?: DocumentoGerado;
  email: "sent" | "skipped";
  motivo?: string;
}

/**
 * Caso de uso do #48: dada a transição de uma OS, gera os documentos aplicáveis
 * (fatura e/ou certificado de garantia), persiste no R2 em chaves determinísticas
 * e envia por e-mail (Resend) com os PDFs em anexo. Cliente sem e-mail: pula o
 * envio, os PDFs permanecem acessíveis no portal. Não lança em dados ausentes —
 * loga e retorna `skipped`.
 */
export async function gerarDocumentosOs(
  osId: string,
  estadoNovo: EstadoOs,
  deps: GerarDocumentosDeps = {},
): Promise<GerarDocumentosResultado> {
  const [os] = await db
    .select()
    .from(ordemServico)
    .where(eq(ordemServico.id, osId))
    .limit(1);
  if (!os) return skip("OS não encontrada");

  const plano = planejarDocumentos(os.tipo, estadoNovo);
  if (!plano.fatura && !plano.certificado) return skip("sem documentos");

  const [sol] = await db
    .select()
    .from(solicitacao)
    .where(eq(solicitacao.id, os.solicitacaoId))
    .limit(1);
  if (!sol) return skip("solicitação não encontrada");

  const [cli] = await db
    .select()
    .from(cliente)
    .where(eq(cliente.id, sol.clienteId))
    .limit(1);
  if (!cli) return skip("cliente não encontrado");

  const tecnicoNome = await carregarTecnicoNome(os.tecnicoId);
  const orc = await carregarOrcamento(osId);

  const armazenamento = deps.armazenamento ?? r2PrivadoPdf();
  const resultado: GerarDocumentosResultado = { email: "skipped" };
  const anexos: { filename: string; content: Buffer }[] = [];

  // Cada documento é gerado de forma independente: a falha de um (dados
  // ausentes) apenas o pula — não descarta o que já foi gerado nem aborta o
  // e-mail. Só pulamos tudo se nenhum documento sair (verificado no fim).

  // Fatura ------------------------------------------------------------------
  if (plano.fatura) {
    const pag = await carregarPagamento(osId);
    if (!pag) {
      console.warn(
        `[documentos] fatura_pulada: OS ${osId} sem pagamento approved.`,
      );
    } else {
      const buffer = await gerarFaturaPdf(
        montarDadosFatura({
          osId,
          clienteNome: cli.nome,
          endereco: sol.endereco,
          tecnicoNome,
          itens: orc.itens,
          totalDeslocamento: orc.totalDeslocamento,
          total: orc.total,
          pagamento: {
            criadoEm: pag.criadoEm,
            metodo: pag.metodo,
            paymentId: pag.paymentId,
          },
        }),
      );
      const chave = chaveFatura(osId);
      const url = await salvarPDFR2(buffer, chave, armazenamento);
      resultado.fatura = { chave, url };
      anexos.push({ filename: `fatura_${numeroCurtoOs(osId)}.pdf`, content: buffer });
    }
  }

  // Certificado de garantia -------------------------------------------------
  if (plano.certificado) {
    const janelaInput = await montarJanelaInput(os, osId);
    if (!janelaInput) {
      // Esperado só em dados inconsistentes (OS paga/âncora sem pagamento
      // approved ou sem prazo). Pula só o certificado — a fatura, se gerada,
      // segue para o e-mail.
      console.warn(
        `[documentos] certificado_pulado: OS ${osId} (tipo ${os.tipo}) sem janela de garantia resolvível (pagamento âncora/prazo ausente).`,
      );
    } else {
      const janela = resolverJanelaGarantia(janelaInput);
      const buffer = await gerarCertificadoPdf(
        montarDadosCertificado({
          osId,
          clienteNome: cli.nome,
          servicos: servicosDistintos(orc.itens),
          prazoGarantiaMeses: janela.prazoMeses,
          inicio: janela.inicio,
          fim: janela.fim,
        }),
      );
      const chave = chaveCertificado(osId);
      const url = await salvarPDFR2(buffer, chave, armazenamento);
      resultado.certificado = { chave, url };
      anexos.push({
        filename: `certificado_garantia_${numeroCurtoOs(osId)}.pdf`,
        content: buffer,
      });
    }
  }

  // Nenhum documento gerado: nada a entregar.
  if (anexos.length === 0) return skip("nenhum documento gerado");

  // E-mail ------------------------------------------------------------------
  if (!cli.email) {
    console.log(
      `[documentos] email_skipped: cliente ${cli.nome} sem e-mail; PDFs no portal.`,
    );
    return { ...resultado, email: "skipped", motivo: "cliente sem e-mail" };
  }

  const email = deps.email ?? criarEmailService({ forceMock: deps.forceMock });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const urlPortal = `${siteUrl}/s/${sol.token}`;
  await email.enviar({
    para: cli.email,
    assunto: `Documentos da OS ${numeroCurtoOs(osId)} — DBG`,
    html: await renderizarEmailDocumentos({
      clienteNome: cli.nome,
      numeroOS: numeroCurtoOs(osId),
      urlPortal,
      faturaUrl: resultado.fatura?.url ?? null,
      certificadoUrl: resultado.certificado?.url ?? null,
    }),
    anexos,
  });

  return { ...resultado, email: "sent" };
}

function skip(motivo: string): GerarDocumentosResultado {
  return { email: "skipped", motivo };
}

async function carregarTecnicoNome(tecnicoId: string | null): Promise<string> {
  if (!tecnicoId) return "Não atribuído";
  const [tec] = await db
    .select({ nome: membro.nome })
    .from(membro)
    .where(eq(membro.id, tecnicoId))
    .limit(1);
  return tec?.nome ?? "Não atribuído";
}

interface OrcamentoCarregado {
  totalDeslocamento: string;
  total: string;
  itens: {
    descricao: string;
    quantidade: string;
    precoUnitario: string;
    subtotal: string;
  }[];
}

/** Orçamento mais recente da OS com seus itens (totais + breakdown). */
async function carregarOrcamento(osId: string): Promise<OrcamentoCarregado> {
  const [orc] = await db
    .select({
      id: orcamento.id,
      totalDeslocamento: orcamento.totalDeslocamento,
      total: orcamento.total,
    })
    .from(orcamento)
    .where(eq(orcamento.osId, osId))
    .orderBy(desc(orcamento.criadoEm))
    .limit(1);
  if (!orc) return { totalDeslocamento: "0", total: "0", itens: [] };

  const itens = await db
    .select({
      descricao: servico.nome,
      quantidade: orcamentoItem.quantidade,
      precoUnitario: orcamentoItem.precoUnitario,
      subtotal: orcamentoItem.subtotal,
    })
    .from(orcamentoItem)
    .innerJoin(servico, eq(orcamentoItem.servicoId, servico.id))
    .where(eq(orcamentoItem.orcamentoId, orc.id));

  return { totalDeslocamento: orc.totalDeslocamento, total: orc.total, itens };
}

function servicosDistintos(itens: { descricao: string }[]): string[] {
  return [...new Set(itens.map((i) => i.descricao))];
}

async function carregarPagamento(osId: string) {
  const [pag] = await db
    .select({
      paymentId: pagamento.paymentId,
      metodo: pagamento.metodo,
      criadoEm: pagamento.criadoEm,
    })
    .from(pagamento)
    .where(and(eq(pagamento.osId, osId), eq(pagamento.status, "approved")))
    .orderBy(desc(pagamento.criadoEm))
    .limit(1);
  return pag ?? null;
}

/**
 * Monta a entrada da janela de garantia. Para OS paga, usa o próprio pagamento
 * e prazo. Para GARANTIA (regarantia), busca a âncora na OS original (osPaiId):
 * pagamento e prazo originais — a janela não reinicia.
 */
async function montarJanelaInput(
  os: typeof ordemServico.$inferSelect,
  osId: string,
) {
  if (os.tipo === "GARANTIA") {
    if (!os.osPaiId) return null;
    const [orig] = await db
      .select({ prazo: ordemServico.prazoGarantiaMeses })
      .from(ordemServico)
      .where(eq(ordemServico.id, os.osPaiId))
      .limit(1);
    const pagOrig = await carregarPagamento(os.osPaiId);
    if (!orig || orig.prazo == null || !pagOrig) return null;
    return {
      tipo: os.tipo,
      prazoMeses: 0,
      pagamentoEm: new Date(),
      original: { prazoMeses: orig.prazo, pagamentoEm: pagOrig.criadoEm },
    };
  }

  const pag = await carregarPagamento(osId);
  if (!pag || os.prazoGarantiaMeses == null) return null;
  return {
    tipo: os.tipo,
    prazoMeses: os.prazoGarantiaMeses,
    pagamentoEm: pag.criadoEm,
  };
}
