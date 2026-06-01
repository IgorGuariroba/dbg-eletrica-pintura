import type { categoriaServicoEnum, estadoOsEnum } from "@/db/schema";
import type { ItemView } from "@/operacao/aprovacao-repo";

export type Categoria = (typeof categoriaServicoEnum.enumValues)[number];
export type EstadoOs = (typeof estadoOsEnum.enumValues)[number];

export interface OsHistorico {
  id: string;
  categoria: Categoria;
  estado: EstadoOs;
  agendadoPara: Date | null;
  tecnico: {
    id: string;
    nome: string;
    fotoUrl: string | null;
    slug: string | null;
  } | null;
  orcamento: {
    total: string;
    totalDeslocamento: string;
    validoAte: Date;
    itens: ItemView[];
  } | null;
}

export interface SolicitacaoHistorico {
  id: string;
  protocolo: string;
  criadoEm: Date;
  cidade: string | null;
  uf: string | null;
  ordens: OsHistorico[];
}

export interface PaginaHistorico {
  itens: SolicitacaoHistorico[];
  total: number;
}

export interface HistoricoRepo {
  listar(
    whatsapp: string,
    paginacao: { limit: number; offset: number },
  ): Promise<PaginaHistorico>;
  carregarSolicitacao(
    solicitacaoId: string,
    whatsapp: string,
  ): Promise<SolicitacaoHistorico | null>;
}

export interface FotosOsPort {
  listarChaves(osId: string, tipo: "ANTES" | "DEPOIS"): Promise<string[]>;
  urlLeitura(chave: string): Promise<string>;
}
