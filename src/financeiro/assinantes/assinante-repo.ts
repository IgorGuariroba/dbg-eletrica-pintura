import type { StatusAssinatura } from "@/assinatura/assinatura-repo";

/** Item da lista de assinantes do admin Financeiro. */
export interface AssinanteListItem {
  assinaturaId: string;
  clienteNome: string;
  planoNome: string;
  status: StatusAssinatura;
  /** Valor mensal do plano (R$). */
  valorMensal: string;
  inicio: Date | null;
  /**
   * Próxima visita preventiva prevista. Derivada do ciclo da assinatura quando
   * disponível; a geração efetiva da OS preventiva é do slice #6 — até lá pode
   * vir `null`.
   */
  proximaPreventiva: Date | null;
}

export interface ListarAssinantesFiltro {
  status?: StatusAssinatura;
  planoId?: string;
}

export interface AssinanteRepo {
  listarAssinantes(
    filtro?: ListarAssinantesFiltro,
  ): Promise<AssinanteListItem[]>;
}
