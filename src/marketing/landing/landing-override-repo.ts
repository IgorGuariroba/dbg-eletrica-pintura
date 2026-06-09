// Override de Marketing sobre a landing pública de um Serviço (#61).
// Persistência pura — regras de negócio (ex.: depoimento só ≥4★) ficam na
// camada de ação/uso, que seleciona candidatos via depoimentos-query.

export interface LandingOverrideFoto {
  id: string;
  chave: string;
  ordem: number;
}

export interface LandingOverride {
  servicoId: string;
  titulo: string | null;
  descricao: string | null;
  /** Preço promocional de exibição. NÃO altera o Catálogo. */
  precoPromo: string | null;
  upsellServicoId: string | null;
  fotos: LandingOverrideFoto[];
  /** IDs de avaliações cherry-picked, em ordem de exibição. */
  depoimentoIds: string[];
}

export interface SalvarOverrideInput {
  titulo?: string | null;
  descricao?: string | null;
  precoPromo?: string | null;
  upsellServicoId?: string | null;
}

export interface LandingOverrideRepo {
  /** Retorna o override (com fotos e depoimentos) ou null se não existir. */
  obterPorServico(servicoId: string): Promise<LandingOverride | null>;

  /** Cria ou atualiza (upsert) os campos escalares do override. */
  salvar(
    servicoId: string,
    dados: SalvarOverrideInput,
  ): Promise<LandingOverride>;

  /** Adiciona uma foto extra (chave R2), no fim da ordem atual. */
  adicionarFoto(servicoId: string, chave: string): Promise<LandingOverrideFoto>;

  /** Remove uma foto extra pelo id. */
  removerFoto(fotoId: string): Promise<void>;

  /**
   * Substitui o conjunto de depoimentos pela lista informada, preservando a
   * ordem do array (índice = ordem).
   */
  definirDepoimentos(servicoId: string, avaliacaoIds: string[]): Promise<void>;
}
