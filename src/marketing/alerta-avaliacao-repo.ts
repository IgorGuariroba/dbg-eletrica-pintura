export interface AlertaAvaliacaoInput {
  osId: string;
  solicitacaoId: string;
  tecnicoId: string | null;
  nota: number;
  comentarioOs?: string | null;
}

export interface AlertaPendenteView {
  id: string;
  osId: string;
  solicitacaoId: string;
  tecnicoNome: string | null;
  nota: number;
  comentarioOs: string | null;
  criadoEm: Date;
  status: string;
}

export interface AlertaAvaliacaoRepo {
  criar(dados: AlertaAvaliacaoInput): Promise<void>;
  listarPendentes(): Promise<AlertaPendenteView[]>;
}
