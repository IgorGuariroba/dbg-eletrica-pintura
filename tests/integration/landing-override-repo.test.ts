import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { LandingOverrideRepo } from "@/marketing/landing/landing-override-repo";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("LandingOverrideRepo Drizzle", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: LandingOverrideRepo;
  let servicoIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let clienteIds: string[] = [];

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    const { criarLandingOverrideRepoDrizzle } = await import(
      "@/marketing/landing/landing-override-repo-drizzle"
    );
    dbRaw = dbMod.db;
    repo = criarLandingOverrideRepoDrizzle(dbMod.db);
  });

  beforeEach(() => {
    servicoIds = [];
    solicitacaoIds = [];
    clienteIds = [];
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    // override.depoimento → avaliacao → os → solicitacao → cliente.
    // Apagar solicitação (restrict em os) só funciona após remover override
    // e cascade da OS; remove o serviço (cascade no override) primeiro.
    if (servicoIds.length) {
      await dbRaw
        .delete(schema.servico)
        .where(inArray(schema.servico.id, servicoIds));
    }
    if (solicitacaoIds.length) {
      // avaliacao referencia OS (FK restrict) → apagar avaliações primeiro.
      const oss = await dbRaw
        .select({ id: schema.ordemServico.id })
        .from(schema.ordemServico)
        .where(
          inArray(schema.ordemServico.solicitacaoId, solicitacaoIds),
        );
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

  // Semeia uma avaliação real (cadeia cliente→solicitacao→os→avaliacao) e
  // devolve o id da avaliação, para uso como depoimento.
  async function seedAvaliacao(nota: number): Promise<string> {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({
        nome: `Cli ${r}`,
        whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)),
      })
      .returning();
    clienteIds.push(cli.id);
    const [sol] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: `tok-${r}`,
        clienteId: cli.id,
        categorias: ["PINTURA"],
        fotosUrls: [],
        endereco: { logradouro: "Rua Teste", cidade: "SP", uf: "SP" },
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
        nota,
        comentarioOs: `Comentário ${r}`,
        atorToken: `tok-${r}`,
        ip: "127.0.0.1",
      })
      .returning();
    return av.id;
  }

  async function seedServico(): Promise<string> {
    const r = Math.random().toString(36).slice(2, 10);
    const [s] = await dbRaw
      .insert(schema.servico)
      .values({
        nome: `Serviço ${r}`,
        slug: `servico-${r}`,
        categoria: "PINTURA",
        precoBase: "300.00",
        unidade: "M2",
        prazoGarantiaMeses: 6,
        ativo: true,
      })
      .returning();
    servicoIds.push(s.id);
    return s.id;
  }

  it("salvar cria override e obterPorServico devolve os campos", async () => {
    const servicoId = await seedServico();
    const salvo = await repo.salvar(servicoId, {
      titulo: "Pintura Premium",
      descricao: "Acabamento fosco premium",
      precoPromo: "249.90",
    });
    expect(salvo.servicoId).toBe(servicoId);
    expect(salvo.titulo).toBe("Pintura Premium");
    expect(salvo.precoPromo).toBe("249.90");

    const lido = await repo.obterPorServico(servicoId);
    expect(lido).toMatchObject({
      servicoId,
      titulo: "Pintura Premium",
      descricao: "Acabamento fosco premium",
      precoPromo: "249.90",
      fotos: [],
      depoimentoIds: [],
    });
  });

  it("obterPorServico retorna null quando não há override", async () => {
    const servicoId = await seedServico();
    expect(await repo.obterPorServico(servicoId)).toBeNull();
  });

  it("salvar é upsert: segunda chamada atualiza em vez de duplicar", async () => {
    const servicoId = await seedServico();
    await repo.salvar(servicoId, { titulo: "V1", precoPromo: "100.00" });
    const v2 = await repo.salvar(servicoId, {
      titulo: "V2",
      precoPromo: null,
    });
    expect(v2.titulo).toBe("V2");
    expect(v2.precoPromo).toBeNull();
  });

  it("adicionarFoto anexa no fim da ordem; removerFoto remove", async () => {
    const servicoId = await seedServico();
    await repo.salvar(servicoId, {});
    const f0 = await repo.adicionarFoto(servicoId, "landing/a.jpg");
    const f1 = await repo.adicionarFoto(servicoId, "landing/b.jpg");
    expect(f0.ordem).toBe(0);
    expect(f1.ordem).toBe(1);

    const comFotos = await repo.obterPorServico(servicoId);
    expect(comFotos?.fotos.map((f) => f.chave)).toEqual([
      "landing/a.jpg",
      "landing/b.jpg",
    ]);

    await repo.removerFoto(f0.id);
    const aposRemover = await repo.obterPorServico(servicoId);
    expect(aposRemover?.fotos.map((f) => f.chave)).toEqual(["landing/b.jpg"]);
  });

  it("definirDepoimentos substitui o conjunto preservando a ordem", async () => {
    const servicoId = await seedServico();
    await repo.salvar(servicoId, {});
    const av1 = await seedAvaliacao(5);
    const av2 = await seedAvaliacao(4);
    const av3 = await seedAvaliacao(5);

    await repo.definirDepoimentos(servicoId, [av1, av2]);
    expect((await repo.obterPorServico(servicoId))?.depoimentoIds).toEqual([
      av1,
      av2,
    ]);

    // Substitui (não acumula) e respeita a nova ordem.
    await repo.definirDepoimentos(servicoId, [av3, av1]);
    expect((await repo.obterPorServico(servicoId))?.depoimentoIds).toEqual([
      av3,
      av1,
    ]);
  });
});
