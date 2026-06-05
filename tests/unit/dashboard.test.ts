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
    contarOsOrcadas30d: vi.fn(async () => 0),
    contarOsAprovadas30d: vi.fn(async () => 0),
    obterNotaMediaGeral: vi.fn(async () => null),
    contarAlertasPendentes: vi.fn(async () => 0),
    listarNotasPorTecnico: vi.fn(async () => []),
    contarChamadosGarantiaAbertos: vi.fn(async () => 0),
    contarChamadosGarantiaResolvidosNoMes: vi.fn(async () => 0),
    contarGarantiasAtivas: vi.fn(async () => 0),
    contarInadimplenciaMais7Dias: vi.fn(async () => 0),
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

  it("membro com módulo OPERACAO vê o card de Operação com taxa de aprovação", async () => {
    const repo = repoFake({
      contarOsCriadasHoje: vi.fn(async () => 3),
      contarOsNovasNaFila: vi.fn(async () => 5),
      contarOsAguardandoAprovacao: vi.fn(async () => 2),
      contarOsOrcadas30d: vi.fn(async () => 4),
      contarOsAprovadas30d: vi.fn(async () => 3),
    });
    const dash = await montarDashboard(usuario({ modulos: ["OPERACAO"] }), repo);

    expect(dash.operacao).toEqual({
      criadasHoje: 3,
      novasNaFila: 5,
      aguardandoAprovacao: 2,
      taxaAprovacao: {
        aprovadas: 3,
        totalOrcadas: 4,
        pct: 0.75,
      },
    });
    expect(dash.tecnico).toBeUndefined();
  });

  it("taxa de aprovação com zero ORÇADAS resulta em pct null", async () => {
    const repo = repoFake({
      contarOsOrcadas30d: vi.fn(async () => 0),
      contarOsAprovadas30d: vi.fn(async () => 0),
    });
    const dash = await montarDashboard(usuario({ modulos: ["OPERACAO"] }), repo);

    expect(dash.operacao?.taxaAprovacao).toEqual({
      aprovadas: 0,
      totalOrcadas: 0,
      pct: null,
    });
  });

  it("membro com módulo MARKETING vê card de Marketing, e sem o módulo não vê", async () => {
    const repo = repoFake({
      obterNotaMediaGeral: vi.fn(async () => 4.2),
      contarAlertasPendentes: vi.fn(async () => 2),
      listarNotasPorTecnico: vi.fn(async () => []),
    });

    const dashCom = await montarDashboard(usuario({ modulos: ["MARKETING"] }), repo);
    expect(dashCom.marketing).toEqual({
      notaMediaGeral: 4.2,
      alertasPendentes: 2,
      ranking: [],
    });

    const dashSem = await montarDashboard(usuario({ modulos: [] }), repo);
    expect(dashSem.marketing).toBeUndefined();
  });

  it("membro com módulo GARANTIAS vê card de Garantias, e sem o módulo não vê", async () => {
    const repo = repoFake({
      contarChamadosGarantiaAbertos: vi.fn(async () => 2),
      contarChamadosGarantiaResolvidosNoMes: vi.fn(async () => 5),
      contarGarantiasAtivas: vi.fn(async () => 12),
    });

    const dashCom = await montarDashboard(usuario({ modulos: ["GARANTIAS"] }), repo);
    expect(dashCom.garantias).toEqual({
      chamadosAbertos: 2,
      resolvidosNoMes: 5,
      ativas: 12,
    });

    const dashSem = await montarDashboard(usuario({ modulos: [] }), repo);
    expect(dashSem.garantias).toBeUndefined();
  });

  it("membro com módulo FINANCEIRO vê card Financeiro, e sem o módulo não vê", async () => {
    const repo = repoFake({
      contarInadimplenciaMais7Dias: vi.fn(async () => 4),
    });

    const dashCom = await montarDashboard(usuario({ modulos: ["FINANCEIRO"] }), repo);
    expect(dashCom.financeiro).toEqual({
      inadimplenciaMais7Dias: 4,
    });

    const dashSem = await montarDashboard(usuario({ modulos: [] }), repo);
    expect(dashSem.financeiro).toBeUndefined();
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
      usuario({ role: "admin_raiz", modulos: [], isTecnico: true, membroId: "" }),
      repoFake(),
    );

    expect(dash.operacao).toBeDefined();
    expect(dash.operacao?.taxaAprovacao).toBeDefined();
    expect(dash.marketing).toBeDefined();
    expect(dash.garantias).toBeDefined();
    expect(dash.financeiro).toBeDefined();
    expect(dash.catalogo).toBeDefined();
    expect(dash.equipe).toBeDefined();
    expect(dash.tecnico).toBeUndefined();
  });

  it("isTecnico sem membroId (ex: admin raiz) não gera card Técnico nem consulta repo", async () => {
    const atribuidas = vi.fn(async () => 0);
    const dash = await montarDashboard(
      usuario({ isTecnico: true, membroId: "" }),
      repoFake({ contarOsAtribuidasA: atribuidas }),
    );

    expect(dash.tecnico).toBeUndefined();
    expect(atribuidas).not.toHaveBeenCalled();
  });
});
