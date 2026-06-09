import { config } from "dotenv";
import { resolve } from "path";

// Carrega .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { db } from "./client";
import { servico } from "./schema";
import { criarServicoRepoDrizzle } from "../catalogo/servico-repo-drizzle";
import { isNull } from "drizzle-orm";

async function main() {
  console.log("Iniciando migração de slugs para serviços existentes...");
  const repo = criarServicoRepoDrizzle(db);

  const servicosSemSlug = await db.query.servico.findMany({
    where: isNull(servico.slug),
  });

  console.log(`Encontrados ${servicosSemSlug.length} serviços sem slug.`);

  let count = 0;
  for (const s of servicosSemSlug) {
    // Passar o próprio nome força o repo a recalcular o slug.
    const atualizado = await repo.atualizar(s.id, { nome: s.nome });
    if (atualizado) {
      console.log(`  -> ${s.nome} → ${atualizado.slug}`);
      count++;
    } else {
      console.error(`  -> Falha ao atualizar serviço ID: ${s.id}`);
    }
  }

  console.log(
    `Migração concluída! ${count} de ${servicosSemSlug.length} serviços atualizados.`,
  );
}

main().catch((err) => {
  console.error("Erro durante a migração de slugs de serviços:", err);
  process.exit(1);
});
