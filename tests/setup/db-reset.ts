import { beforeAll } from "vitest";
import { sql } from "drizzle-orm";

// Torna a suíte de integração hermética: trunca todas as tabelas no início de
// CADA arquivo, eliminando vazamento de estado entre arquivos (ex.: técnicos
// órfãos que poluem a disponibilidade de slots).
//
// SEGURANÇA: roda SOMENTE quando NEON_LOCAL_PROXY está setado — i.e., apontado
// para o Postgres descartável atrás do proxy local (CI/docker). Sem essa env
// (dev rodando contra Neon real via .env.local), é no-op: jamais trunca um
// banco de verdade.
//
// Exige execução sequencial (--no-file-parallelism): com workers paralelos um
// arquivo truncaria o banco no meio de outro.
beforeAll(async () => {
  if (!process.env.NEON_LOCAL_PROXY || !process.env.DATABASE_URL) return;

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
