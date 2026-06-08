import { config } from "dotenv";
import { resolve } from "path";

// Carrega .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { isNull } from "drizzle-orm";
import { db } from "./client";
import { plano } from "./schema";
import { criarPlanoRepoDrizzle } from "../financeiro/planos/plano-repo-drizzle";

async function main() {
  console.log("Iniciando migração de slugs para planos existentes...");
  const repo = criarPlanoRepoDrizzle(db);

  const planosSemSlug = await db.query.plano.findMany({
    where: isNull(plano.slug),
  });

  console.log(`Encontrados ${planosSemSlug.length} planos sem slug.`);

  let count = 0;
  for (const p of planosSemSlug) {
    // atualizar({ nome }) recalcula o slug garantindo unicidade.
    const atualizado = await repo.atualizar(p.id, { nome: p.nome });
    if (atualizado) {
      console.log(`  ${p.nome} -> ${atualizado.slug}`);
      count++;
    } else {
      console.error(`  Falha ao atualizar plano ID: ${p.id}`);
    }
  }

  console.log(
    `Migração concluída! ${count} de ${planosSemSlug.length} planos atualizados.`,
  );
}

main().catch((err) => {
  console.error("Erro durante a migração de slugs de planos:", err);
  process.exit(1);
});
