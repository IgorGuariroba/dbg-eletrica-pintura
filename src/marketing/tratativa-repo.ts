export type TipoComunicado = "LIGOU" | "DESCONTO" | "OS_CORRECAO" | "OUTRO";

export interface TratativaInput {
  alertaAvaliacaoId: string;
  osId: string;
  tipo: TipoComunicado;
  descricao: string;
  responsavelId: string | null;
  data: Date;
}

export interface TratativaView {
  id: string;
  alertaAvaliacaoId: string;
  osId: string;
  tipo: string;
  descricao: string;
  responsavelId: string | null;
  responsavelNome: string | null;
  data: Date;
  criadoEm: Date;
}

export interface TratativaRepo {
  criar(dados: TratativaInput): Promise<void>;
  listarPorAlerta(alertaAvaliacaoId: string): Promise<TratativaView[]>;
}
