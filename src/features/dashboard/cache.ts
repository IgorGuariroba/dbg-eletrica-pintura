// Cache em memória com TTL para o dashboard. O painel agrega dezenas de queries;
// um TTL curto (60s) absorve refreshes/navegações repetidas sem reexecutar tudo.
// `agora` é injetável para testes determinísticos.

export interface CacheTtl<T> {
  resolver(chave: string, calcular: () => Promise<T>): Promise<T>;
}

export function criarCacheTtl<T>(opts: {
  ttlMs: number;
  agora?: () => number;
}): CacheTtl<T> {
  const relogio = opts.agora ?? Date.now;
  const store = new Map<string, { valor: T; expiraEm: number }>();

  return {
    async resolver(chave, calcular) {
      const agora = relogio();
      const hit = store.get(chave);
      if (hit && hit.expiraEm > agora) return hit.valor;
      const valor = await calcular();
      store.set(chave, { valor, expiraEm: agora + opts.ttlMs });
      return valor;
    },
  };
}
