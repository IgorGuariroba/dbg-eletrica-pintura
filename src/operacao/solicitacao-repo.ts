import type { categoriaServicoEnum } from "@/db/schema";

export type Categoria = (typeof categoriaServicoEnum.enumValues)[number];

export interface EnderecoSolicitacao {
  logradouro: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade: string;
  uf: string;
  cep?: string;
  lat?: number;
  lng?: number;
}

export interface NovoCliente {
  nome: string;
  whatsapp: string;
  email?: string | null;
  endereco?: EnderecoSolicitacao | null;
}

export interface Cliente extends NovoCliente {
  id: string;
  criadoEm: Date;
}

export interface NovaSolicitacao {
  token: string;
  clienteId: string;
  categorias: Categoria[];
  descricao: string | null;
  fotosUrls: string[];
  endereco: EnderecoSolicitacao;
  dataDesejada: Date | null;
  duracaoEstimada: string | null;
  lgpdAceito: boolean;
  origem: "FORMULARIO" | "EXPRESS" | "MANUAL" | "EXPRESS_TECNICO";
  foraCobertura?: boolean;
}

export interface Solicitacao extends NovaSolicitacao {
  id: string;
  foraCobertura: boolean;
  criadoEm: Date;
}

export interface NovaOrdemServico {
  solicitacaoId: string;
  categoria: Categoria;
  tipo: "NORMAL" | "EXPRESS" | "COMPLEMENTAR" | "PREVENTIVA" | "GARANTIA";
  estado:
    | "NOVA"
    | "ORCADA"
    | "APROVADA"
    | "REJEITADA"
    | "EXPIRADA"
    | "AGENDADA"
    | "A_CAMINHO"
    | "NO_LOCAL"
    | "EM_EXECUCAO"
    | "CONCLUIDA"
    | "PAGA"
    | "CANCELADA"
    | "GARANTIA_ABERTA";
  tecnicoId?: string | null;
}

export interface OrdemServico extends NovaOrdemServico {
  id: string;
  criadoEm: Date;
}

export interface ResultadoCriacao {
  solicitacao: Solicitacao;
  ordens: OrdemServico[];
  cliente: Cliente;
}

export interface CriarSolicitacaoInput {
  cliente: NovoCliente;
  solicitacao: Omit<NovaSolicitacao, "clienteId" | "token">;
}

export interface SolicitacaoRepo {
  criarComOrdens(input: {
    cliente: NovoCliente;
    solicitacao: Omit<NovaSolicitacao, "clienteId">;
    ordensCustom?: {
      tipo: NovaOrdemServico["tipo"];
      estado: NovaOrdemServico["estado"];
      tecnicoId?: string | null;
    };
  }): Promise<ResultadoCriacao>;
  buscarPorToken(token: string): Promise<{
    solicitacao: Solicitacao;
    cliente: Cliente;
    ordens: OrdemServico[];
  } | null>;
}
