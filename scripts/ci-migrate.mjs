// Aplica as migrations (./drizzle) no Postgres do CI/docker via TCP (driver pg).
//
// Histórico: este script já usou o migrator neon-http através do proxy local,
// porque o `drizzle-kit migrate` é uma CLI bundleada com a própria cópia do
// @neondatabase/serverless e não dá pra redirecioná-la ao proxy mutando o
// neonConfig do nosso node_modules. Só que cada statement virava um round-trip
// HTTP (~49s no CI). Com a porta 5432 do service postgres mapeada no runner,
// o caminho TCP direto aplica tudo em poucos segundos — o proxy continua
// necessário apenas para o runtime dos testes (driver neon-http do app).
//
// CI_DB_PER_FILE=1 (CI): além do banco principal, cria um banco POR ARQUIVO de
// teste de integração (mesma regra de nome de tests/setup/worker-db.ts),
// clonado de um template migrado. Bancos por arquivo permitem a suíte de
// integração em paralelo sem nenhum compartilhamento — nem truncate nem
// escritas atrasadas de um arquivo alcançam o banco de outro. O template é
// dedicado (ci_tpl) e nunca é consultado via proxy, então o CREATE DATABASE
// ... TEMPLATE não esbarra em conexões penduradas.
import { config } from "dotenv";

config({ path: ".env.local" });

import { readdirSync } from "node:fs";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não configurada");
  process.exit(1);
}

async function migrar(connectionString) {
  const pool = new pg.Pool({ connectionString });
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
}

function urlDoBanco(nome) {
  const u = new URL(url);
  u.pathname = `/${nome}`;
  return u.toString();
}

// Mesma regra de tests/setup/worker-db.ts (duplicada de propósito: este
// script é .mjs puro e roda antes de qualquer transpilação do vitest).
function nomeBancoDoArquivo(arquivo) {
  return `ci_f_${arquivo.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
}

await migrar(url);
console.log("✓ migrations aplicadas");

if (process.env.CI_DB_PER_FILE) {
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();

  async function criarBanco(nome, template) {
    try {
      await admin.query(
        `CREATE DATABASE ${nome}${template ? ` TEMPLATE ${template}` : ""}`,
      );
      return true;
    } catch (e) {
      // 42P04 = banco já existe (rerun local); migrations são idempotentes.
      if (e?.code !== "42P04") throw e;
      return false;
    }
  }

  await criarBanco("ci_tpl");
  await migrar(urlDoBanco("ci_tpl"));

  const arquivos = readdirSync("tests/integration").filter((f) =>
    f.endsWith(".test.ts"),
  );
  for (const arquivo of arquivos) {
    const nome = nomeBancoDoArquivo(arquivo);
    const criado = await criarBanco(nome, "ci_tpl");
    // Rerun local: banco antigo pode ter schema defasado — migra no lugar.
    if (!criado) await migrar(urlDoBanco(nome));
  }
  await admin.end();
  console.log(`✓ ${arquivos.length} bancos por arquivo clonados de ci_tpl`);
}
