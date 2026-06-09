import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DepoimentosQuery } from "@/marketing/landing/depoimentos-query";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("DepoimentosQuery Drizzle", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let query: DepoimentosQuery;
  let solicitacaoIds: string[] = [];
  let clienteIds: string[] = [];
  // Marcador único por arquivo para isolar do DB dev compartilhado.
  const TAG = `dep-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    const { criarDepoimentosQueryDrizzle } = await import(
      "@/marketing/landing/depoimentos-query-drizzle"
    );
    dbRaw = dbMod.db;
    query = criarDepoimentosQueryDrizzle(dbMod.db);
  });

  beforeEach(() => {
    solicitacaoIds = [];
    clienteIds = [];
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (solicitacaoIds.length) {
      const oss = await dbRaw
        .select({ id: schema.ordemServico.id })
        .from(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      const osIds = oss.map((o) => o.id);
      if (osIds.length) {
        await dbRaw
          .delete(schema.avaliacao)
          .where(inArray(schema.avaliacao.osId, osIds));
        await dbRaw
          .delete(schema.ordemServico)
          .where(inArray(schema.ordemServico.id, osIds));
      }
      await dbRaw
        .delete(schema.solicitacao)
        .where(inArray(schema.solicitacao.id, solicitacaoIds));
    }
    if (clienteIds.length) {
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    }
  });

  async function seedAvaliacao(opts: {
    nota: number;
    nome: string;
    comentario: string | null;
    invalida?: boolean;
  }): Promise<string> {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({
        nome: opts.nome,
        whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)),
      })
      .returning();
    clienteIds.push(cli.id);
    const [sol] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: `${TAG}-${r}`,
        clienteId: cli.id,
        categorias: ["PINTURA"],
        fotosUrls: [],
        endereco: { logradouro: "Rua Dep Teste", cidade: "SP", uf: "SP" },
      })
      .returning();
    solicitacaoIds.push(sol.id);
    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        tipo: "NORMAL",
        categoria: "PINTURA",
        estado: "CONCLUIDA",
      })
      .returning();
    const [av] = await dbRaw
      .insert(schema.avaliacao)
      .values({
        osId: os.id,
        nota: opts.nota,
        comentarioOs: opts.comentario,
        atorToken: `${TAG}-${r}`,
        ip: "127.0.0.1",
        invalida: opts.invalida ?? false,
      })
      .returning();
    return av.id;
  }

  it("listarCandidatos inclui ≥4★ com comentário e nome reduzido", async () => {
    const id = await seedAvaliacao({
      nota: 5,
      nome: "Mariana Beatriz Silva",
      comentario: `Excelente ${TAG}`,
    });
    const candidatos = await query.listarCandidatos(100);
    const achado = candidatos.find((c) => c.avaliacaoId === id);
    expect(achado).toBeDefined();
    expect(achado?.nome).toBe("Mariana S.");
    expect(achado?.texto).toBe(`Excelente ${TAG}`);
    expect(achado?.nota).toBe(5);
  });

  it("exclui nota < 4, invalidadas e sem comentário", async () => {
    const baixa = await seedAvaliacao({
      nota: 3,
      nome: "Joao Baixa",
      comentario: `Ruim ${TAG}`,
    });
    const invalida = await seedAvaliacao({
      nota: 5,
      nome: "Pedro Invalido",
      comentario: `Spam ${TAG}`,
      invalida: true,
    });
    const semComentario = await seedAvaliacao({
      nota: 5,
      nome: "Ana Muda",
      comentario: null,
    });
    const ids = (await query.listarCandidatos(200)).map((c) => c.avaliacaoId);
    expect(ids).not.toContain(baixa);
    expect(ids).not.toContain(invalida);
    expect(ids).not.toContain(semComentario);
  });

  it("porIds preserva a ordem informada e descarta não-qualificados", async () => {
    const a = await seedAvaliacao({
      nota: 5,
      nome: "Cliente A",
      comentario: `A ${TAG}`,
    });
    const b = await seedAvaliacao({
      nota: 4,
      nome: "Cliente B",
      comentario: `B ${TAG}`,
    });
    const baixa = await seedAvaliacao({
      nota: 2,
      nome: "Cliente C",
      comentario: `C ${TAG}`,
    });

    const resultado = await query.porIds([b, baixa, a]);
    expect(resultado.map((c) => c.avaliacaoId)).toEqual([b, a]);
  });

  it("porIds com lista vazia retorna vazio", async () => {
    expect(await query.porIds([])).toEqual([]);
  });
});
