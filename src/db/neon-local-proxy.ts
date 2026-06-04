import { neonConfig } from "@neondatabase/serverless";

/**
 * Aponta o driver Neon serverless (HTTP) para um proxy local — a imagem
 * `local-neon-http-proxy` sobre um Postgres comum — usado no CI e em runs
 * de integração contra docker.
 *
 * Gated por `NEON_LOCAL_PROXY` (ex.: "localhost:4444"): sem a env é no-op,
 * e o driver fala com o Neon real na nuvem (comportamento de prod e do
 * `.env.local` apontando pra cloud). Inerte em produção.
 *
 * Só o caminho HTTP (`neon-http`) é redirecionado: é o driver que o app usa
 * em runtime (`client.ts`) e o que o migrator do CI usa. O wire-protocol do
 * Postgres comum não é envolvido — o proxy traduz HTTP -> Postgres.
 */
export function configurarProxyLocalNeon(): void {
  const proxy = process.env.NEON_LOCAL_PROXY;
  if (!proxy) return;

  neonConfig.fetchEndpoint = `http://${proxy}/sql`;
}
