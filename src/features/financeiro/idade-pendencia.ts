export function classificarIdadePendencia(dias: number): "novo" | "1dia" | "3dias" {
  if (dias <= 0) return "novo";
  if (dias <= 2) return "1dia";
  return "3dias";
}

/** Rótulo visível do badge de idade. Pendência ≥ 3 dias colapsa em "3+ dias". */
export function rotuloIdadePendencia(dias: number): string {
  switch (classificarIdadePendencia(dias)) {
    case "novo":
      return "Novo";
    case "1dia":
      return `${dias} ${dias === 1 ? "dia" : "dias"}`;
    case "3dias":
      return "3+ dias";
  }
}
