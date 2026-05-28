import type { Servico, ServicoRepo } from "./servico-repo";

export async function toggleAtivoServico(
  id: string,
  repo: ServicoRepo,
): Promise<Servico | null> {
  return repo.toggleAtivo(id);
}
