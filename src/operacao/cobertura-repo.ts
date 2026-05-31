export interface Bairro {
  id: string;
  nome: string;
  criadoEm: Date;
}

export interface BairroCoberturaRepo {
  /** Adiciona um bairro (normalizado). Idempotente: repetido devolve o existente. */
  adicionar(nome: string): Promise<Bairro>;
  /** Lista os bairros atendidos em ordem alfabética. */
  listar(): Promise<Bairro[]>;
  /** Remove um bairro pelo id. */
  remover(id: string): Promise<void>;
}
