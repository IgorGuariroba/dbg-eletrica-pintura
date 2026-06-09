import { beforeAll, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/remarketing/route";

vi.mock("@/marketing/remarketing/processar-remarketing", () => ({
  processarRemarketing: vi.fn(async () => ({
    lembrete_orcamento: 1,
    rejeicao_orcamento: 0,
    reativacao_inativos: 2,
  })),
}));

describe("Cron Route - Remarketing (Slice G)", () => {
  beforeAll(() => {
    process.env.CRON_SECRET = "cron-test-secret";
  });

  it("retorna 401 se nao houver header de autorizacao", async () => {
    const res = await GET(new Request("https://dbg.app/api/cron/remarketing"));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("não autorizado");
  });

  it("retorna 401 se o token estiver incorreto", async () => {
    const res = await GET(
      new Request("https://dbg.app/api/cron/remarketing", {
        headers: { authorization: "Bearer token-errado" },
      }),
    );
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("não autorizado");
  });

  it("retorna 200 e executa com sucesso se o token estiver correto", async () => {
    const res = await GET(
      new Request("https://dbg.app/api/cron/remarketing", {
        headers: { authorization: "Bearer cron-test-secret" },
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      ok: true,
      lembrete_orcamento: 1,
      rejeicao_orcamento: 0,
      reativacao_inativos: 2,
    });
  });
});
