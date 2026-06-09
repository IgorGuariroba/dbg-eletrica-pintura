import { describe, expect, it } from "vitest";
import {
  enviarBoasVindas,
  enviarBoasVindasCombo,
} from "@/assinatura/enviar-boas-vindas";
import type { DadosBoasVindas } from "@/assinatura/enviar-boas-vindas";

function dados(over: Partial<DadosBoasVindas> = {}): DadosBoasVindas {
  return {
    clienteNome: "Maria",
    clienteEmail: "maria@x.com",
    planoNome: "Conforto",
    beneficios: "Atendimento prioritário\n\nRelatório fotográfico",
    ...over,
  };
}

describe("enviarBoasVindas", () => {
  it("envia o e-mail com benefícios parseados e próxima cobrança", async () => {
    const enviados: { para: string; assunto: string; html: string }[] = [];
    const out = await enviarBoasVindas("pre-1", {
      carregar: async () => dados(),
      obterProximaCobranca: async () => "2026-07-07T12:00:00Z",
      enviar: async (i) => void enviados.push(i),
    });

    expect(out.status).toBe("sent");
    expect(enviados).toHaveLength(1);
    expect(enviados[0].para).toBe("maria@x.com");
    expect(enviados[0].html).toContain("Conforto");
    expect(enviados[0].html).toContain("Atendimento prioritário");
    expect(enviados[0].html).toContain("Relatório fotográfico");
    expect(enviados[0].html).toContain("07/07/2026");
  });

  it("usa 'a confirmar' quando não há data de próxima cobrança", async () => {
    const enviados: { html: string }[] = [];
    await enviarBoasVindas("pre-1", {
      carregar: async () => dados(),
      obterProximaCobranca: async () => undefined,
      enviar: async (i) => void enviados.push(i),
    });
    expect(enviados[0].html).toContain("a confirmar");
  });

  it("pula quando a assinatura não é encontrada", async () => {
    let chamou = false;
    const out = await enviarBoasVindas("pre-x", {
      carregar: async () => undefined,
      enviar: async () => void (chamou = true),
    });
    expect(out).toEqual({ status: "skipped", motivo: "assinatura não encontrada" });
    expect(chamou).toBe(false);
  });

  it("pula quando o cliente não tem e-mail", async () => {
    let chamou = false;
    const out = await enviarBoasVindas("pre-1", {
      carregar: async () => dados({ clienteEmail: null }),
      enviar: async () => void (chamou = true),
    });
    expect(out).toEqual({ status: "skipped", motivo: "cliente sem e-mail" });
    expect(chamou).toBe(false);
  });
});

describe("enviarBoasVindasCombo", () => {
  it("envia carregando pela assinatura (sem preapproval) e cobrança 'a confirmar'", async () => {
    const enviados: { para: string; html: string }[] = [];
    const idsCarregados: string[] = [];

    const out = await enviarBoasVindasCombo("ass-1", {
      carregar: async (id) => {
        idsCarregados.push(id);
        return dados();
      },
      enviar: async (i) => void enviados.push(i),
    });

    expect(out.status).toBe("sent");
    expect(idsCarregados).toEqual(["ass-1"]);
    expect(enviados[0].para).toBe("maria@x.com");
    // Combo não tem pre-approval no MP — nunca consulta próxima cobrança.
    expect(enviados[0].html).toContain("a confirmar");
  });
});
