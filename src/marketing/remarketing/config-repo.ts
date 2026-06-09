import type { GatilhoRemarketingId } from "./gatilhos";

export interface ConfigRemarketing {
  gatilho: GatilhoRemarketingId;
  ativo: boolean;
  prazosDias: number[];
  templateId: string | null;
  atualizadoEm?: Date | null;
}

export interface ConfigRemarketingRepo {
  listar(): Promise<ConfigRemarketing[]>;
  obter(gatilho: GatilhoRemarketingId): Promise<ConfigRemarketing>;
  salvar(gatilho: GatilhoRemarketingId, dados: { ativo: boolean; prazosDias: number[]; templateId: string | null }): Promise<void>;
  obterValidadeDias(): Promise<number>;
}
