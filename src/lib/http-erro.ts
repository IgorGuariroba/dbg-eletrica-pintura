/**
 * Lê o corpo de uma resposta `fetch` que falhou e monta um `Error` com o
 * contexto + status + trecho do corpo. Concentra o idioma repetido de "se
 * !resp.ok, jogar erro descritivo" usado pelos gateways de integração externa.
 */
export async function erroResposta(
  resp: Response,
  contexto: string,
): Promise<Error> {
  const detalhe = await resp.text().catch(() => "");
  return new Error(`${contexto} (${resp.status}): ${detalhe.slice(0, 300)}`);
}
