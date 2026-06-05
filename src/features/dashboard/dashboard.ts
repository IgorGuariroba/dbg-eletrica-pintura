import { podeAcessarModulo } from "@/auth/require-modulo";
import type { Modulo, Role } from "@/auth/role-detection";
import type { Categoria } from "@/operacao/fila-repo";
import type { NotaTecnicoView } from "@/marketing/nota-tecnico-repo";
import { rankearTecnicos } from "./ranking";

export interface UsuarioDashboard {
  membroId: string;
  role: Role;
  modulos: Modulo[];
  isTecnico: boolean;
  especialidades: Categoria[];
}

export interface CardOperacao {
  criadasHoje: number;
  novasNaFila: number;
  aguardandoAprovacao: number;
  taxaAprovacao?: {
    aprovadas: number;
    totalOrcadas: number;
    pct: number | null;
  };
}

export interface CardMarketing {
  notaMediaGeral: number | null;
  alertasPendentes: number;
  ranking: NotaTecnicoView[];
}

export interface CardGarantias {
  chamadosAbertos: number;
  resolvidosNoMes: number;
  ativas: number;
}

export interface CardFinanceiro {
  inadimplenciaMais7Dias: number;
}

export interface CardCatalogo {
  servicosAtivos: number;
}

export interface CardEquipe {
  tecnicosAtivos: number;
  membrosInternos: number;
}

export interface CardTecnico {
  atribuidasAMim: number;
  minhaFila: number;
}

export interface Dashboard {
  operacao?: CardOperacao;
  marketing?: CardMarketing;
  garantias?: CardGarantias;
  financeiro?: CardFinanceiro;
  catalogo?: CardCatalogo;
  equipe?: CardEquipe;
  tecnico?: CardTecnico;
}

export interface DashboardRepo {
  contarServicosAtivos(): Promise<number>;
  contarTecnicosAtivos(): Promise<number>;
  contarMembrosInternos(): Promise<number>;
  contarOsCriadasHoje(): Promise<number>;
  contarOsNovasNaFila(): Promise<number>;
  contarOsAguardandoAprovacao(): Promise<number>;
  contarOsAtribuidasA(tecnicoId: string): Promise<number>;
  contarMinhaFila(especialidades: Categoria[]): Promise<number>;
  contarOsOrcadas30d(): Promise<number>;
  contarOsAprovadas30d(): Promise<number>;
  obterNotaMediaGeral(): Promise<number | null>;
  contarAlertasPendentes(): Promise<number>;
  listarNotasPorTecnico(): Promise<NotaTecnicoView[]>;
  contarChamadosGarantiaAbertos(): Promise<number>;
  contarChamadosGarantiaResolvidosNoMes(): Promise<number>;
  contarGarantiasAtivas(): Promise<number>;
  contarInadimplenciaMais7Dias(): Promise<number>;
}

export async function montarDashboard(
  usuario: UsuarioDashboard,
  repo: DashboardRepo,
): Promise<Dashboard> {
  const dash: Dashboard = {};

  if (podeAcessarModulo("OPERACAO", usuario)) {
    const [
      criadasHoje,
      novasNaFila,
      aguardandoAprovacao,
      totalOrcadas,
      aprovadas,
    ] = await Promise.all([
      repo.contarOsCriadasHoje(),
      repo.contarOsNovasNaFila(),
      repo.contarOsAguardandoAprovacao(),
      repo.contarOsOrcadas30d(),
      repo.contarOsAprovadas30d(),
    ]);

    const pct = totalOrcadas === 0 ? null : aprovadas / totalOrcadas;

    dash.operacao = {
      criadasHoje,
      novasNaFila,
      aguardandoAprovacao,
      taxaAprovacao: {
        aprovadas,
        totalOrcadas,
        pct,
      },
    };
  }

  if (podeAcessarModulo("MARKETING", usuario)) {
    const [notaMediaGeral, alertasPendentes, notasTecnicos] = await Promise.all([
      repo.obterNotaMediaGeral(),
      repo.contarAlertasPendentes(),
      repo.listarNotasPorTecnico(),
    ]);

    dash.marketing = {
      notaMediaGeral,
      alertasPendentes,
      ranking: rankearTecnicos(notasTecnicos, { minAvaliacoes: 5, topN: 5 }),
    };
  }

  if (podeAcessarModulo("GARANTIAS", usuario)) {
    const [chamadosAbertos, resolvidosNoMes, ativas] = await Promise.all([
      repo.contarChamadosGarantiaAbertos(),
      repo.contarChamadosGarantiaResolvidosNoMes(),
      repo.contarGarantiasAtivas(),
    ]);

    dash.garantias = {
      chamadosAbertos,
      resolvidosNoMes,
      ativas,
    };
  }

  if (podeAcessarModulo("FINANCEIRO", usuario)) {
    const inadimplenciaMais7Dias = await repo.contarInadimplenciaMais7Dias();
    dash.financeiro = {
      inadimplenciaMais7Dias,
    };
  }

  if (podeAcessarModulo("CATALOGO", usuario)) {
    dash.catalogo = { servicosAtivos: await repo.contarServicosAtivos() };
  }

  if (podeAcessarModulo("EQUIPE", usuario)) {
    dash.equipe = {
      tecnicosAtivos: await repo.contarTecnicosAtivos(),
      membrosInternos: await repo.contarMembrosInternos(),
    };
  }

  // Técnico precisa de membroId real: admin raiz é isTecnico mas não tem
  // registro em `membro` (membroId vazio) — sem OS atribuíveis a ele.
  if (usuario.isTecnico && usuario.membroId) {
    dash.tecnico = {
      atribuidasAMim: await repo.contarOsAtribuidasA(usuario.membroId),
      minhaFila: await repo.contarMinhaFila(usuario.especialidades),
    };
  }

  return dash;
}
