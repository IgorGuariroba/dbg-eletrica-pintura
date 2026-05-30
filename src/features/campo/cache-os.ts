import type { CampoDB, OsLocal } from "./db";

/**
 * Substitui o cache local pelas OS atribuídas atuais do técnico. Refresh
 * completo: o que sai da lista do servidor some do cache (a OS deixou de ser
 * dele). Operação atômica para o leitor nunca ver um estado parcial.
 */
export async function salvarOsCache(
  db: CampoDB,
  itens: Omit<OsLocal, "cacheEm">[],
): Promise<void> {
  const cacheEm = new Date().toISOString();
  await db.transaction("rw", db.os_local_cache, async () => {
    await db.os_local_cache.clear();
    await db.os_local_cache.bulkPut(itens.map((o) => ({ ...o, cacheEm })));
  });
}

/** Lê as OS do cache local, mais recentes primeiro. */
export async function lerOsCache(db: CampoDB): Promise<OsLocal[]> {
  const itens = await db.os_local_cache.toArray();
  return itens.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}
