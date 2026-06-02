import type { categoriaServicoEnum } from "@/db/schema";

export type Periodo = "dia" | "semana" | "mes";
export type Categoria = (typeof categoriaServicoEnum.enumValues)[number];

export interface PagamentoPendente {
  osId: string;
  clienteNome: string;
  clienteWhatsapp: string;
  token: string;            // p/ link /s/{token}/pagar
  valor: string;            // orcamento.total (a cobrar)
  diasPendente: number;
  categoria: Categoria;
}

export interface PagamentoConfirmado {
  osId: string;
  clienteNome: string;
  valor: string;            // pagamento.valor (recebido)
  metodo: string;
  pagoEm: Date;
}

export interface ResumoFinanceiro {
  faturamento: string;      // soma pagamento.valor approved no período
  ticketMedio: string;      // faturamento / qtd
  qtdPagamentos: number;
}

export interface FinanceiroRepo {
  listarPendentes(): Promise<PagamentoPendente[]>;
  listarConfirmados(intervalo: { inicio: Date; fim: Date }): Promise<PagamentoConfirmado[]>;
  resumoPeriodo(intervalo: { inicio: Date; fim: Date }): Promise<ResumoFinanceiro>;
}
