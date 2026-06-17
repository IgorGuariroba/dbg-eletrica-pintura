// Semeia o catálogo de serviços com os termos que a persona realmente busca
// (trocar disjuntor, instalar chuveiro, pintar quarto…). Os preços são de
// REFERÊNCIA — o valor exato sai no orçamento do técnico (a landing nunca
// promete "preço fixo"). Ajuste fino pelo admin.
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
  // Elétrica
  { nome: "Trocar disjuntor", categoria: "ELETRICA", precoBase: "120.00", unidade: "PONTO", prazoGarantiaMeses: 3 },
  { nome: "Instalar chuveiro elétrico", categoria: "ELETRICA", precoBase: "150.00", unidade: "PONTO", prazoGarantiaMeses: 3 },
  { nome: "Instalar ou trocar tomada", categoria: "ELETRICA", precoBase: "90.00", unidade: "PONTO", prazoGarantiaMeses: 3 },
  { nome: "Trocar interruptor", categoria: "ELETRICA", precoBase: "80.00", unidade: "PONTO", prazoGarantiaMeses: 3 },
  { nome: "Instalar ventilador de teto", categoria: "ELETRICA", precoBase: "160.00", unidade: "PONTO", prazoGarantiaMeses: 3 },
  { nome: "Instalar luminária ou lustre", categoria: "ELETRICA", precoBase: "130.00", unidade: "PONTO", prazoGarantiaMeses: 3 },
  { nome: "Revisar quadro de distribuição", categoria: "ELETRICA", precoBase: "140.00", unidade: "HORA", prazoGarantiaMeses: 3 },
  // Pintura
  { nome: "Pintar quarto", categoria: "PINTURA", precoBase: "28.00", unidade: "M2", prazoGarantiaMeses: 6 },
  { nome: "Pintar casa inteira", categoria: "PINTURA", precoBase: "25.00", unidade: "M2", prazoGarantiaMeses: 6 },
  { nome: "Pintar parede ou retoque", categoria: "PINTURA", precoBase: "30.00", unidade: "M2", prazoGarantiaMeses: 6 },
  { nome: "Textura ou grafiato", categoria: "PINTURA", precoBase: "45.00", unidade: "M2", prazoGarantiaMeses: 6 },
  { nome: "Pintura de teto", categoria: "PINTURA", precoBase: "32.00", unidade: "M2", prazoGarantiaMeses: 6 },
  // Drywall
  { nome: "Parede ou divisória de drywall", categoria: "DRYWALL", precoBase: "120.00", unidade: "M2", prazoGarantiaMeses: 12 },
  { nome: "Forro de drywall", categoria: "DRYWALL", precoBase: "110.00", unidade: "M2", prazoGarantiaMeses: 12 },
  { nome: "Sanca de gesso", categoria: "DRYWALL", precoBase: "140.00", unidade: "M2", prazoGarantiaMeses: 12 },
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
