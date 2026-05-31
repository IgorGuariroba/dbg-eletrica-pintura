export class BairroInvalidoError extends Error {
  constructor() {
    super("Bairro não pode ser vazio");
    this.name = "BairroInvalidoError";
  }
}

/**
 * Normaliza o nome de um bairro para servir como chave de cobertura:
 * apara espaços e baixa a caixa, de modo que "Centro" e " centro " colidam.
 * Lança `BairroInvalidoError` quando sobra string vazia.
 */
export function normalizarBairro(nome: string): string {
  const limpo = nome.trim().toLowerCase();
  if (!limpo) throw new BairroInvalidoError();
  return limpo;
}

export function bairroForaDaCobertura(
  bairro: string | undefined | null,
  listaBairrosAtendidos: string[]
): boolean {
  if (listaBairrosAtendidos.length === 0) return false;
  if (!bairro) return false;
  const limpo = bairro.trim();
  if (!limpo) return false;
  const normalizado = normalizarBairro(limpo);
  return !listaBairrosAtendidos.includes(normalizado);
}
