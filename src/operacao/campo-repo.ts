import type { Categoria, EstadoOs } from "./fila-repo";

/** Estados de campo — os únicos que aparecem no dashboard ao vivo. */
export const ESTADOS_CAMPO = ["A_CAMINHO", "NO_LOCAL", "EM_EXECUCAO"] as const;
export type EstadoCampo = (typeof ESTADOS_CAMPO)[number];

/**
 * Uma linha do dashboard "técnicos em campo":
 * agrupa OS + técnico + última transição + dados do cliente.
 */
export interface TecnicoEmCampo {
  osId: string;
  /** Número ou identificador curto da OS para exibição. */
  osNumero: string;
  estado: EstadoCampo;
  /** Timestamp da última transição que levou a OS ao estado atual. */
  ultimaTransicaoEm: Date;
  tecnicoId: string;
  tecnicoNome: string;
  /**
   * E-mail do técnico — usado para montar link wa.me caso o número esteja
   * disponível em fonte externa, ou para identificação.
   * Campo `whatsapp` não existe no schema `membro`; retornado como null
   * quando ausente.
   */
  tecnicoWhatsapp: string | null;
  clienteNome: string;
  /** Endereço completo do cliente (logradouro + cidade/UF). */
  endereco: string;
  categoria: Categoria;
  /**
   * OS está em EM_EXECUCAO mas não tem foto ANTES registrada no banco.
   * Sinaliza inconsistência de processo — o técnico não deveria ter
   * transicionado sem foto.
   */
  inconsistente: boolean;
}

export interface FiltroTecnicosEmCampo {
  estado?: EstadoCampo;
  tecnicoId?: string;
  categoria?: Categoria;
}

export interface CampoRepo {
  /**
   * Lista técnicos com OS em estado de campo (A_CAMINHO, NO_LOCAL,
   * EM_EXECUCAO). Ordenação padrão: maior tempo no estado primeiro
   * (ultimaTransicaoEm ASC). Filtros opcionais por estado, técnico e
   * categoria. Query deve executar em < 300ms com 100 técnicos ativos.
   */
  listarTecnicosEmCampo(
    filtro?: FiltroTecnicosEmCampo,
  ): Promise<TecnicoEmCampo[]>;
}
