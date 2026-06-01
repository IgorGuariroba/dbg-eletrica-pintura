import type { OrdemCheckout } from "./checkout";

export interface SolicitacaoCheckoutView {
  token: string;
  clienteNome: string;
  cidade: string | null;
  uf: string | null;
  criadoEm: Date;
  ordens: OrdemCheckout[];
}

export interface PagamentoCheckoutRepo {
  /**
   * Carrega a solicitação pública por token para checkout de pagamento.
   * Retorna apenas as ordens de serviço nos estados CONCLUIDA ou PAGA.
   * Se o token não for encontrado, retorna null.
   */
  carregarPorToken(token: string): Promise<SolicitacaoCheckoutView | null>;
}
