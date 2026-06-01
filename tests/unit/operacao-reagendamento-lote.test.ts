import { describe, expect, it, vi } from "vitest";
import { cancelarLoteAdmin } from "@/operacao/reagendamento-lote";
import type { ReagendamentoRepo } from "@/operacao/reagendamento";
import { MotivoObrigatorioError } from "@/operacao/reagendamento";

describe("cancelarLoteAdmin", () => {
  const admin = { email: "admin@dbg.com" };
  const motivo = "cliente desistiu de todos os servicos";
  const agora = new Date("2026-06-01T12:00:00Z");

  function repoFake(states: Record<string, string>): ReagendamentoRepo {
    return {
      carregar: vi.fn(async (osId) => {
        const state = states[osId];
        if (!state) return null;
        return {
          estado: state as any,
          tecnicoId: "tec-1",
          agendadoPara: new Date("2026-06-02T10:00:00Z"),
        };
      }),
      cancelar: vi.fn(async () => {}),
      reagendar: vi.fn(async () => {}),
      cancelarParaAprovada: vi.fn(async () => {}),
    };
  }

  it("permite cancelar OS pre-execucao (APROVADA, AGENDADA, A_CAMINHO, NO_LOCAL) com motivo", async () => {
    const repo = repoFake({
      "os-1": "APROVADA",
      "os-2": "AGENDADA",
      "os-3": "A_CAMINHO",
      "os-4": "NO_LOCAL",
    });

    const result = await cancelarLoteAdmin(["os-1", "os-2", "os-3", "os-4"], admin, motivo, repo, agora);

    expect(result).toEqual([
      { osId: "os-1", ok: true },
      { osId: "os-2", ok: true },
      { osId: "os-3", ok: true },
      { osId: "os-4", ok: true },
    ]);

    expect(repo.cancelar).toHaveBeenCalledTimes(4);
    expect(repo.cancelar).toHaveBeenNthCalledWith(
      1,
      "os-1",
      "CANCELADA",
      expect.objectContaining({
        estadoAnterior: "APROVADA",
        estadoNovo: "CANCELADA",
        atorEmail: "admin@dbg.com",
        motivo,
        em: agora,
      }),
    );
  });

  it("não cancela OS em execucao ou concluida e retorna ok:false, continuando o lote", async () => {
    const repo = repoFake({
      "os-1": "AGENDADA",
      "os-2": "EM_EXECUCAO",
      "os-3": "CONCLUIDA",
      "os-4": "NO_LOCAL",
    });

    const result = await cancelarLoteAdmin(["os-1", "os-2", "os-3", "os-4"], admin, motivo, repo, agora);

    expect(result).toEqual([
      { osId: "os-1", ok: true },
      { osId: "os-2", ok: false, erro: "OS no estado EM_EXECUCAO não pode ser cancelada" },
      { osId: "os-3", ok: false, erro: "OS no estado CONCLUIDA não pode ser cancelada" },
      { osId: "os-4", ok: true },
    ]);

    expect(repo.cancelar).toHaveBeenCalledTimes(2);
  });

  it("exige motivo com pelo menos 10 caracteres e lanca erro para todas", async () => {
    const repo = repoFake({ "os-1": "AGENDADA" });
    await expect(
      cancelarLoteAdmin(["os-1"], admin, "curto", repo, agora),
    ).rejects.toThrow(MotivoObrigatorioError);

    expect(repo.cancelar).not.toHaveBeenCalled();
  });

  it("lote de 5 OS com motivo unico -> 5 resultados ok:true", async () => {
    const repo = repoFake({
      "os-1": "AGENDADA",
      "os-2": "AGENDADA",
      "os-3": "AGENDADA",
      "os-4": "AGENDADA",
      "os-5": "AGENDADA",
    });

    const result = await cancelarLoteAdmin(
      ["os-1", "os-2", "os-3", "os-4", "os-5"],
      admin,
      motivo,
      repo,
      agora,
    );

    expect(result).toHaveLength(5);
    expect(result.every((r) => r.ok)).toBe(true);
    expect(repo.cancelar).toHaveBeenCalledTimes(5);
  });
});
