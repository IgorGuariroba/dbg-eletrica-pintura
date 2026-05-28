import type { categoriaServicoEnum, moduloEnum } from "@/db/schema";

export type Categoria = (typeof categoriaServicoEnum.enumValues)[number];
export type Modulo = (typeof moduloEnum.enumValues)[number];

export interface JanelaHorario {
  inicio: string;
  fim: string;
}

export type DiaSemana = "dom" | "seg" | "ter" | "qua" | "qui" | "sex" | "sab";

export type DisponibilidadeSemanal = Partial<
  Record<DiaSemana, JanelaHorario | null>
>;

export interface NovoMembro {
  nome: string;
  email: string;
  modulos: Modulo[];
  isTecnico: boolean;
  fotoUrl: string | null;
  bio: string | null;
  especialidades: Categoria[];
  disponibilidade: DisponibilidadeSemanal | null;
  ativo: boolean;
}

export interface Membro extends NovoMembro {
  id: string;
  criadoEm: Date;
}

export interface AtualizacaoMembro {
  nome?: string;
  email?: string;
  modulos?: Modulo[];
  isTecnico?: boolean;
  fotoUrl?: string | null;
  bio?: string | null;
  especialidades?: Categoria[];
  disponibilidade?: DisponibilidadeSemanal | null;
  ativo?: boolean;
}

export type FiltroPapel = "tecnico" | "interno" | "ambos";

export interface ListarFiltro {
  papel?: FiltroPapel;
  ativo?: boolean;
  limit: number;
  offset: number;
}

export interface ListarResultado {
  itens: Membro[];
  total: number;
}

export class EmailDuplicadoError extends Error {
  constructor(public readonly email: string) {
    super(`E-mail já cadastrado: ${email}`);
    this.name = "EmailDuplicadoError";
  }
}

export interface MembroRepo {
  inserir(novo: NovoMembro): Promise<Membro>;
  atualizar(id: string, mudancas: AtualizacaoMembro): Promise<Membro | null>;
  toggleAtivo(id: string): Promise<Membro | null>;
  buscarPorId(id: string): Promise<Membro | null>;
  buscarPorEmail(email: string): Promise<Membro | null>;
  listar(filtro: ListarFiltro): Promise<ListarResultado>;
}
