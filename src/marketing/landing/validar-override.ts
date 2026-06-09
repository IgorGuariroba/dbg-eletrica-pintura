// Validação do preço promocional de um override de landing. Pura e testável.
// Retorna a mensagem de erro, ou null se válido. Promo vazia = "sem promoção".

export function validarPrecoPromo(
  precoBase: string,
  promo: string | null | undefined,
): string | null {
  if (promo == null || promo.trim() === "") return null;
  const valor = Number(promo);
  if (Number.isNaN(valor)) return "Preço promocional inválido.";
  if (valor <= 0) return "Preço promocional deve ser maior que zero.";
  if (valor >= Number(precoBase)) {
    return "Preço promocional deve ser menor que o preço base.";
  }
  return null;
}
