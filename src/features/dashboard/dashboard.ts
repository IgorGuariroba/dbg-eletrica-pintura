import { podeAcessarModulo } from "@/auth/require-modulo";
import type { Modulo, Role } from "@/auth/role-detection";
import type { Categoria } from "@/operacao/fila-repo";

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
}

export async function montarDashboard(
  usuario: UsuarioDashboard,
  repo: DashboardRepo,
): Promise<Dashboard> {
  const dash: Dashboard = {};

  if (podeAcessarModulo("OPERACAO", usuario)) {
    dash.operacao = {
      criadasHoje: await repo.contarOsCriadasHoje(),
      novasNaFila: await repo.contarOsNovasNaFila(),
      aguardandoAprovacao: await repo.contarOsAguardandoAprovacao(),
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

  if (usuario.isTecnico) {
    dash.tecnico = {
      atribuidasAMim: await repo.contarOsAtribuidasA(usuario.membroId),
      minhaFila: await repo.contarMinhaFila(usuario.especialidades),
    };
  }

  return dash;
}
