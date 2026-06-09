export type GatilhoRemarketingId =
  | "validade_orcamento"
  | "lembrete_orcamento"
  | "rejeicao_orcamento"
  | "reativacao_inativos";

export interface GatilhoRemarketingDef {
  id: GatilhoRemarketingId;
  rotulo: string;
  ativoDefault: boolean;
  prazosDefault: number[];
  templateDefault: string | null;
  unidade: "dias" | "horas";
}

export const GATILHOS_REMARKETING: Record<GatilhoRemarketingId, GatilhoRemarketingDef> = {
  validade_orcamento: {
    id: "validade_orcamento",
    rotulo: "Validade orçamento",
    ativoDefault: true,
    prazosDefault: [7],
    templateDefault: null,
    unidade: "dias",
  },
  lembrete_orcamento: {
    id: "lembrete_orcamento",
    rotulo: "Lembrete orçamento",
    ativoDefault: true,
    prazosDefault: [3, 6],
    templateDefault: "orcamento_expirando",
    unidade: "dias",
  },
  rejeicao_orcamento: {
    id: "rejeicao_orcamento",
    rotulo: "Rejeição orçamento",
    ativoDefault: true,
    prazosDefault: [2],
    templateDefault: "orcamento_rejeitado",
    unidade: "dias",
  },
  reativacao_inativos: {
    id: "reativacao_inativos",
    rotulo: "Reativação inativos",
    ativoDefault: true,
    prazosDefault: [180],
    templateDefault: "cliente_inativo",
    unidade: "dias",
  },
};
