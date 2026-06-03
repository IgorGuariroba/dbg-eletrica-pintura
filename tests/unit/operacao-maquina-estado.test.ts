import { describe, expect, it } from "vitest";
import {
  transicionar,
  TransicaoInvalidaError,
  type ContextoOs,
} from "@/operacao/maquina-estado";
import type { EstadoOs } from "@/operacao/orcamento-repo";

/**
 * Percorre um caminho de estados aplicando transicionar passo a passo,
 * acumulando o histórico. Lança se qualquer transição for inválida.
 */
function percorrer(
  ctx: Omit<ContextoOs, "estado" | "historico">,
  caminho: EstadoOs[],
): void {
  const historico: EstadoOs[] = [caminho[0]];
  for (let i = 1; i < caminho.length; i++) {
    transicionar(
      { ...ctx, estado: caminho[i - 1], historico: [...historico] },
      caminho[i],
      "ana@dbg.com",
    );
    historico.push(caminho[i]);
  }
}

describe("transicionar", () => {
  it("avança um passo válido do caminho NORMAL (NOVA → ORCADA)", () => {
    const registro = transicionar(
      { tipo: "NORMAL", estado: "NOVA", historico: ["NOVA"] },
      "ORCADA",
      "ana@dbg.com",
    );

    expect(registro.estadoAnterior).toBe("NOVA");
    expect(registro.estadoNovo).toBe("ORCADA");
    expect(registro.atorEmail).toBe("ana@dbg.com");
  });

  it("rejeita transição inválida com erro tipado (NOVA → EM_EXECUCAO)", () => {
    expect(() =>
      transicionar(
        { tipo: "NORMAL", estado: "NOVA", historico: ["NOVA"] },
        "EM_EXECUCAO",
        "ana@dbg.com",
      ),
    ).toThrow(TransicaoInvalidaError);
  });

  it("valida o caminho NORMAL ponta-a-ponta", () => {
    expect(() =>
      percorrer({ tipo: "NORMAL" }, [
        "NOVA",
        "ORCADA",
        "APROVADA",
        "AGENDADA",
        "A_CAMINHO",
        "NO_LOCAL",
        "EM_EXECUCAO",
        "CONCLUIDA",
        "PAGA",
      ]),
    ).not.toThrow();
  });

  it("valida o caminho EXPRESS (APROVADA → EM_EXECUCAO direta)", () => {
    expect(() =>
      percorrer({ tipo: "EXPRESS" }, [
        "ORCADA",
        "APROVADA",
        "EM_EXECUCAO",
        "CONCLUIDA",
        "PAGA",
      ]),
    ).not.toThrow();
  });

  it("valida COMPLEMENTAR presencial (APROVADA → EM_EXECUCAO direta)", () => {
    expect(() =>
      percorrer({ tipo: "COMPLEMENTAR", presencial: true }, [
        "ORCADA",
        "APROVADA",
        "EM_EXECUCAO",
        "CONCLUIDA",
        "PAGA",
      ]),
    ).not.toThrow();
  });

  it("valida COMPLEMENTAR ausente (passa por AGENDADA)", () => {
    expect(() =>
      percorrer({ tipo: "COMPLEMENTAR" }, [
        "ORCADA",
        "APROVADA",
        "AGENDADA",
        "A_CAMINHO",
        "NO_LOCAL",
        "EM_EXECUCAO",
        "CONCLUIDA",
        "PAGA",
      ]),
    ).not.toThrow();
  });

  it("permite Visita Técnica: APROVADA → EM_EXECUCAO quando NO_LOCAL no histórico", () => {
    expect(() =>
      transicionar(
        {
          tipo: "NORMAL",
          estado: "APROVADA",
          historico: ["NOVA", "ORCADA", "A_CAMINHO", "NO_LOCAL", "APROVADA"],
        },
        "EM_EXECUCAO",
        "ana@dbg.com",
      ),
    ).not.toThrow();
  });

  it("rejeita COMPLEMENTAR ausente tentando execução direta sem NO_LOCAL", () => {
    expect(() =>
      transicionar(
        { tipo: "COMPLEMENTAR", estado: "APROVADA", historico: ["APROVADA"] },
        "EM_EXECUCAO",
        "ana@dbg.com",
      ),
    ).toThrow(TransicaoInvalidaError);
  });

  it("rejeita pulo de etapa (AGENDADA → CONCLUIDA)", () => {
    expect(() =>
      transicionar(
        { tipo: "NORMAL", estado: "AGENDADA", historico: ["AGENDADA"] },
        "CONCLUIDA",
        "ana@dbg.com",
      ),
    ).toThrow(TransicaoInvalidaError);
  });

  it.each(["PREVENTIVA", "GARANTIA"] as const)(
    "valida o caminho %s (AGENDADA → CONCLUIDA, sem PAGA)",
    (tipo) => {
      expect(() =>
        percorrer({ tipo }, [
          "AGENDADA",
          "A_CAMINHO",
          "NO_LOCAL",
          "EM_EXECUCAO",
          "CONCLUIDA",
        ]),
      ).not.toThrow();
    },
  );

  it.each(["PREVENTIVA", "GARANTIA"] as const)(
    "rejeita %s CONCLUIDA → PAGA (sem custo)",
    (tipo) => {
      expect(() =>
        transicionar(
          { tipo, estado: "CONCLUIDA", historico: ["CONCLUIDA"] },
          "PAGA",
          "ana@dbg.com",
        ),
      ).toThrow(TransicaoInvalidaError);
    },
  );

  it("permite APROVADA → A_CAMINHO direto (técnico sai sem agendar)", () => {
    expect(() =>
      transicionar(
        { tipo: "NORMAL", estado: "APROVADA", historico: ["APROVADA"] },
        "A_CAMINHO",
        "ana@dbg.com",
      ),
    ).not.toThrow();
  });

  it("carrega a geolocalização no registro quando informada", () => {
    const registro = transicionar(
      { tipo: "NORMAL", estado: "APROVADA", historico: ["APROVADA"] },
      "A_CAMINHO",
      "ana@dbg.com",
      null,
      new Date(),
      { lat: -23.5, lon: -46.6 },
    );
    expect(registro.lat).toBe(-23.5);
    expect(registro.lon).toBe(-46.6);
  });

  describe("GARANTIA_ABERTA transitions", () => {
    it.each(["NORMAL", "EXPRESS", "COMPLEMENTAR"] as const)(
      "permite PAGA → GARANTIA_ABERTA para tipo pago %s",
      (tipo) => {
        const registro = transicionar(
          { tipo, estado: "PAGA", historico: ["PAGA"] },
          "GARANTIA_ABERTA",
          "admin@dbg.com",
        );
        expect(registro.estadoAnterior).toBe("PAGA");
        expect(registro.estadoNovo).toBe("GARANTIA_ABERTA");
      },
    );

    it("permite CONCLUIDA → GARANTIA_ABERTA para tipo GARANTIA", () => {
      const registro = transicionar(
        { tipo: "GARANTIA", estado: "CONCLUIDA", historico: ["CONCLUIDA"] },
        "GARANTIA_ABERTA",
        "admin@dbg.com",
      );
      expect(registro.estadoAnterior).toBe("CONCLUIDA");
      expect(registro.estadoNovo).toBe("GARANTIA_ABERTA");
    });

    it("rejeita CONCLUIDA → GARANTIA_ABERTA para tipo NORMAL (pago deve ir para PAGA primeiro)", () => {
      expect(() =>
        transicionar(
          { tipo: "NORMAL", estado: "CONCLUIDA", historico: ["CONCLUIDA"] },
          "GARANTIA_ABERTA",
          "admin@dbg.com",
        ),
      ).toThrow(TransicaoInvalidaError);
    });

    it.each(["PREVENTIVA", "GARANTIA"] as const)(
      "rejeita PAGA → GARANTIA_ABERTA para tipo sem pagamento %s",
      (tipo) => {
        expect(() =>
          transicionar(
            { tipo, estado: "PAGA", historico: ["PAGA"] },
            "GARANTIA_ABERTA",
            "admin@dbg.com",
          ),
        ).toThrow(TransicaoInvalidaError);
      },
    );

    it("rejeita qualquer transição a partir de GARANTIA_ABERTA (terminal)", () => {
      expect(() =>
        transicionar(
          { tipo: "NORMAL", estado: "GARANTIA_ABERTA", historico: ["GARANTIA_ABERTA"] },
          "NOVA",
          "admin@dbg.com",
        ),
      ).toThrow(TransicaoInvalidaError);
    });
  });
});

