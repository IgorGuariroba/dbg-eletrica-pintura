import type { Categoria } from "@/catalogo/servico-repo";

// Monta a view de uma landing pública combinando o Serviço (versão auto) com
// um override opcional de Marketing. Lógica pura — sem I/O: recebe os pedaços
// já resolvidos (URLs de foto, upsell, depoimentos) e compõe a exibição.

export interface ServicoLanding {
  slug: string;
  nome: string;
  categoria: Categoria;
  precoBase: string;
  fotoUrl: string | null;
}

export interface OverrideLanding {
  titulo: string | null;
  descricao: string | null;
  precoPromo: string | null;
}

export interface DepoimentoLanding {
  nome: string;
  texto: string;
  nota: number;
}

export interface UpsellLanding {
  slug: string;
  titulo: string;
}

export interface PrecoLanding {
  base: string;
  promo: string | null;
  riscado: boolean;
}

export interface LandingView {
  slug: string;
  titulo: string;
  descricao: string;
  categoria: Categoria;
  preco: PrecoLanding;
  fotos: string[];
  upsell: UpsellLanding | null;
  depoimentos: DepoimentoLanding[];
}

// Copy padrão por categoria, usada quando não há descrição de override.
const COPY_CATEGORIA: Record<Categoria, string> = {
  ELETRICA:
    "Serviços elétricos residenciais com preço fixo, segurança e garantia formal.",
  PINTURA:
    "Pintura interna e externa com acabamento profissional, preço fixo e garantia.",
  DRYWALL:
    "Divisórias e forros em drywall com execução limpa, preço fixo e garantia.",
};

export function descricaoPorCategoria(categoria: Categoria): string {
  return COPY_CATEGORIA[categoria];
}

interface MontarLandingInput {
  servico: ServicoLanding;
  override: OverrideLanding | null;
  fotosExtras: string[];
  upsell: UpsellLanding | null;
  depoimentos: DepoimentoLanding[];
}

function resolverPreco(
  base: string,
  promo: string | null | undefined,
): PrecoLanding {
  // Promo só é válida se for um número estritamente menor que o base.
  if (promo != null && Number(promo) < Number(base)) {
    return { base, promo, riscado: true };
  }
  return { base, promo: null, riscado: false };
}

export function montarLanding({
  servico,
  override,
  fotosExtras,
  upsell,
  depoimentos,
}: MontarLandingInput): LandingView {
  const fotos = [
    ...(servico.fotoUrl ? [servico.fotoUrl] : []),
    ...fotosExtras,
  ];

  return {
    slug: servico.slug,
    titulo: override?.titulo ?? servico.nome,
    descricao: override?.descricao ?? descricaoPorCategoria(servico.categoria),
    categoria: servico.categoria,
    preco: resolverPreco(servico.precoBase, override?.precoPromo),
    fotos,
    upsell,
    depoimentos,
  };
}
