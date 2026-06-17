// GUARD de segurança da suíte de integração.
//
// Os testes de integração ESCREVEM e TRUNCAM o banco. Eles só podem rodar
// contra um Postgres DESCARTÁVEL atrás do proxy local (CI/docker), sinalizado
// por `NEON_LOCAL_PROXY`. Sem essa env, `DATABASE_URL` aponta pro Neon cloud
// do `.env.local` (dev/landing) — rodar ali polui dados reais (foi a origem
// das 800+ linhas de "teste" no catálogo da landing).
//
// Sem o proxy, zeramos `DATABASE_URL` ANTES de qualquer teste avaliar
// `hasDb = Boolean(process.env.DATABASE_URL)`. A chave continua presente (""),
// então o `config({ path: ".env.local" })` no topo de cada arquivo (dotenv
// com override:false) NÃO a repovoa — e todo `describe.skipIf(!hasDb)` skipa.
// Resultado: `pnpm test` local roda só o que é seguro; integração exige
// `pnpm test:integration` (que sobe o proxy).
//
// Primeiro na ordem de setupFiles (vitest.config.ts), antes de worker-db,
// neon-proxy e db-reset.
if (!process.env.NEON_LOCAL_PROXY) {
  process.env.DATABASE_URL = "";
}
