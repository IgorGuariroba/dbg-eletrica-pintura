import { describe, expect, it, vi } from "vitest";
import { montarDashboard } from "@/features/dashboard/dashboard";
import type {
  DashboardRepo,
  UsuarioDashboard,
} from "@/features/dashboard/dashboard";

function repoFake(over: Partial<DashboardRepo> = {}): DashboardRepo {
  return {
    contarServicosAtivos: vi.fn(async () => 0),
    contarTecnicosAtivos: vi.fn(async () => 0),
    contarMembrosInternos: vi.fn(async () => 0),
    contarOsCriadasHoje: vi.fn(async () => 0),
    contarOsNovasNaFila: vi.fn(async () => 0),
    contarOsAguardandoAprovacao: vi.fn(async () => 0),
    contarOsAtribuidasA: vi.fn(async () => 0),
    contarMinhaFila: vi.fn(async () => 0),
    ...over,
  };
}

function usuario(over: Partial<UsuarioDashboard> = {}): UsuarioDashboard {
  return {
    membroId: "m-1",
    role: "membro_interno",
    modulos: [],
    isTecnico: false,
    especialidades: [],
    ...over,
  };
}

describe("montarDashboard", () => {
  it("membro só com módulo CATALOGO vê só o card de Catálogo", async () => {
    const repo = repoFake({ contarServicosAtivos: vi.fn(async () => 7) });
    const dash = await montarDashboard(usuario({ modulos: ["CATALOGO"] }), repo);

    expect(dash.catalogo).toEqual({ servicosAtivos: 7 });
    expect(dash.operacao).toBeUndefined();
    expect(dash.equipe).toBeUndefined();
    expect(dash.tecnico).toBeUndefined();
  });

  it("membro só com módulo EQUIPE vê só o card de Equipe", async () => {
    const repo = repoFake({
      contarTecnicosAtivos: vi.fn(async () => 4),
      contarMembrosInternos: vi.fn(async () => 2),
    });
    const dash = await montarDashboard(usuario({ modulos: ["EQUIPE"] }), repo);

    expect(dash.equipe).toEqual({ tecnicosAtivos: 4, membrosInternos: 2 });
    expect(dash.catalogo).toBeUndefined();
  });

  it("membro com módulo OPERACAO vê o card de Operação", async () => {
    const repo = repoFake({
      contarOsCriadasHoje: vi.fn(async () => 3),
      contarOsNovasNaFila: vi.fn(async () => 5),
      contarOsAguardandoAprovacao: vi.fn(async () => 2),
    });
    const dash = await montarDashboard(usuario({ modulos: ["OPERACAO"] }), repo);

    expect(dash.operacao).toEqual({
      criadasHoje: 3,
      novasNaFila: 5,
      aguardandoAprovacao: 2,
    });
    expect(dash.tecnico).toBeUndefined();
  });

  it("técnico sempre vê o card Técnico, mesmo sem módulos", async () => {
    const atribuidas = vi.fn(async () => 6);
    const minhaFila = vi.fn(async () => 9);
    const repo = repoFake({
      contarOsAtribuidasA: atribuidas,
      contarMinhaFila: minhaFila,
    });
    const dash = await montarDashboard(
      usuario({ isTecnico: true, especialidades: ["ELETRICA"] }),
      repo,
    );

    expect(dash.tecnico).toEqual({ atribuidasAMim: 6, minhaFila: 9 });
    expect(atribuidas).toHaveBeenCalledWith("m-1");
    expect(minhaFila).toHaveBeenCalledWith(["ELETRICA"]);
    expect(dash.operacao).toBeUndefined();
  });

  it("admin_raiz vê todos os cards de módulo, sem card Técnico", async () => {
    const dash = await montarDashboard(
      usuario({ role: "admin_raiz", modulos: [] }),
      repoFake(),
    );

    expect(dash.operacao).toBeDefined();
    expect(dash.catalogo).toBeDefined();
    expect(dash.equipe).toBeDefined();
    expect(dash.tecnico).toBeUndefined();
  });
});
