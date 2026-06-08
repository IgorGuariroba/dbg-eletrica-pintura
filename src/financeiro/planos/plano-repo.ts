/** Dados para criar um plano de assinatura. */
export interface NovoPlano {
  nome: string;
  preco: string;
  beneficios: string | null;
  percentualDesconto: string;
  preventivasPorAno: number;
  prioridadeAgendamento: boolean;
  ativo: boolean;
}

/** Plano persistido. */
export interface Plano extends NovoPlano {
  id: string;
  preapprovalPlanIdMp: string | null;
  criadoEm: Date;
}

/** Mudanças parciais em um plano existente. */
export interface AtualizacaoPlano {
  nome?: string;
  preco?: string;
  beneficios?: string | null;
  percentualDesconto?: string;
  preventivasPorAno?: number;
  prioridadeAgendamento?: boolean;
  ativo?: boolean;
}

export interface PlanoRepo {
  inserir(novo: NovoPlano): Promise<Plano>;
  atualizar(id: string, mudancas: AtualizacaoPlano): Promise<Plano | null>;
  toggleAtivo(id: string): Promise<Plano | null>;
  buscarPorId(id: string): Promise<Plano | null>;
  /** Planos ativos, p/ a página pública `/planos`. */
  listarAtivos(): Promise<Plano[]>;
  /** Todos os planos (ativos e inativos), p/ o admin Financeiro. */
  listarTodos(): Promise<Plano[]>;
  /** Grava o id do template de cobrança espelhado no Mercado Pago. */
  definirPreapprovalPlanIdMp(id: string, mpId: string): Promise<void>;
}
