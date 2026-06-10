import { describe, expect, it, vi } from "vitest";
import { criarCacheTtl } from "@/features/dashboard/cache";

describe("criarCacheTtl", () => {
  it("reaproveita o valor enquanto não expira (não recomputa)", async () => {
    let agora = 0;
    const cache = criarCacheTtl<number>({ ttlMs: 60_000, agora: () => agora });
    const calcular = vi.fn(async () => 42);

    expect(await cache.resolver("k", calcular)).toBe(42);
    agora = 59_000; // dentro da janela de 60s
    expect(await cache.resolver("k", calcular)).toBe(42);
    expect(calcular).toHaveBeenCalledTimes(1);
  });

  it("recomputa após o TTL expirar", async () => {
    let agora = 0;
    const cache = criarCacheTtl<number>({ ttlMs: 60_000, agora: () => agora });
    const calcular = vi.fn(async () => agora);

    await cache.resolver("k", calcular);
    agora = 61_000; // passou da janela
    await cache.resolver("k", calcular);
    expect(calcular).toHaveBeenCalledTimes(2);
  });

  it("isola chaves diferentes (um módulo não serve o cache de outro)", async () => {
    const cache = criarCacheTtl<string>({ ttlMs: 60_000, agora: () => 0 });
    expect(await cache.resolver("a", async () => "A")).toBe("A");
    expect(await cache.resolver("b", async () => "B")).toBe("B");
  });
});
