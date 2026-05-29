import type { EstadoOs } from "./orcamento-repo";
import type { AprovacaoRepo, Assinatura, SolicitacaoView } from "./aprovacao-repo";
import { OsNaoOrcadaError, TokenInvalidoError } from "./aprovacao-repo";

/**
 * Uma OS ORÇADA cuja validade já passou deve transitar para EXPIRADA na
 * próxima vez que o cliente acessa o link (expiração preguiçosa).
 */
export function precisaExpirar(
  estado: EstadoOs,
  validoAte: Date,
  agora: Date,
): boolean {
  return estado === "ORCADA" && validoAte.getTime() < agora.getTime();
}

/**
 * Carrega a Solicitação pública pelo token, expirando antes os orçamentos
 * vencidos para que o cliente veja o estado correto. 404 se o token não existe.
 */
export async function carregarParaCliente(
  token: string,
  repo: AprovacaoRepo,
  agora: Date = new Date(),
): Promise<SolicitacaoView> {
  await repo.expirarVencidas(token, agora);
  const view = await repo.carregarPorToken(token);
  if (!view) throw new TokenInvalidoError();
  return view;
}

export async function aprovarOrcamento(
  token: string,
  osId: string,
  assinatura: Assinatura,
  repo: AprovacaoRepo,
): Promise<void> {
  const ok = await repo.aprovar(token, osId, assinatura);
  if (!ok) throw new OsNaoOrcadaError();
}

export async function rejeitarOrcamento(
  token: string,
  osId: string,
  motivo: string,
  repo: AprovacaoRepo,
): Promise<void> {
  const motivoLimpo = motivo.trim() || null;
  const ok = await repo.rejeitar(token, osId, motivoLimpo);
  if (!ok) throw new OsNaoOrcadaError();
}
