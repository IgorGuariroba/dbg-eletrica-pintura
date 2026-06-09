import type { Categoria } from "@/financeiro/planos/plano-repo";
import { proximaPreventivaDevida } from "./preventiva-cadencia";

/** Assinatura ATIVA com os dados do plano necessários à geração. */
export interface AssinaturaAtiva {
  assinaturaId: string;
  clienteId: string;
  inicio: Date;
  preventivasPorAno: number;
  categorias: Categoria[];
}

export interface NovaPreventiva {
  assinaturaId: string;
  clienteId: string;
  categoria: Categoria;
  agendadoPara: Date;
}

export interface PreventivaGeracaoRepo {
  /** Assinaturas ATIVA com início definido, já com os dados do plano. */
  listarAtivas(): Promise<AssinaturaAtiva[]>;
  /** Data da última preventiva (qualquer estado) por categoria da assinatura. */
  ultimaPreventivaPorCategoria(
    assinaturaId: string,
  ): Promise<Map<Categoria, Date>>;
  /**
   * Já existe uma preventiva aberta (AGENDADA..EM_EXECUCAO) para a assinatura +
   * categoria? É a trava de idempotência: não recria enquanto a anterior corre.
   */
  existeAberta(assinaturaId: string, categoria: Categoria): Promise<boolean>;
  /**
   * Cria a OS PREVENTIVA (AGENDADA, sem técnico/custo) com a solicitação-snapshot.
   * Retorna `null` quando o cliente não tem endereço (não dá para agendar a visita).
   */
  criarOsPreventiva(dados: NovaPreventiva): Promise<{ osId: string } | null>;
}

export interface ResultadoGeracao {
  geradas: number;
}

/**
 * Caso de uso do cron diário (#60): varre as assinaturas ativas e, para cada
 * categoria coberta pelo plano, cria a OS PREVENTIVA devida pela cadência. Pula
 * o que já tem preventiva aberta (idempotência) e o que ainda não venceu.
 */
export async function gerarPreventivasDevidas(
  repo: PreventivaGeracaoRepo,
  hoje: Date = new Date(),
): Promise<ResultadoGeracao> {
  const ativas = await repo.listarAtivas();
  let geradas = 0;

  for (const a of ativas) {
    const ultimas = await repo.ultimaPreventivaPorCategoria(a.assinaturaId);
    for (const categoria of a.categorias) {
      if (await repo.existeAberta(a.assinaturaId, categoria)) continue;

      const devida = proximaPreventivaDevida(
        a.inicio,
        ultimas.get(categoria) ?? null,
        a.preventivasPorAno,
        hoje,
      );
      if (!devida) continue;

      const criada = await repo.criarOsPreventiva({
        assinaturaId: a.assinaturaId,
        clienteId: a.clienteId,
        categoria,
        agendadoPara: devida,
      });
      if (criada) geradas++;
    }
  }

  return { geradas };
}
