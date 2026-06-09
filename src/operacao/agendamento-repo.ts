import type { Categoria, EstadoOs } from "./orcamento-repo";
import type { HorarioComercial } from "./horario-comercial";
import type { TecnicoAgendavel } from "./slots";

export interface AgendamentoDadosOs {
  id: string;
  estado: EstadoOs;
  categoria: Categoria;
  tecnicoId: string | null;
  agendadoPara: Date | null;
  clienteAssinante: boolean;
  clienteWhatsapp: string;
}

export interface TransicaoRegistro {
  estadoAnterior: EstadoOs;
  estadoNovo: EstadoOs;
  atorEmail: string;
  motivo: string | null;
  em: Date;
}

export interface AgendamentoRepo {
  buscarOs(osId: string): Promise<AgendamentoDadosOs | null>;
  buscarOsComToken(token: string, osId: string): Promise<AgendamentoDadosOs | null>;
  listarTecnicosAgendaveis(categoria: Categoria): Promise<TecnicoAgendavel[]>;
  obterHorarioComercial(): Promise<HorarioComercial>;
  salvarAgendamento(
    osId: string,
    slot: Date,
    tecnicoId: string,
    transicao: TransicaoRegistro
  ): Promise<void>;
  liberarAgendamento(
    osId: string,
    novoEstado: EstadoOs,
    transicao: TransicaoRegistro
  ): Promise<void>;
}
