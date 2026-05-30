/**
 * Regras de liberação da execução no app de campo. São puras: a UI usa para
 * habilitar/desabilitar botões e o servidor reusa para validar a transição.
 */

/** Foto antes ≥ 1 libera APROVADA → EM_EXECUCAO. */
export function podeIniciarExecucao(
  estado: string,
  fotosAntes: number,
): boolean {
  return estado === "APROVADA" && fotosAntes >= 1;
}

/** Foto depois ≥ 1 libera EM_EXECUCAO → CONCLUIDA. */
export function podeConcluir(estado: string, fotosDepois: number): boolean {
  return estado === "EM_EXECUCAO" && fotosDepois >= 1;
}

/** Garante foto depois antes de concluir. Lança se não houver. */
export function validarConclusao(fotosDepois: number): void {
  if (fotosDepois < 1) throw new FotoObrigatoriaError();
}

export class FotoObrigatoriaError extends Error {
  readonly status = 422;
  constructor() {
    super("É obrigatória ao menos uma foto depois para concluir a OS");
    this.name = "FotoObrigatoriaError";
  }
}
