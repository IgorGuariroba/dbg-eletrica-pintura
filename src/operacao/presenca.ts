import type { PresencaRepo } from "./presenca-repo";

/**
 * Confirma a presença do cliente na OS. Idempotente: cliques repetidos não
 * sobrescrevem o primeiro registro (ver {@link PresencaRepo.confirmar}).
 */
export async function confirmarPresenca(
  osId: string,
  ip: string,
  repo: PresencaRepo,
): Promise<{ jaConfirmado: boolean }> {
  return repo.confirmar(osId, ip);
}
