import type { Categoria, EstadoOs } from "./orcamento-repo";

/** Item do orçamento como o cliente vê (sem dados internos). */
export interface ItemView {
  nome: string;
  quantidade: string;
  precoUnitario: string;
  subtotal: string;
}

export interface OrcamentoView {
  totalMaoDeObra: string;
  totalDeslocamento: string;
  descontoPlano: string;
  percentualDescontoPlano: string;
  total: string;
  validoAte: Date;
}

export interface TecnicoView {
  id: string;
  nome: string;
  fotoUrl: string | null;
  slug: string | null;
}

export interface OsView {
  id: string;
  categoria: Categoria;
  estado: EstadoOs;
  agendadoPara: Date | null;
  orcamento: (OrcamentoView & { itens: ItemView[] }) | null;
  tecnico: TecnicoView | null;
}

export interface SolicitacaoView {
  token: string;
  clienteNome: string;
  cidade: string | null;
  uf: string | null;
  criadoEm: Date;
  ordens: OsView[];
}

/** Assinatura digital registrada na aprovação (posse do link + IP + carimbo). */
export interface Assinatura {
  token: string;
  ip: string;
}

export interface AprovacaoRepo {
  /** Carrega a Solicitação pública pelo token, com OS e orçamentos. */
  carregarPorToken(token: string): Promise<SolicitacaoView | null>;
  /**
   * Transita para EXPIRADA toda OS ORÇADA da Solicitação cujo orçamento já
   * venceu (validoAte < agora). Idempotente.
   */
  expirarVencidas(token: string, agora: Date): Promise<void>;
  /**
   * Aprova atomicamente a OS, escopada pelo token: só transita se a OS pertence
   * à Solicitação do token, está ORÇADA e dentro da validade. Registra a
   * assinatura no orçamento. Retorna false se nada foi transitado.
   */
  aprovar(token: string, osId: string, assinatura: Assinatura): Promise<boolean>;
  /**
   * Rejeita atomicamente a OS (mesmas garantias de escopo/estado). motivo
   * opcional. Retorna false se nada foi transitado.
   */
  rejeitar(token: string, osId: string, motivo: string | null): Promise<boolean>;
}

export class TokenInvalidoError extends Error {
  readonly status = 404;
  constructor() {
    super("Link inválido ou expirado");
    this.name = "TokenInvalidoError";
  }
}

export class OsNaoOrcadaError extends Error {
  readonly status = 409;
  constructor() {
    super("Esta OS não está mais disponível para aprovação");
    this.name = "OsNaoOrcadaError";
  }
}
