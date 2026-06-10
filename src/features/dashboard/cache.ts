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
      // Miss: varre e descarta entradas expiradas antes de inserir. Como a chave
      // é por usuário, sem isto o Map cresceria indefinidamente com chaves que
      // nunca mais são consultadas; o sweep limita a memória aos usuários ativos
      // dentro da janela do TTL.
      for (const [k, v] of store) {
        if (v.expiraEm <= agora) store.delete(k);
      }
      const valor = await calcular();
      store.set(chave, { valor, expiraEm: agora + opts.ttlMs });
      return valor;
    },
  };
}
