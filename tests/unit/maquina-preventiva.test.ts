import { describe, expect, it } from "vitest";
import type { EstadoOs } from "@/operacao/orcamento-repo";
import {
  TransicaoInvalidaError,
  transicionar,
  type ContextoOs,
} from "@/operacao/maquina-estado";

const ATOR = "sistema@dbg.eletrica.br";

function ctx(estado: EstadoOs, historico: EstadoOs[]): ContextoOs {
  return { tipo: "PREVENTIVA", estado, historico };
}

describe("máquina de estado — OS PREVENTIVA", () => {
  it("percorre AGENDADA → A_CAMINHO → NO_LOCAL → EM_EXECUCAO → CONCLUIDA", () => {
    const caminho: EstadoOs[] = [
      "AGENDADA",
      "A_CAMINHO",
      "NO_LOCAL",
      "EM_EXECUCAO",
      "CONCLUIDA",
    ];
    const historico: EstadoOs[] = ["AGENDADA"];
    for (let i = 0; i < caminho.length - 1; i++) {
      const de = caminho[i];
      const para = caminho[i + 1];
      const reg = transicionar(ctx(de, historico), para, ATOR);
      expect(reg.estadoNovo).toBe(para);
      historico.push(para);
    }
  });

  it("não permite CONCLUIDA → PAGA (preventiva não tem custo)", () => {
    const historico: EstadoOs[] = [
      "AGENDADA",
      "A_CAMINHO",
      "NO_LOCAL",
      "EM_EXECUCAO",
      "CONCLUIDA",
    ];
    expect(() => transicionar(ctx("CONCLUIDA", historico), "PAGA", ATOR)).toThrow(
      TransicaoInvalidaError,
    );
  });
});
