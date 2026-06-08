import type { Plano, PlanoRepo } from "./plano-repo";

export async function toggleAtivoPlano(
  id: string,
  repo: PlanoRepo,
): Promise<Plano | null> {
  return repo.toggleAtivo(id);
}
