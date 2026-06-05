import { TokenInvalidoError } from "@/operacao/aprovacao-repo";
import { NotaInvalidaError, OsNaoAvaliavelError } from "./avaliacao-repo";
import type { AvaliacaoRepo, RegistrarAvaliacoesPayload, SolicitationAvaliacaoView } from "./avaliacao-repo";

export async function registrarAvaliacoes(
  token: string,
  payload: RegistrarAvaliacoesPayload,
  meta: { ip: string },
  repo: AvaliacaoRepo,
): Promise<void> {
  for (const a of payload.avaliacoes) {
    if (a.nota < 1 || a.nota > 5 || !Number.isInteger(a.nota)) {
      throw new NotaInvalidaError();
    }
  }

  const osIds = payload.avaliacoes.map((a) => a.osId);
  if (osIds.length > 0) {
    const valid = await repo.verificarPertencimento(token, osIds);
    if (!valid) {
      throw new OsNaoAvaliavelError();
    }
  }

  for (const a of payload.avaliacoes) {
    const tecnicoId = await repo.obterTecnicoSnapshot(a.osId);
    await repo.salvarAvaliacao(a.osId, {
      tecnicoId,
      nota: a.nota,
      comentarioOs: a.comentarioOs || null,
      atorToken: token,
      ip: meta.ip,
    });
  }

  if (payload.comentarioGeral !== undefined && payload.comentarioGeral !== null) {
    const solicitacaoId = await repo.obterSolicitacaoIdPorToken(token);
    if (solicitacaoId) {
      await repo.salvarComentarioGeral(solicitacaoId, {
        comentario: payload.comentarioGeral,
        atorToken: token,
        ip: meta.ip,
      });
    }
  }
}

export async function carregarParaAvaliar(
  token: string,
  repo: AvaliacaoRepo,
): Promise<SolicitationAvaliacaoView> {
  const view = await repo.carregarPorToken(token);
  if (!view) {
    throw new TokenInvalidoError();
  }
  return view;
}
