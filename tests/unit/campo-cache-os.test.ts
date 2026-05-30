import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CampoDB } from "@/features/campo/db";
import { lerOsCache, salvarOsCache } from "@/features/campo/cache-os";

function novaDb() {
  return new CampoDB(`test-${Math.random().toString(36).slice(2)}`);
}

function os(id: string, over = {}) {
  return {
    id,
    categoria: "ELETRICA",
    estado: "AGENDADA",
    clienteNome: "Maria",
    cidade: "São Paulo",
    uf: "SP",
    criadoEm: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("cache de OS do app de campo", () => {
  it("salva e relê as OS atribuídas do cache local", async () => {
    const db = novaDb();
    await salvarOsCache(db, [os("os-1"), os("os-2")]);

    const lidas = await lerOsCache(db);

    expect(lidas.map((o) => o.id).sort()).toEqual(["os-1", "os-2"]);
    expect(lidas[0].cacheEm).toBeTypeOf("string");
    db.close();
  });

  it("refresh substitui o cache — OS que saiu da lista do servidor some", async () => {
    const db = novaDb();
    await salvarOsCache(db, [os("os-1"), os("os-2")]);
    await salvarOsCache(db, [os("os-2"), os("os-3")]);

    const lidas = await lerOsCache(db);

    expect(lidas.map((o) => o.id).sort()).toEqual(["os-2", "os-3"]);
    db.close();
  });

  it("ordena por criadoEm decrescente (mais recente primeiro)", async () => {
    const db = novaDb();
    await salvarOsCache(db, [
      os("antiga", { criadoEm: "2026-01-01T00:00:00.000Z" }),
      os("nova", { criadoEm: "2026-03-01T00:00:00.000Z" }),
    ]);

    const lidas = await lerOsCache(db);

    expect(lidas.map((o) => o.id)).toEqual(["nova", "antiga"]);
    db.close();
  });
});
