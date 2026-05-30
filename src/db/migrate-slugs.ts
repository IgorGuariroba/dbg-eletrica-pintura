import { config } from "dotenv";
import { resolve } from "path";

// Carrega .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { db } from "./client";
import { membro } from "./schema";
import { criarMembroRepoDrizzle } from "../equipe/membro-repo-drizzle";
import { isNull } from "drizzle-orm";

async function main() {
  console.log("Iniciando migração de slugs para membros existentes...");
  const repo = criarMembroRepoDrizzle(db);

  // Busca todos os membros com slug nulo
  const membrosSemSlug = await db.query.membro.findMany({
    where: isNull(membro.slug),
  });

  console.log(`Encontrados ${membrosSemSlug.length} membros sem slug.`);

  let count = 0;
  for (const m of membrosSemSlug) {
    console.log(`Gerando slug para o membro: ${m.nome} (ID: ${m.id})`);
    
    // O repo.atualizar já gera o slug automaticamente se o nome for passado
    // ou se precisarmos atualizar o slug explicitamente. Deixe-me ver o atualizar.
    // Para forçar a geração, podemos passar o nome dele mesmo no atualizar.
    // No membro-repo-drizzle.ts, se passarmos { nome: m.nome }, ele recalcula o slug.
    const atualizado = await repo.atualizar(m.id, { nome: m.nome });
    if (atualizado) {
      console.log(`  -> Slug gerado: ${atualizado.slug}`);
      count++;
    } else {
      console.error(`  -> Falha ao atualizar membro ID: ${m.id}`);
    }
  }

  console.log(`Migração concluída com sucesso! ${count} de ${membrosSemSlug.length} membros atualizados.`);
}

main().catch((err) => {
  console.error("Erro durante a migração de slugs:", err);
  process.exit(1);
});
