import { describe, expect, it } from "vitest";
import { renderizarEmailBoasVindas } from "@/notificacao/email-service";

describe("renderizarEmailBoasVindas", () => {
  it("inclui nome do cliente, plano, benefícios e próxima cobrança", async () => {
    const html = await renderizarEmailBoasVindas({
      clienteNome: "Maria",
      planoNome: "Conforto",
      beneficios: ["4 preventivas/ano", "10% de desconto"],
      proximaCobranca: "07/07/2026",
    });

    expect(html).toContain("Maria");
    expect(html).toContain("Conforto");
    expect(html).toContain("4 preventivas/ano");
    expect(html).toContain("10% de desconto");
    expect(html).toContain("07/07/2026");
  });
});
