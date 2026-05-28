import type { Membro, MembroRepo } from "./membro-repo";

export async function toggleAtivoMembro(
  id: string,
  repo: MembroRepo,
): Promise<Membro | null> {
  return repo.toggleAtivo(id);
}
