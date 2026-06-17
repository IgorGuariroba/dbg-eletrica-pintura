// Semeia o catálogo de serviços com os termos que a persona realmente busca
// (trocar disjuntor, instalar chuveiro, pintar quarto…). Os preços são de
// REFERÊNCIA — o valor exato sai no orçamento do técnico (a landing nunca
// promete "preço fixo"). Ajuste fino pelo admin.
//
// Curadoria de preço (jun/2026): valores ancorados em pesquisa de mercado da
// Grande SP, posicionamento MEDIANO, considerando MÃO DE OBRA (material e
// quantidade entram no orçamento do técnico — coerente com a garantia de mão
// de obra). Fontes: tabelas 2026 engehall/tricebrasil/sosreformas (elétrica),
// pinturasp/tricebrasil (pintura), sienge/tricebrasil (drywall).
//
// Idempotente: pula serviços cujo nome já existe. Rode com o DATABASE_URL do
// ambiente desejado:
//   npx tsx -r dotenv/config scripts/seed-catalogo.ts dotenv_config_path=.env.local
import { config } from "dotenv";

config({ path: ".env.local" });

import { db } from "@/db/client";
import { criarServicoRepoDrizzle } from "@/catalogo/servico-repo-drizzle";
import type { NovoServico } from "@/catalogo/servico-repo";

const CATALOGO: Omit<NovoServico, "fotoUrl" | "ativo">[] = [
  // Elétrica (por ponto; mão de obra mediana SP — mercado R$45–250/ponto)
  { nome: "Trocar disjuntor", categoria: "ELETRICA", precoBase: "110.00", unidade: "PONTO", prazoGarantiaMeses: 3 },
  { nome: "Instalar chuveiro elétrico", categoria: "ELETRICA", precoBase: "180.00", unidade: "PONTO", prazoGarantiaMeses: 3 },
  { nome: "Instalar ou trocar tomada", categoria: "ELETRICA", precoBase: "100.00", unidade: "PONTO", prazoGarantiaMeses: 3 },
  { nome: "Trocar interruptor", categoria: "ELETRICA", precoBase: "85.00", unidade: "PONTO", prazoGarantiaMeses: 3 },
  { nome: "Instalar ventilador de teto", categoria: "ELETRICA", precoBase: "180.00", unidade: "PONTO", prazoGarantiaMeses: 3 },
  { nome: "Instalar luminária ou lustre", categoria: "ELETRICA", precoBase: "150.00", unidade: "PONTO", prazoGarantiaMeses: 3 },
  { nome: "Revisar quadro de distribuição", categoria: "ELETRICA", precoBase: "150.00", unidade: "HORA", prazoGarantiaMeses: 3 },
  // Pintura (por m²; mão de obra mediana SP — mercado R$15–35/m²)
  { nome: "Pintar quarto", categoria: "PINTURA", precoBase: "28.00", unidade: "M2", prazoGarantiaMeses: 6 },
  { nome: "Pintar casa inteira", categoria: "PINTURA", precoBase: "24.00", unidade: "M2", prazoGarantiaMeses: 6 },
  { nome: "Pintar parede ou retoque", categoria: "PINTURA", precoBase: "32.00", unidade: "M2", prazoGarantiaMeses: 6 },
  { nome: "Textura ou grafiato", categoria: "PINTURA", precoBase: "50.00", unidade: "M2", prazoGarantiaMeses: 6 },
  { nome: "Pintura de teto", categoria: "PINTURA", precoBase: "35.00", unidade: "M2", prazoGarantiaMeses: 6 },
  // Drywall (por m²; MÃO DE OBRA mediana SP — mercado R$50–75/m². Placas/perfis
  // entram no orçamento. Se o preço-base for material incluído, dobrar.)
  { nome: "Parede ou divisória de drywall", categoria: "DRYWALL", precoBase: "65.00", unidade: "M2", prazoGarantiaMeses: 12 },
  { nome: "Forro de drywall", categoria: "DRYWALL", precoBase: "55.00", unidade: "M2", prazoGarantiaMeses: 12 },
  { nome: "Sanca de gesso", categoria: "DRYWALL", precoBase: "80.00", unidade: "M2", prazoGarantiaMeses: 12 },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não configurada");
    process.exit(1);
  }
  const repo = criarServicoRepoDrizzle(db);
  const { itens } = await repo.listar({ limit: 1000, offset: 0 });
  const existentes = new Set(itens.map((s) => s.nome));

  let criados = 0;
  let pulados = 0;
  for (const s of CATALOGO) {
    if (existentes.has(s.nome)) {
      pulados++;
      continue;
    }
    await repo.inserir({ ...s, fotoUrl: null, ativo: true });
    criados++;
  }
  console.log(`✓ catálogo semeado: ${criados} criados, ${pulados} já existiam`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
