import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "cron_secret_test";

const gerarPreventivasDevidas = vi.fn();
vi.mock("@/assinatura/preventiva-geracao", () => ({ gerarPreventivasDevidas }));
// O repo Drizzle é mockado, então `db` não é usado pela rota nestes testes —
// não mockar @/db/client evita vazar o mock para o teardown global / outros
// arquivos no run serial (--no-file-parallelism).
vi.mock("@/assinatura/preventiva-geracao-drizzle", () => ({
  criarPreventivaGeracaoRepoDrizzle: () => ({}),
}));

async function chamar(headers: Record<string, string> = {}) {
  const { GET } = await import("@/app/api/cron/preventivas/route");
  return GET(
    new Request("https://dbg.test/api/cron/preventivas", { headers }),
  );
}

describe("GET /api/cron/preventivas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
    gerarPreventivasDevidas.mockResolvedValue({ geradas: 3 });
  });

  it("401 sem Authorization", async () => {
    const res = await chamar();
    expect(res.status).toBe(401);
    expect(gerarPreventivasDevidas).not.toHaveBeenCalled();
  });

  it("401 com Bearer errado", async () => {
    const res = await chamar({ authorization: "Bearer errado" });
    expect(res.status).toBe(401);
    expect(gerarPreventivasDevidas).not.toHaveBeenCalled();
  });

  it("200 com Bearer correto e dispara a geração", async () => {
    const res = await chamar({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ geradas: 3 });
    expect(gerarPreventivasDevidas).toHaveBeenCalledOnce();
  });

  it("401 quando CRON_SECRET não está configurado (fail-closed)", async () => {
    delete process.env.CRON_SECRET;
    const res = await chamar({ authorization: "Bearer qualquer" });
    expect(res.status).toBe(401);
  });
});
