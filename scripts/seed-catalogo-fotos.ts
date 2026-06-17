// Popula a fotoUrl dos serviços do catálogo com imagens grátis (loremflickr —
// Flickr Creative Commons, por palavra-chave), hospedadas no R2 público da DBG
// (não hotlink: baixa e re-upa, ficamos donos do arquivo). Roda DEPOIS de
// seed-catalogo.ts.
//
// Idempotente: pula serviços que já têm fotoUrl. Para re-baixar, limpe a
// fotoUrl no admin antes.
//   npx tsx -r dotenv/config scripts/seed-catalogo-fotos.ts dotenv_config_path=.env.local
import { config } from "dotenv";

config({ path: ".env.local" });

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/db/client";
import { criarServicoRepoDrizzle } from "@/catalogo/servico-repo-drizzle";
import { clientePublico } from "@/lib/storage/clientes";
import { urlPublicaFoto } from "@/lib/storage/publico";

// Palavras-chave por slug (loremflickr casa TODAS as tags; mantidas curtas e
// concretas pra trazer foto do tema certo).
const KEYWORDS: Record<string, string> = {
  "trocar-disjuntor": "electrical,panel",
  "instalar-chuveiro-eletrico": "shower,bathroom",
  "instalar-ou-trocar-tomada": "electrical,outlet",
  "trocar-interruptor": "light,switch",
  "instalar-ventilador-de-teto": "ceiling,fan",
  "instalar-luminaria-ou-lustre": "chandelier",
  "revisar-quadro-de-distribuicao": "fusebox,electrical",
  "pintar-quarto": "bedroom,paint",
  "pintar-casa-inteira": "house,painting",
  "pintar-parede-ou-retoque": "wall,paint",
  "textura-ou-grafiato": "textured,wall",
  "pintura-de-teto": "ceiling,paint",
  "parede-ou-divisoria-de-drywall": "drywall",
  "forro-de-drywall": "ceiling,construction",
  "sanca-de-gesso": "plaster,ceiling",
};

const FALLBACK = "home,repair";

async function baixar(keywords: string): Promise<Buffer> {
  for (const kw of [keywords, FALLBACK]) {
    const res = await fetch(`https://loremflickr.com/800/600/${kw}`, {
      redirect: "follow",
    });
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    // loremflickr devolve um placeholder pequeno quando não acha match.
    if (buf.length > 5000) return buf;
  }
  throw new Error(`sem imagem utilizável para "${keywords}"`);
}

async function main() {
  const repo = criarServicoRepoDrizzle(db);
  const { client, bucket } = clientePublico();
  const { itens } = await repo.listar({ limit: 1000, offset: 0 });

  let ok = 0;
  let pulados = 0;
  for (const s of itens) {
    if (s.fotoUrl) {
      pulados++;
      continue;
    }
    const kw = s.slug ? KEYWORDS[s.slug] : undefined;
    if (!kw) {
      console.warn(`sem keyword para "${s.nome}" (slug ${s.slug}) — pulando`);
      continue;
    }
    const buf = await baixar(kw);
    const key = `servicos/${s.slug}.jpg`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buf,
        ContentType: "image/jpeg",
      }),
    );
    await repo.atualizar(s.id, { fotoUrl: urlPublicaFoto(key) });
    console.log(`✓ ${s.nome} → ${key} (${(buf.length / 1024) | 0} KB)`);
    ok++;
  }
  console.log(`\n✓ fotos: ${ok} enviadas, ${pulados} já tinham`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
