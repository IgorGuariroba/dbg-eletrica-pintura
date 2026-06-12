import { db } from "@/db/client";
import {
  notificar,
  type NotificarDeps,
  type NotificarResultado,
} from "@/notificacao/notificar";
import type { EstadoOs } from "./orcamento-repo";
import {
  aplicarTransicao,
  type Geo,
  type TransicaoRegistro,
} from "./maquina-estado";
import type { TransicaoRepo } from "./transicao-repo";
import { criarTransicaoRepoDrizzle } from "./transicao-repo-drizzle";

export interface TransicionarOpts {
  /** Relógio injetável (registro + Horário Restrito da notificação). */
  agora?: Date;
  /** Geolocalização do ator (PWA de campo). */
  geo?: Geo;
  /** Seam interno: repo de transição (default: Drizzle). */
  repo?: TransicaoRepo;
  /** Adapters de saída repassados ao contexto Notificação (testes). */
  notificarDeps?: NotificarDeps;
}

export interface TransicionarResultado {
  registro: TransicaoRegistro;
  /**
   * Despacho do Evento de Notificação: não bloqueia a resposta (latência de
   * WhatsApp/e-mail/PDF fora do caminho crítico), mas a promise é exposta —
   * rotas ignoram, testes aguardam. NUNCA rejeita; erro de despacho é logado.
   */
  despacho: Promise<NotificarResultado>;
}

/**
 * Transição de OS num módulo só: valida pela máquina pura, persiste
 * (histórico + estado) e SEMPRE emite o Evento de Notificação — o emissor não
 * conhece mais o contexto Notificação. Lança TransicaoInvalidaError (409) se
 * o caminho é proibido e OsInexistenteError (404) se a OS não existe; erro de
 * despacho nunca derruba a transição. Autorização (técnico da OS vs admin)
 * permanece no caller — é regra de acesso da rota, não da transição.
 */
export async function transicionarOs(
  osId: string,
  alvo: EstadoOs,
  ator: string,
  motivo: string | null = null,
  opts: TransicionarOpts = {},
): Promise<TransicionarResultado> {
  const repo = opts.repo ?? criarTransicaoRepoDrizzle(db);
  const registro = await aplicarTransicao(
    osId,
    alvo,
    ator,
    motivo,
    repo,
    opts.agora ?? new Date(),
    opts.geo,
  );

  return {
    registro,
    despacho: despacharEventoTransicao(osId, alvo, opts.notificarDeps),
  };
}

/**
 * Despacho fire-and-forget do evento de transição — implementação única do
 * `catch`+log antes copiado em cada emissor. Uso direto só para transições
 * persistidas fora da máquina (ex.: portão atômico NOVA→ORCADA do orçamento,
 * acoplado à criação/compensação do orçamento); o caminho normal é
 * `transicionarOs`.
 */
export function despacharEventoTransicao(
  osId: string,
  estadoNovo: EstadoOs,
  deps?: NotificarDeps,
): Promise<NotificarResultado> {
  return notificar({ tipo: "os.transicao", osId, estadoNovo }, deps).catch(
    (e) => {
      console.error(`Erro ao despachar notificação da OS ${osId}:`, e);
      return {};
    },
  );
}
