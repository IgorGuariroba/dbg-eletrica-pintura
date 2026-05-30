import { describe, expect, it } from "vitest";
import { rotularEstadoCliente } from "@/operacao/rotulo-estado";

describe("rotularEstadoCliente", () => {
  it("traduz os estados de campo para linguagem amigável", () => {
    expect(rotularEstadoCliente("A_CAMINHO")).toBe("Técnico a caminho");
    expect(rotularEstadoCliente("NO_LOCAL")).toBe("Técnico no local");
    expect(rotularEstadoCliente("EM_EXECUCAO")).toBe("Serviço em andamento");
    expect(rotularEstadoCliente("CONCLUIDA")).toBe("Serviço concluído");
  });

  it("mantém os rótulos da fase de orçamento", () => {
    expect(rotularEstadoCliente("ORCADA")).toBe("Aguardando sua aprovação");
    expect(rotularEstadoCliente("APROVADA")).toBe("Aprovado");
  });

  it("usa o próprio estado como fallback quando desconhecido", () => {
    expect(rotularEstadoCliente("DESCONHECIDO")).toBe("DESCONHECIDO");
  });
});
