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

export interface FiltroAvaliacoes {
  nota?: number;
  tecnicoId?: string;
  de?: Date;
  ate?: Date;
}

export interface AvaliacaoAdminView {
  id: string;
  osId: string;
  solicitacaoId: string;
  tecnicoId: string | null;
  tecnicoNome: string | null;
  nota: number;
  comentarioOs: string | null;
  criadoEm: Date;
  status: string;
  resolvidoEm: Date | null;
  avaliacaoInvalida: boolean;
  avaliacaoMotivoInvalidacao: string | null;
}

export interface AlertaAvaliacaoRepo {
  criar(dados: AlertaAvaliacaoInput): Promise<void>;
  listarPendentes(): Promise<AlertaPendenteView[]>;
  listarTodas(filtro?: FiltroAvaliacoes): Promise<AvaliacaoAdminView[]>;
  /**
   * Marca como REAVALIADO o alerta da OS que já estava RESOLVIDO (tratativa
   * concluída) quando chega uma reavaliação positiva (≥ 4★). No-op se a OS não
   * tem alerta resolvido — primeira avaliação alta nunca cria/altera alerta.
   */
  marcarReavaliado(osId: string): Promise<void>;
}
