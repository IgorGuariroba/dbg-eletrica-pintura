import { categoriaServicoEnum } from "@/db/schema";
import type {
  Categoria,
  ListarFiltro,
  ListarResultado,
  ServicoRepo,
} from "./servico-repo";

export interface ListarQuery {
  categoria?: Categoria;
  ativo?: boolean;
  page?: number;
  perPage?: number;
}

export async function listarServicos(
  q: ListarQuery,
  repo: ServicoRepo,
): Promise<ListarResultado> {
  const perPage = Math.min(Math.max(q.perPage ?? 20, 1), 100);
  const page = Math.max(q.page ?? 1, 1);
  const filtro: ListarFiltro = {
    limit: perPage,
    offset: (page - 1) * perPage,
  };
  if (q.categoria && categoriaServicoEnum.enumValues.includes(q.categoria)) {
    filtro.categoria = q.categoria;
  }
  if (typeof q.ativo === "boolean") filtro.ativo = q.ativo;
  return repo.listar(filtro);
}
