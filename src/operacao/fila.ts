import type { Modulo, Role } from "@/auth/role-detection";
import type {
  Categoria,
  FilaRepo,
  ListarFilaFiltro,
  ListarFilaResultado,
  OsFila,
} from "./fila-repo";
import {
  DevolucaoInvalidaError,
  MotivoObrigatorioError,
  NaoTecnicoError,
  OsIndisponivelError,
} from "./fila-repo";

export interface UsuarioFila {
  membroId: string;
  role: Role;
  modulos: Modulo[];
  isTecnico: boolean;
  especialidades: Categoria[];
}

/** Membro com módulo Operação (ou admin raiz) enxerga a fila inteira. */
function vePainelCompleto(usuario: UsuarioFila): boolean {
  return usuario.role === "admin_raiz" || usuario.modulos.includes("OPERACAO");
}

export interface Paginacao {
  limit?: number;
  offset?: number;
}

export async function listarFila(
  usuario: UsuarioFila,
  repo: FilaRepo,
  pag: Paginacao = {},
): Promise<ListarFilaResultado> {
  const filtro: ListarFilaFiltro = {
    limit: Math.min(Math.max(pag.limit ?? 50, 1), 200),
    offset: Math.max(pag.offset ?? 0, 0),
  };
  if (!vePainelCompleto(usuario)) {
    // Visão do técnico: OS NOVA disponíveis OU já atribuídas a ele (pra poder
    // devolver), restritas às suas especialidades.
    filtro.apenasDisponiveis = true;
    filtro.incluirTecnicoId = usuario.membroId;
    filtro.categorias = usuario.especialidades;
  }
  return repo.listar(filtro);
}

export async function pegarOs(
  osId: string,
  usuario: UsuarioFila,
  repo: FilaRepo,
): Promise<OsFila> {
  if (!usuario.isTecnico) throw new NaoTecnicoError();
  const os = await repo.autoatribuir(osId, usuario.membroId);
  if (!os) throw new OsIndisponivelError();
  return os;
}

export async function devolverOs(
  osId: string,
  usuario: UsuarioFila,
  motivo: string,
  repo: FilaRepo,
): Promise<OsFila> {
  if (!usuario.isTecnico) throw new NaoTecnicoError();
  const motivoLimpo = motivo.trim();
  if (!motivoLimpo) throw new MotivoObrigatorioError();
  const os = await repo.devolver(osId, usuario.membroId, motivoLimpo);
  if (!os) throw new DevolucaoInvalidaError();
  return os;
}
