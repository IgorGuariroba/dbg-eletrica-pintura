import { headers } from "next/headers";
import { db } from "@/db/client";
import type { RateLimitRepo } from "./rate-limit";
import { criarRateLimitRepoDrizzle } from "./rate-limit-drizzle";

export class RateLimitExcedidoError extends Error {
  constructor() {
    super("Muitas tentativas. Aguarde um instante e tente de novo.");
    this.name = "RateLimitExcedidoError";
  }
}

async function ipDaRequisicao(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "desconhecido";
}

/**
 * Garante que o IP ainda cabe na janela da rota; lança RateLimitExcedidoError
 * quando estoura. Sem deps injetadas, usa o IP do request e o repo Postgres.
 */
export async function exigirRateLimit(
  rota: string,
  opts: { limite: number; janelaMs: number },
  deps?: { repo?: RateLimitRepo; ip?: string },
): Promise<void> {
  const ip = deps?.ip ?? (await ipDaRequisicao());
  const repo = deps?.repo ?? criarRateLimitRepoDrizzle(db);
  const { permitido } = await repo.consumir({
    chave: `${rota}:${ip}`,
    limite: opts.limite,
    janelaMs: opts.janelaMs,
  });
  if (!permitido) throw new RateLimitExcedidoError();
}
