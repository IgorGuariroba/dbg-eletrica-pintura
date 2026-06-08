import { describe, expect, it } from "vitest";
import { aplicarDescontoPlano } from "@/operacao/desconto-plano";

describe("aplicarDescontoPlano", () => {
  it("aplica o percentual sobre o total", () => {
    const r = aplicarDescontoPlano("100.00", "10");
    expect(r.desconto).toBe("10.00");
    expect(r.totalLiquido).toBe("90.00");
  });

  it("percentual 0 não desconta nada", () => {
    const r = aplicarDescontoPlano("250.00", "0");
    expect(r.desconto).toBe("0.00");
    expect(r.totalLiquido).toBe("250.00");
  });

  it("arredonda o desconto para 2 casas", () => {
    // 15% de 99.90 = 14.985 -> 14.99 (desconto), líquido 84.91
    const r = aplicarDescontoPlano("99.90", "15");
    expect(r.desconto).toBe("14.99");
    expect(r.totalLiquido).toBe("84.91");
  });
});
