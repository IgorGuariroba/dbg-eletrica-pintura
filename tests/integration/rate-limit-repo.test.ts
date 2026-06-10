import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RateLimitRepo } from "@/lib/rate-limit";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("RateLimitRepo Drizzle", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: RateLimitRepo;
  // Marcador único por arquivo para isolar do DB dev compartilhado.
  const TAG = `rl-${Math.random().toString(36).slice(2, 8)}`;
  const JANELA_MS = 60_000;
  const agora = new Date("2026-06-10T12:00:00Z");

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    const { criarRateLimitRepoDrizzle } = await import("@/lib/rate-limit-drizzle");
    dbRaw = dbMod.db;
    repo = criarRateLimitRepoDrizzle(dbMod.db);
  });

  afterAll(async () => {
    const { like } = await import("drizzle-orm");
    await dbRaw
      .delete(schema.rateLimit)
      .where(like(schema.rateLimit.chave, `${TAG}%`));
  });

  it("permite até o limite e bloqueia a chamada seguinte na mesma janela", async () => {
    const chave = `${TAG}:cep:1.2.3.4`;
    const consumir = () =>
      repo.consumir({ chave, limite: 3, janelaMs: JANELA_MS, agora });

    expect((await consumir()).permitido).toBe(true);
    expect((await consumir()).permitido).toBe(true);
    expect((await consumir()).permitido).toBe(true);
    expect((await consumir()).permitido).toBe(false);
  });

  it("janela expirada reinicia a contagem", async () => {
    const chave = `${TAG}:cep:5.6.7.8`;
    const consumir = (em: Date) =>
      repo.consumir({ chave, limite: 1, janelaMs: JANELA_MS, agora: em });

    expect((await consumir(agora)).permitido).toBe(true);
    expect((await consumir(agora)).permitido).toBe(false);

    const depoisDaJanela = new Date(agora.getTime() + JANELA_MS + 1);
    expect((await consumir(depoisDaJanela)).permitido).toBe(true);
  });

  it("chaves diferentes têm contadores independentes", async () => {
    const consumir = (chave: string) =>
      repo.consumir({ chave: `${TAG}:${chave}`, limite: 1, janelaMs: JANELA_MS, agora });

    expect((await consumir("cep:9.9.9.9")).permitido).toBe(true);
    expect((await consumir("cep:9.9.9.9")).permitido).toBe(false);
    expect((await consumir("cep:8.8.8.8")).permitido).toBe(true);
    expect((await consumir("upload:9.9.9.9")).permitido).toBe(true);
  });
});
