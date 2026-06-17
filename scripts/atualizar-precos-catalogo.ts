// Atualiza o Preço Base dos serviços já existentes no Catálogo conforme a
// curadoria de mercado (jun/2026, Grande SP, mediano, mão de obra). O seed é
// idempotente e PULA serviços existentes, então não muda preço de quem já está
// no banco — este script faz isso, casando por nome.
//
// Idempotente: só escreve quando o preço atual difere do alvo. Use o
// DATABASE_URL do ambiente desejado (rode contra produção com cautela):
//   npx tsx -r dotenv/config scripts/atualizar-precos-catalogo.ts dotenv_config_path=.env.local
import { config } from "dotenv";

config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { servico } from "@/db/schema";

// nome → novo preço base (em reais, 2 casas). Espelha scripts/seed-catalogo.ts.
const PRECOS: Record<string, string> = {
  "Trocar disjuntor": "110.00",
  "Instalar chuveiro elétrico": "180.00",
  "Instalar ou trocar tomada": "100.00",
  "Trocar interruptor": "85.00",
  "Instalar ventilador de teto": "180.00",
  "Instalar luminária ou lustre": "150.00",
  "Revisar quadro de distribuição": "150.00",
  "Pintar quarto": "28.00",
  "Pintar casa inteira": "24.00",
  "Pintar parede ou retoque": "32.00",
  "Textura ou grafiato": "50.00",
  "Pintura de teto": "35.00",
  "Parede ou divisória de drywall": "65.00",
  "Forro de drywall": "55.00",
  "Sanca de gesso": "80.00",
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não configurada");
    process.exit(1);
  }

  let atualizados = 0;
  let inalterados = 0;
  let ausentes = 0;

  for (const [nome, precoBase] of Object.entries(PRECOS)) {
    const [row] = await db
      .select({ id: servico.id, precoBase: servico.precoBase })
      .from(servico)
      .where(eq(servico.nome, nome))
      .limit(1);

    if (!row) {
      console.warn(`• ausente no banco: "${nome}"`);
      ausentes++;
      continue;
    }
    if (row.precoBase === precoBase) {
      inalterados++;
      continue;
    }

    await db.update(servico).set({ precoBase }).where(eq(servico.id, row.id));
    console.log(`✓ "${nome}": R$ ${row.precoBase} → R$ ${precoBase}`);
    atualizados++;
  }

  console.log(
    `\nConcluído: ${atualizados} atualizados, ${inalterados} já corretos, ${ausentes} ausentes.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
