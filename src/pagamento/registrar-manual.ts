import { randomUUID } from "node:crypto";
import { processarPagamento, type ProcessarDeps } from "./processar-pagamento";

/** Métodos aceitos no pagamento manual registrado pelo técnico no PWA. */
export type MetodoPagamentoManual =
  | "DINHEIRO"
  | "PIX_DIRETO"
  | "TRANSFERENCIA"
  | "OUTRO";

export const METODOS_PAGAMENTO_MANUAL: readonly MetodoPagamentoManual[] = [
  "DINHEIRO",
  "PIX_DIRETO",
  "TRANSFERENCIA",
  "OUTRO",
];

export interface RegistrarManualInput {
  valor: string;
  metodo: string;
  observacao?: string;
  atorEmail: string;
}

export interface RegistrarManualResultado {
  ok: boolean;
  erro?: string;
}

function ehMetodoValido(m: string): m is MetodoPagamentoManual {
  return (METODOS_PAGAMENTO_MANUAL as readonly string[]).includes(m);
}

export async function registrarPagamentoManual(
  osId: string,
  dados: RegistrarManualInput,
  deps: ProcessarDeps,
  agora: Date = new Date(),
): Promise<RegistrarManualResultado> {
  if (!ehMetodoValido(dados.metodo)) {
    return {
      ok: false,
      erro: `Método de pagamento manual não homologado: ${dados.metodo}`,
    };
  }

  const valorNumerico = Number.parseFloat(dados.valor);
  if (Number.isNaN(valorNumerico) || valorNumerico <= 0) {
    return { ok: false, erro: `Valor inválido para pagamento: ${dados.valor}` };
  }

  try {
    // Guarda de estado: só CONCLUIDA pode ser paga. A máquina de estados
    // também barra, mas o pre-check dá uma mensagem clara ao técnico.
    const ctx = await deps.transicaoRepo.carregarContexto(osId);
    if (!ctx) {
      return { ok: false, erro: "Ordem de serviço não encontrada" };
    }
    if (ctx.estado !== "CONCLUIDA") {
      return {
        ok: false,
        erro: "Apenas ordens de serviço no estado CONCLUIDA podem ser pagas",
      };
    }

    // Pagamento manual = sem webhook do MP. payment_id sintético com prefixo
    // `manual-` distingue de pagamentos reais e ancora a idempotência.
    const payload = {
      paymentId: `manual-${randomUUID()}`,
      status: "approved",
      valor: dados.valor,
      metodo: dados.metodo,
      osIds: [osId],
      observacao: dados.observacao,
      ator: dados.atorEmail,
      motivo:
        dados.observacao ||
        `Pagamento registrado manualmente por ${dados.atorEmail}`,
    };

    const res = await processarPagamento(payload, deps, agora);
    if (!res.transitadas.includes(osId)) {
      return { ok: false, erro: "Transição de estado inválida para a OS" };
    }

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      erro:
        e instanceof Error
          ? e.message
          : "Erro desconhecido ao processar pagamento",
    };
  }
}
