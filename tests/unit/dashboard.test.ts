import { describe, expect, it, vi } from "vitest";
import { montarDashboard } from "@/features/dashboard/dashboard";
import type {
  DashboardRepo,
  UsuarioDashboard,
} from "@/features/dashboard/dashboard";

function vazio() {
  return { faturamento: "0.00", ticketMedio: "0.00", qtdPagamentos: 0 };
}

function repoFake(over: Partial<DashboardRepo> = {}): DashboardRepo {
  return {
    contarServicosAtivos: vi.fn(async () => 0),
    contarTecnicosAtivos: vi.fn(async () => 0),
    contarMembrosInternos: vi.fn(async () => 0),
    listarOsPorTecnicoMes: vi.fn(async () => []),
    listarTecnicosComUltimaAtribuicao: vi.fn(async () => []),
    contarOsCriadasHoje: vi.fn(async () => 0),
    contarOsNovasNaFila: vi.fn(async () => 0),
    contarOsAguardandoAprovacao: vi.fn(async () => 0),
    contarOsAtribuidasA: vi.fn(async () => 0),
    contarMinhaFila: vi.fn(async () => 0),
    contarOsOrcadas30d: vi.fn(async () => 0),
    contarOsAprovadas30d: vi.fn(async () => 0),
    contarOsConcluidas30d: vi.fn(async () => 0),
    tempoMedioNovaPagaSegundos: vi.fn(async () => null),
    contarOsPorEstado: vi.fn(async () => []),
    serieOsPorDia: vi.fn(async () => []),
    obterNotaMediaGeral: vi.fn(async () => null),
    contarAlertasPendentes: vi.fn(async () => 0),
    listarNotasPorTecnico: vi.fn(async () => []),
    contarSubmissoes30d: vi.fn(async () => 0),
    contarOrcamentosEnviados30d: vi.fn(async () => 0),
    listarServicosMaisPedidos: vi.fn(async () => []),
    remarketingAtivo: vi.fn(async () => false),
    contarRemarketingEnviadoMes: vi.fn(async () => 0),
    contarIndicacoesMes: vi.fn(async () => 0),
    somarCreditosResgatadosMes: vi.fn(async () => "0.00"),
    contarChamadosGarantiaAbertos: vi.fn(async () => 0),
    contarChamadosGarantiaResolvidosNoMes: vi.fn(async () => 0),
    contarGarantiasAtivas: vi.fn(async () => 0),
    contarChamadosGarantiaTotal: vi.fn(async () => 0),
    contarOsPagaElegiveisGarantia: vi.fn(async () => 0),
    contarInadimplenciaMais7Dias: vi.fn(async () => 0),
    listarAssinaturasAtivasComPreco: vi.fn(async () => []),
    contarAssinaturasCanceladasNoMes: vi.fn(async () => 0),
    contarAssinaturasAtivasInicioMes: vi.fn(async () => 0),
    resumoFaturamento: vi.fn(async () => ({
      dia: vazio(),
      semana: vazio(),
      mes: vazio(),
    })),
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

    expect(dash.equipe).toMatchObject({ tecnicosAtivos: 4, membrosInternos: 2 });
    expect(dash.catalogo).toBeUndefined();
  });

  it("card de Equipe traz OS por técnico no mês e os técnicos ociosos", async () => {
    const osPorTecnico = [
      { tecnicoId: "t1", nome: "Ana", total: 8 },
      { tecnicoId: "t2", nome: "Bia", total: 3 },
    ];
    const repo = repoFake({
      listarOsPorTecnicoMes: vi.fn(async () => osPorTecnico),
      // t1 nunca recebeu OS → ocioso; t2 recebeu hoje → ativo.
      listarTecnicosComUltimaAtribuicao: vi.fn(async () => [
        { tecnicoId: "t1", nome: "Ana", ultimaAtribuicao: null },
        { tecnicoId: "t2", nome: "Bia", ultimaAtribuicao: new Date() },
      ]),
    });
    const dash = await montarDashboard(usuario({ modulos: ["EQUIPE"] }), repo);

    expect(dash.equipe?.osPorTecnicoMes).toEqual(osPorTecnico);
    expect(dash.equipe?.ociosos.map((t) => t.tecnicoId)).toEqual(["t1"]);
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

    expect(dash.operacao).toMatchObject({
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

  it("card de Operação inclui taxa de conclusão (concluídas / aprovadas em 30d)", async () => {
    const repo = repoFake({
      contarOsAprovadas30d: vi.fn(async () => 8),
      contarOsConcluidas30d: vi.fn(async () => 6),
    });
    const dash = await montarDashboard(usuario({ modulos: ["OPERACAO"] }), repo);

    expect(dash.operacao?.taxaConclusao).toEqual({
      concluidas: 6,
      aprovadas: 8,
      pct: 0.75,
    });
  });

  it("card de Operação expõe o tempo médio NOVA→PAGA em segundos", async () => {
    const repo = repoFake({
      tempoMedioNovaPagaSegundos: vi.fn(async () => 172800),
    });
    const dash = await montarDashboard(usuario({ modulos: ["OPERACAO"] }), repo);

    expect(dash.operacao?.tempoMedioNovaPagaSegundos).toBe(172800);
  });

  it("card de Operação expõe a contagem de OS por estado (funil)", async () => {
    const funil = [
      { estado: "NOVA" as const, total: 5 },
      { estado: "ORCADA" as const, total: 3 },
      { estado: "PAGA" as const, total: 10 },
    ];
    const repo = repoFake({ contarOsPorEstado: vi.fn(async () => funil) });
    const dash = await montarDashboard(usuario({ modulos: ["OPERACAO"] }), repo);

    expect(dash.operacao?.funilEstados).toEqual(funil);
  });

  it("card de Operação inclui a série de OS criadas/concluídas por dia", async () => {
    const serie = [
      { dia: "2026-06-07", criadas: 4, concluidas: 2 },
      { dia: "2026-06-08", criadas: 1, concluidas: 3 },
    ];
    const serieOsPorDia = vi.fn(async () => serie);
    const repo = repoFake({ serieOsPorDia });
    const dash = await montarDashboard(usuario({ modulos: ["OPERACAO"] }), repo);

    expect(dash.operacao?.serie).toEqual(serie);
    expect(serieOsPorDia).toHaveBeenCalledWith(14);
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
    expect(dashCom.marketing).toMatchObject({
      notaMediaGeral: 4.2,
      alertasPendentes: 2,
      ranking: [],
    });

    const dashSem = await montarDashboard(usuario({ modulos: [] }), repo);
    expect(dashSem.marketing).toBeUndefined();
  });

  it("card Marketing monta o funil (submissões→orçados→aprovados→concluídos) em 30d", async () => {
    const repo = repoFake({
      contarSubmissoes30d: vi.fn(async () => 100),
      contarOrcamentosEnviados30d: vi.fn(async () => 60),
      contarOsAprovadas30d: vi.fn(async () => 30),
      contarOsConcluidas30d: vi.fn(async () => 24),
    });
    const dash = await montarDashboard(usuario({ modulos: ["MARKETING"] }), repo);

    expect(dash.marketing?.funil).toEqual([
      { nome: "submissoes", total: 100, conversao: null },
      { nome: "orcados", total: 60, conversao: 0.6 },
      { nome: "aprovados", total: 30, conversao: 0.5 },
      { nome: "concluidos", total: 24, conversao: 0.8 },
    ]);
  });

  it("card Marketing traz mais pedidos, remarketing, indicações e créditos resgatados", async () => {
    const maisPedidos = [
      { servicoId: "s1", nome: "Tomada", total: 12 },
      { servicoId: "s2", nome: "Pintura sala", total: 7 },
    ];
    const repo = repoFake({
      listarServicosMaisPedidos: vi.fn(async () => maisPedidos),
      remarketingAtivo: vi.fn(async () => true),
      contarRemarketingEnviadoMes: vi.fn(async () => 18),
      contarIndicacoesMes: vi.fn(async () => 5),
      somarCreditosResgatadosMes: vi.fn(async () => "150.00"),
    });
    const dash = await montarDashboard(usuario({ modulos: ["MARKETING"] }), repo);

    expect(dash.marketing?.servicosMaisPedidos).toEqual(maisPedidos);
    expect(dash.marketing?.remarketing).toEqual({ ativo: true, enviadosMes: 18 });
    expect(dash.marketing?.indicacoesMes).toBe(5);
    expect(dash.marketing?.creditosResgatadosMes).toBe("150.00");
  });

  it("membro com módulo GARANTIAS vê card de Garantias, e sem o módulo não vê", async () => {
    const repo = repoFake({
      contarChamadosGarantiaAbertos: vi.fn(async () => 2),
      contarChamadosGarantiaResolvidosNoMes: vi.fn(async () => 5),
      contarGarantiasAtivas: vi.fn(async () => 12),
    });

    const dashCom = await montarDashboard(usuario({ modulos: ["GARANTIAS"] }), repo);
    expect(dashCom.garantias).toMatchObject({
      chamadosAbertos: 2,
      resolvidosNoMes: 5,
      ativas: 12,
    });

    const dashSem = await montarDashboard(usuario({ modulos: [] }), repo);
    expect(dashSem.garantias).toBeUndefined();
  });

  it("card de Garantias calcula a taxa de acionamento (chamados / OS PAGA elegíveis)", async () => {
    const repo = repoFake({
      contarChamadosGarantiaTotal: vi.fn(async () => 3),
      contarOsPagaElegiveisGarantia: vi.fn(async () => 12),
    });
    const dash = await montarDashboard(usuario({ modulos: ["GARANTIAS"] }), repo);

    expect(dash.garantias?.taxaAcionamento).toEqual({
      chamados: 3,
      elegiveis: 12,
      pct: 0.25,
    });
  });

  it("membro com módulo FINANCEIRO vê card Financeiro, e sem o módulo não vê", async () => {
    const repo = repoFake({
      contarInadimplenciaMais7Dias: vi.fn(async () => 4),
    });

    const dashCom = await montarDashboard(usuario({ modulos: ["FINANCEIRO"] }), repo);
    expect(dashCom.financeiro).toMatchObject({
      inadimplenciaMais7Dias: 4,
    });

    const dashSem = await montarDashboard(usuario({ modulos: [] }), repo);
    expect(dashSem.financeiro).toBeUndefined();
  });

  it("card Financeiro expõe o MRR somado das assinaturas ativas", async () => {
    const repo = repoFake({
      listarAssinaturasAtivasComPreco: vi.fn(async () => [
        { preco: "99.90" },
        { preco: "149.90" },
      ]),
    });
    const dash = await montarDashboard(usuario({ modulos: ["FINANCEIRO"] }), repo);

    expect(dash.financeiro?.mrr).toBe("249.80");
  });

  it("card Financeiro calcula o churn mensal (canceladas / ativas no início do mês)", async () => {
    const repo = repoFake({
      contarAssinaturasCanceladasNoMes: vi.fn(async () => 3),
      contarAssinaturasAtivasInicioMes: vi.fn(async () => 12),
    });
    const dash = await montarDashboard(usuario({ modulos: ["FINANCEIRO"] }), repo);

    expect(dash.financeiro?.churn).toEqual({
      canceladasNoMes: 3,
      ativasInicioMes: 12,
      pct: 0.25,
    });
  });

  it("card Financeiro traz o faturamento (com ticket médio) por dia/semana/mês", async () => {
    const faturamento = {
      dia: { faturamento: "100.00", ticketMedio: "50.00", qtdPagamentos: 2 },
      semana: { faturamento: "700.00", ticketMedio: "70.00", qtdPagamentos: 10 },
      mes: { faturamento: "3000.00", ticketMedio: "60.00", qtdPagamentos: 50 },
    };
    const repo = repoFake({ resumoFaturamento: vi.fn(async () => faturamento) });
    const dash = await montarDashboard(usuario({ modulos: ["FINANCEIRO"] }), repo);

    expect(dash.financeiro?.faturamento).toEqual(faturamento);
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
