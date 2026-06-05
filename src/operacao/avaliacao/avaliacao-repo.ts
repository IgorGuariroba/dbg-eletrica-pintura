export interface AvaliacaoInput {
  osId: string;
  nota: number;
  comentarioOs?: string | null;
}

export interface RegistrarAvaliacoesPayload {
  avaliacoes: AvaliacaoInput[];
  comentarioGeral?: string | null;
}

export interface SolicitacaoAvaliacaoView {
  token: string;
  clienteNome: string;
  clienteEmail: string | null;
  clienteWhatsapp: string;
  solicitacaoId: string;
  comentarioGeral: string | null;
  ordens: {
    id: string;
    tipo: string;
    estado: string;
    categoria: string;
    tecnicoId: string | null;
    tecnicoNome: string | null;
    avaliacao: {
      nota: number;
      comentarioOs: string | null;
    } | null;
  }[];
}

export interface AvaliacaoRepo {
  salvarAvaliacao(
    osId: string,
    dados: {
      tecnicoId: string | null;
      nota: number;
      comentarioOs: string | null;
      atorToken: string;
      ip: string;
    }
  ): Promise<void>;

  salvarComentarioGeral(
    solicitacaoId: string,
    dados: {
      comentario: string;
      atorToken: string;
      ip: string;
    }
  ): Promise<void>;

  carregarPorToken(token: string): Promise<SolicitacaoAvaliacaoView | null>;

  verificarPertencimento(token: string, osIds: string[]): Promise<boolean>;

  obterTecnicoSnapshot(osId: string): Promise<string | null>;

  obterSolicitacaoIdPorToken(token: string): Promise<string | null>;
}

export class NotaInvalidaError extends Error {
  readonly status = 400;
  constructor(message = "Nota deve ser entre 1 e 5") {
    super(message);
    this.name = "NotaInvalidaError";
  }
}

export class OsNaoAvaliavelError extends Error {
  readonly status = 400;
  constructor(message = "Esta Ordem de Serviço não está disponível para avaliação ou não pertence a esta solicitação") {
    super(message);
    this.name = "OsNaoAvaliavelError";
  }
}
