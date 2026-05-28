import type {
  FiltroPapel,
  ListarFiltro,
  ListarResultado,
  MembroRepo,
} from "./membro-repo";

const PAPEIS_VALIDOS: FiltroPapel[] = ["tecnico", "interno", "ambos"];

export interface ListarMembrosQuery {
  papel?: FiltroPapel;
  ativo?: boolean;
  page?: number;
  perPage?: number;
}

export async function listarMembros(
  q: ListarMembrosQuery,
  repo: MembroRepo,
): Promise<ListarResultado> {
  const perPage = Math.min(Math.max(q.perPage ?? 20, 1), 100);
  const page = Math.max(q.page ?? 1, 1);
  const filtro: ListarFiltro = {
    limit: perPage,
    offset: (page - 1) * perPage,
  };
  if (q.papel && PAPEIS_VALIDOS.includes(q.papel)) filtro.papel = q.papel;
  if (typeof q.ativo === "boolean") filtro.ativo = q.ativo;
  return repo.listar(filtro);
}
