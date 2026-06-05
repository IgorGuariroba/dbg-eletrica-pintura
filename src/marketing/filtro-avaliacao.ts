import { registrarAvaliacoes } from "@/operacao/avaliacao/avaliacao";
import type { AvaliacaoRepo, RegistrarAvaliacoesPayload } from "@/operacao/avaliacao/avaliacao-repo";
import type { AlertaAvaliacaoRepo } from "./alerta-avaliacao-repo";
import type { OperacaoConfigRepo } from "@/operacao/config-repo";

export const NOTA_MINIMA_QUALIFICACAO = 4;

export interface QualificacaoResultado {
  qualificada: boolean;
  googleReviewUrl: string | null;
}

export function qualificarAvaliacoes(notas: number[]): { qualificada: boolean } {
  if (notas.length === 0) return { qualificada: false };
  return { qualificada: notas.every(n => n >= NOTA_MINIMA_QUALIFICACAO) };
}

export function notasParaAlerta<T extends { osId: string; nota: number }>(
  itens: T[]
): T[] {
  return itens.filter((i) => i.nota < NOTA_MINIMA_QUALIFICACAO);
}

export async function finalizarAvaliacao(
  token: string,
  payload: RegistrarAvaliacoesPayload,
  meta: { ip: string },
  deps: {
    avaliacaoRepo: AvaliacaoRepo;
    alertaRepo: AlertaAvaliacaoRepo;
    configRepo: OperacaoConfigRepo;
  }
): Promise<QualificacaoResultado> {
  await registrarAvaliacoes(token, payload, meta, deps.avaliacaoRepo);

  const notas = payload.avaliacoes.map((a) => a.nota);
  const { qualificada } = qualificarAvaliacoes(notas);

  const config = await deps.configRepo.obter();
  const googleReviewUrl = qualificada ? (config.googleReviewUrl ?? null) : null;

  const reprovados = notasParaAlerta(payload.avaliacoes);
  if (reprovados.length > 0) {
    const solicitacaoId = await deps.avaliacaoRepo.obterSolicitacaoIdPorToken(token);
    if (solicitacaoId) {
      for (const a of reprovados) {
        const tecnicoId = await deps.avaliacaoRepo.obterTecnicoSnapshot(a.osId);
        await deps.alertaRepo.criar({
          osId: a.osId,
          solicitacaoId,
          tecnicoId,
          nota: a.nota,
          comentarioOs: a.comentarioOs || null,
        });
      }
    }
  }

  // Reavaliação positiva (≥ 4★) pós-tratativa: fecha o ciclo marcando o alerta
  // resolvido como REAVALIADO. No-op para primeiras avaliações altas (sem alerta).
  const aprovados = payload.avaliacoes.filter((a) => a.nota >= NOTA_MINIMA_QUALIFICACAO);
  for (const a of aprovados) {
    await deps.alertaRepo.marcarReavaliado(a.osId);
  }

  return { qualificada, googleReviewUrl };
}
