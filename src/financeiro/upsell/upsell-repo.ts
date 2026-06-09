/** Plano exibido no card de upsell (economia visível). */
export interface PlanoUpsell {
  id: string;
  nome: string;
  slug: string;
  preco: string;
  percentualDesconto: string;
}

/**
 * Porta de persistência do upsell de assinatura (issue #65): detecta assinante
 * ativo, controla a flag `upsell_visto_em` do cliente e fornece os dados do
 * card (plano destaque + social proof). Isola os use cases do schema/DB.
 */
export interface UpsellRepo {
  /** Cliente tem alguma assinatura ATIVA (qualquer plano)? */
  temAssinaturaAtiva(clienteId: string): Promise<boolean>;
  /** Última exibição do upsell ao cliente (null = nunca viu). */
  upsellVistoEm(clienteId: string): Promise<Date | null>;
  marcarUpsellVisto(clienteId: string, quando: Date): Promise<void>;
  /** Plano ativo de maior desconto com slug (alvo do card). */
  planoDestaque(): Promise<PlanoUpsell | null>;
  /** Total de assinaturas ATIVAS (social proof "X clientes já assinaram"). */
  contarAssinaturasAtivas(): Promise<number>;
}
