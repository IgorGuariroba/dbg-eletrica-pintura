import { describe, expect, it } from "vitest";
import { exigirRateLimit, RateLimitExcedidoError } from "@/lib/rate-limit-guard";
import type { ConsumirInput, RateLimitRepo } from "@/lib/rate-limit";

function repoFake(permitido: boolean): { repo: RateLimitRepo; chamadas: ConsumirInput[] } {
  const chamadas: ConsumirInput[] = [];
  return {
    chamadas,
    repo: {
      async consumir(input) {
        chamadas.push(input);
        return { permitido };
      },
    },
  };
}

describe("exigirRateLimit", () => {
  it("resolve quando o consumo cabe na janela", async () => {
    const { repo } = repoFake(true);
    await expect(
      exigirRateLimit("cep", { limite: 10, janelaMs: 60_000 }, { repo, ip: "1.2.3.4" }),
    ).resolves.toBeUndefined();
  });

  it("lança RateLimitExcedidoError quando estoura o limite", async () => {
    const { repo } = repoFake(false);
    await expect(
      exigirRateLimit("cep", { limite: 10, janelaMs: 60_000 }, { repo, ip: "1.2.3.4" }),
    ).rejects.toBeInstanceOf(RateLimitExcedidoError);
  });

  it("compõe a chave como rota:ip e repassa limite/janela", async () => {
    const { repo, chamadas } = repoFake(true);
    await exigirRateLimit("upload", { limite: 15, janelaMs: 600_000 }, { repo, ip: "9.8.7.6" });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].chave).toBe("upload:9.8.7.6");
    expect(chamadas[0].limite).toBe(15);
    expect(chamadas[0].janelaMs).toBe(600_000);
  });
});
