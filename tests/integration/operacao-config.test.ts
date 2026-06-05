import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("OperacaoConfigRepo Drizzle — horário comercial", () => {
  let repo: import("@/operacao/config-repo").OperacaoConfigRepo;
  let original: import("@/operacao/config-repo").OperacaoConfig;

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    const { criarOperacaoConfigRepoDrizzle } = await import(
      "@/operacao/config-repo-drizzle"
    );
    repo = criarOperacaoConfigRepoDrizzle(dbMod.db);
    original = await repo.obter();
  });

  afterAll(async () => {
    if (repo && original) await repo.atualizar(original);
  });

  it("retorna defaults e persiste preço/km do deslocamento", async () => {
    await repo.atualizar({
      ...original,
      precoLitro: "7.50",
      kmPorLitro: "12",
    });
    const lido = await repo.obter();
    expect(Number(lido.precoLitro)).toBe(7.5);
    expect(Number(lido.kmPorLitro)).toBe(12);
  });

  it("persiste e relê o horário comercial por dia", async () => {
    await repo.atualizar({
      precoLitro: original.precoLitro,
      kmPorLitro: original.kmPorLitro,
      horarioComercial: {
        seg: { inicio: "08:00", fim: "18:00" },
        sab: { inicio: "08:00", fim: "12:00" },
        dom: null,
      },
    });

    const lido = await repo.obter();

    expect(lido.horarioComercial.seg).toEqual({ inicio: "08:00", fim: "18:00" });
    expect(lido.horarioComercial.sab).toEqual({ inicio: "08:00", fim: "12:00" });
    expect(lido.horarioComercial.dom ?? null).toBeNull();
  });

  it("C1 — tracer: atualiza googleReviewUrl e relê", async () => {
    await repo.atualizar({
      ...original,
      googleReviewUrl: "https://g.page/dbg-review",
    });
    const lido = await repo.obter();
    expect(lido.googleReviewUrl).toBe("https://g.page/dbg-review");
  });

  it("C2: config sem googleReviewUrl retorna null", async () => {
    await repo.atualizar({
      ...original,
      googleReviewUrl: null,
    });
    const lido = await repo.obter();
    expect(lido.googleReviewUrl).toBeNull();
  });
});

