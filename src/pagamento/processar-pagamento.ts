import {
  aplicarTransicao,
  TransicaoInvalidaError,
} from "@/operacao/maquina-estado";
import type { EstadoOs } from "@/operacao/orcamento-repo";
import type { TransicaoRepo } from "@/operacao/transicao-repo";
import type { PagamentoRepo } from "./pagamento-repo";
import type { DadosPagamento } from "./webhook";

/** Ator registrado no histórico para transições disparadas pelo webhook. */
const ATOR_WEBHOOK = "mercadopago:webhook";

/**
 * Decide se o status de pagamento do Mercado Pago dispara a transição da OS
 * para PAGA. Só `approved` confirma o recebimento.
 */
export function deveTransitarParaPaga(status: string): boolean {
  return status === "approved";
}

export interface ProcessarDeps {
  pagamentoRepo: PagamentoRepo;
  transicaoRepo: TransicaoRepo;
  /**
   * Emite a notificação da transição PAGA (gera fatura/certificado via
   * Notificação). Default: notificar() fire-and-forget. Injetável para teste.
   */
  notificarTransicao?: (osId: string, estado: EstadoOs) => void;
  /**
   * Ativa a assinatura PENDENTE do combo "pagar tudo junto + assinar" (#65)
   * quando o pagamento combinado é aprovado. Default: caso de uso
   * `ativarAssinaturaCombinada` com repo Drizzle. Injetável para teste.
   */
  ativarAssinatura?: (assinaturaId: string) => Promise<void>;
}

/** Ativação padrão da assinatura do combo (lazy p/ não pesar o módulo). */
async function ativarPadrao(assinaturaId: string): Promise<void> {
  const [{ ativarAssinaturaCombinada }, { criarAssinaturaCombinadaRepoDrizzle }, { db }] =
    await Promise.all([
      import("@/assinatura/assinatura-combinada"),
      import("@/assinatura/assinatura-combinada-repo-drizzle"),
      import("@/db/client"),
    ]);
  await ativarAssinaturaCombinada(assinaturaId, {
    repo: criarAssinaturaCombinadaRepoDrizzle(db),
    enviarBoasVindas: async (id) => {
      const { notificar } = await import("@/notificacao/notificar");
      await notificar({ tipo: "assinatura.criada_combo", assinaturaId: id });
    },
  });
}

/** Emissão padrão: interface única notificar(evento), assíncrona e não-bloqueante. */
function notificarPadrao(osId: string, estado: EstadoOs): void {
  import("@/notificacao/notificar")
    .then(({ notificar }) =>
      notificar({ tipo: "os.transicao", osId, estadoNovo: estado }).catch((e) =>
        console.error(`Erro ao despachar notificação da OS ${osId}:`, e),
      ),
    )
    .catch((e) => console.error(`Erro ao carregar notificador:`, e));
}

export interface ProcessarResultado {
  /** OS que transitaram para PAGA nesta chamada. */
  transitadas: string[];
}

/**
 * Caso de uso do webhook: para cada OS do pagamento, registra a cobrança de
 * forma idempotente e transita CONCLUIDA → PAGA quando aprovado.
 *
 * - Pagamento não aprovado (rejeitado/cancelado/pendente): não altera a OS,
 *   só registra um log estruturado.
 * - Webhook duplicado: o registro idempotente (PK payment_id+os_id) impede
 *   uma segunda transição.
 * - OS que bloqueia PAGA (PREVENTIVA/GARANTIA): a transição inválida é
 *   capturada e logada, sem propagar erro.
 */
export async function processarPagamento(
  dados: DadosPagamento,
  deps: ProcessarDeps,
  agora: Date = new Date(),
): Promise<ProcessarResultado> {
  const transitadas: string[] = [];

  if (deveTransitarParaPaga(dados.status) && dados.metadata?.assinatura_id) {
    await (deps.ativarAssinatura ?? ativarPadrao)(dados.metadata.assinatura_id);
    log("assinatura_combo_ativada", {
      ...base(dados),
      assinaturaId: dados.metadata.assinatura_id,
    });
  }

  if (deveTransitarParaPaga(dados.status) && dados.metadata?.credito_utilizado && dados.metadata?.cliente_id) {
    const valorCredito = dados.metadata.credito_utilizado;
    if (Number(valorCredito) > 0) {
      await deps.pagamentoRepo.consumirCredito(
        dados.paymentId,
        dados.metadata.cliente_id,
        valorCredito,
      );
    }
  }

  for (const osId of dados.osIds) {
    if (!deveTransitarParaPaga(dados.status)) {
      log("pagamento_nao_aprovado", { ...base(dados), osId });
      continue;
    }

    const inserido = await deps.pagamentoRepo.registrar({
      paymentId: dados.paymentId,
      osId,
      valor: dados.valor,
      metodo: dados.metodo,
      status: dados.status,
      observacao: dados.observacao,
    });
    if (!inserido) {
      log("webhook_duplicado", { ...base(dados), osId });
      continue;
    }

    try {
      await aplicarTransicao(
        osId,
        "PAGA",
        dados.ator ?? ATOR_WEBHOOK,
        dados.motivo ?? `Pagamento ${dados.paymentId} (${dados.metodo})`,
        deps.transicaoRepo,
        agora,
      );
      transitadas.push(osId);
      await deps.pagamentoRepo.processarReferralPosPagamento(osId);
      (deps.notificarTransicao ?? notificarPadrao)(osId, "PAGA");
      log("pagamento_confirmado", { ...base(dados), osId });
    } catch (e) {
      if (e instanceof TransicaoInvalidaError) {
        log("transicao_bloqueada", { ...base(dados), osId, erro: e.message });
        continue;
      }
      throw e;
    }
  }

  return { transitadas };
}

function base(dados: DadosPagamento) {
  return {
    paymentId: dados.paymentId,
    status: dados.status,
    valor: dados.valor,
    metodo: dados.metodo,
  };
}

function log(evento: string, dados: Record<string, unknown>): void {
  console.info(
    JSON.stringify({ origem: "pagamento", evento, ...dados }),
  );
}
