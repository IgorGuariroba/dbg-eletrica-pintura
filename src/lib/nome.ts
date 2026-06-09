function capitalizar(palavra: string): string {
  if (!palavra) return palavra;
  return palavra[0].toUpperCase() + palavra.slice(1).toLowerCase();
}

/**
 * Reduz um nome completo a "Primeiro S." (primeiro nome + inicial do
 * sobrenome) para exibição pública sem vazar o nome completo (PII).
 * Nome único vira só o primeiro nome; vazio vira "Cliente".
 */
export function primeiroNomeInicial(nomeCompleto: string): string {
  const partes = nomeCompleto.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "Cliente";
  const primeiro = capitalizar(partes[0]);
  if (partes.length === 1) return primeiro;
  const inicial = partes[partes.length - 1][0].toUpperCase();
  return `${primeiro} ${inicial}.`;
}
