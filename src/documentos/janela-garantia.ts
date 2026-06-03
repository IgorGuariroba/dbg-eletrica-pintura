import type { TipoOs } from "@/operacao/maquina-estado";

/** Âncora de prazo da OS original paga (usada na regarantia). */
export interface JanelaOriginal {
  prazoMeses: number;
  pagamentoEm: Date;
}

export interface JanelaGarantiaInput {
  tipo: TipoOs;
  /** Prazo de garantia da própria OS (snapshot). */
  prazoMeses: number;
  /** Data do pagamento da própria OS (ou conclusão, p/ GARANTIA sem custo). */
  pagamentoEm: Date;
  /** Janela da OS original — obrigatória para tipo GARANTIA (regarantia). */
  original?: JanelaOriginal;
}

export interface JanelaGarantia {
  inicio: Date;
  fim: Date;
  prazoMeses: number;
}

/** Soma `meses` a uma data preservando o instante UTC (sem drift de fuso). */
function adicionarMeses(data: Date, meses: number): Date {
  const r = new Date(data);
  r.setUTCMonth(r.getUTCMonth() + meses);
  return r;
}

/**
 * Resolve a janela de garantia de uma OS.
 *
 * - OS paga (NORMAL/EXPRESS/COMPLEMENTAR): início = pagamento, fim = pagamento
 *   + prazo da própria OS.
 * - GARANTIA (regarantia): preserva a janela da OS original paga — o prazo NÃO
 *   reinicia. Início e fim vêm do pagamento e prazo originais (âncora). Exige
 *   `original`.
 */
export function resolverJanelaGarantia(
  input: JanelaGarantiaInput,
): JanelaGarantia {
  if (input.tipo === "GARANTIA") {
    if (!input.original) {
      throw new Error(
        "Regarantia exige a janela da OS original (âncora de prazo).",
      );
    }
    const { pagamentoEm, prazoMeses } = input.original;
    return {
      inicio: pagamentoEm,
      fim: adicionarMeses(pagamentoEm, prazoMeses),
      prazoMeses,
    };
  }

  return {
    inicio: input.pagamentoEm,
    fim: adicionarMeses(input.pagamentoEm, input.prazoMeses),
    prazoMeses: input.prazoMeses,
  };
}
