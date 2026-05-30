/**
 * Deslocamento = (km × preço do litro) ÷ km por litro.
 * Valores monetários circulam como string decimal (mesmo padrão do Catálogo).
 */
export function calcularDeslocamento(
  km: number,
  precoLitro: string,
  kmPorLitro: string,
): string {
  const litros = km / Number(kmPorLitro);
  const valor = litros * Number(precoLitro);
  return valor.toFixed(2);
}
