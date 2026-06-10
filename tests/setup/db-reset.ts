import { afterAll, beforeAll, expect } from "vitest";
import { sql } from "drizzle-orm";
import { appendFileSync } from "node:fs";

// Diagnóstico de isolamento (DEBUG_DB_WORKERS=1): grava em /tmp/db-workers.log
// a janela [inicio..fim] de cada arquivo com pid/banco, para auditar que dois
// arquivos jamais compartilham banco em paralelo.
function debugLog(evento: string): void {
  if (!process.env.DEBUG_DB_WORKERS) return;
  const file = expect.getState().testPath ?? "?";
  appendFileSync(
    "/tmp/db-workers.log",
    `${evento} pid=${process.pid} pool=${process.env.VITEST_POOL_ID} db=${new URL(process.env.DATABASE_URL ?? "postgres://x/none").pathname} t=${Date.now()} file=${file}\n`,
  );
}

// Torna a suíte de integração hermética: trunca todas as tabelas no início de
// CADA arquivo, eliminando vazamento de estado entre arquivos (ex.: técnicos
// órfãos que poluem a disponibilidade de slots).
//
// SEGURANÇA: roda SOMENTE quando NEON_LOCAL_PROXY está setado — i.e., apontado
// para o Postgres descartável atrás do proxy local (CI/docker). Sem essa env
// (dev rodando contra Neon real via .env.local), é no-op: jamais trunca um
// banco de verdade.
//
// Exige que arquivos NUNCA compartilhem banco em paralelo: ou execução
// sequencial (local, banco único — fileParallelism: false) ou banco por
// arquivo (CI, CI_DB_PER_FILE — ver tests/setup/worker-db.ts).
afterAll(() => {
  debugLog("fim");
});

beforeAll(async () => {
  if (!process.env.NEON_LOCAL_PROXY || !process.env.DATABASE_URL) return;
  debugLog("inicio");

  const { db } = await import("@/db/client");
  const res = await db.execute(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const linhas = (res as unknown as { rows?: { tablename: string }[] }).rows ??
    (res as unknown as { tablename: string }[]);
  const tabelas = linhas.map((r) => `"${r.tablename}"`);
  if (tabelas.length === 0) return;

  await db.execute(
    sql.raw(`TRUNCATE TABLE ${tabelas.join(", ")} RESTART IDENTITY CASCADE`),
  );
});
