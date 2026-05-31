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
