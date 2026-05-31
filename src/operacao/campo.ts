import type {
  CampoRepo,
  FiltroTecnicosEmCampo,
  TecnicoEmCampo,
} from "./campo-repo";

/**
 * Caso de uso: lista técnicos com OS em estado de campo.
 * Delega ao repo o filtro e a ordenação (maior tempo primeiro).
 */
export async function listarTecnicosEmCampo(
  repo: CampoRepo,
  filtro?: FiltroTecnicosEmCampo,
): Promise<TecnicoEmCampo[]> {
  return repo.listarTecnicosEmCampo(filtro);
}
