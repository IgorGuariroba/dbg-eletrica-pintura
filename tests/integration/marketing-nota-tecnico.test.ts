import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db as dbClient } from "@/db/client";
import * as schema from "@/db/schema";
import { criarNotaTecnicoRepoDrizzle } from "@/marketing/nota-tecnico-repo-drizzle";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Nota Média Técnico (Bloco NT)", () => {
  let db: typeof dbClient;
  const osIds: string[] = [];
  const solIds: string[] = [];
  const cliIds: string[] = [];
  const tecIds: string[] = [];

  beforeAll(() => {
    db = dbClient;
  });

  afterEach(async () => {
    if (osIds.length) {
      await db.delete(schema.avaliacao).where(inArray(schema.avaliacao.osId, osIds));
      await db.delete(schema.ordemServico).where(inArray(schema.ordemServico.id, osIds));
      osIds.length = 0;
    }
    if (solIds.length) {
      await db.delete(schema.comentarioGeral).where(inArray(schema.comentarioGeral.solicitacaoId, solIds));
      await db.delete(schema.solicitacao).where(inArray(schema.solicitacao.id, solIds));
      solIds.length = 0;
    }
    if (tecIds.length) {
      await db.delete(schema.membro).where(inArray(schema.membro.id, tecIds));
      tecIds.length = 0;
    }
    if (cliIds.length) {
      await db.delete(schema.cliente).where(inArray(schema.cliente.id, cliIds));
      cliIds.length = 0;
    }
  });

  async function seedContexto(token: string, comTecnico: boolean = true) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await db
      .insert(schema.cliente)
      .values({
        nome: `Cliente ${r}`,
        whatsapp: `55119${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `cli-${r}@dbg.test`,
        endereco: { logradouro: "Rua Teste", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    cliIds.push(cli.id);

    const [sol] = await db
      .insert(schema.solicitacao)
      .values({
        token,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        descricao: "teste nota",
        endereco: { logradouro: "Rua Teste", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    solIds.push(sol.id);

    let tecnicoId: string | null = null;
    if (comTecnico) {
      const [tec] = await db
        .insert(schema.membro)
        .values({ nome: `Tecnico ${r}`, email: `tec-${r}@dbg.test`, isTecnico: true })
        .returning();
      tecIds.push(tec.id);
      tecnicoId = tec.id;
    }

    const [os] = await db
      .insert(schema.ordemServico)
      .values({ solicitacaoId: sol.id, categoria: "ELETRICA", tipo: "NORMAL", estado: "CONCLUIDA", tecnicoId })
      .returning();
    osIds.push(os.id);

    return { os, sol, cli, tecnicoId };
  }

  async function seedAvaliacao(osId: string, tecnicoId: string | null, nota: number, invalida = false) {
    await db.insert(schema.avaliacao).values({
      osId,
      tecnicoId,
      nota,
      atorToken: "tok-test",
      ip: "127.0.0.1",
      invalida,
    });
  }

  it("NT1 — tracer: retorna nota média correta ignorando invalidadas", async () => {
    const token = `tok-nt1-${Math.random().toString(36).slice(2, 10)}`;
    const { os: os1, tecnicoId: tec1 } = await seedContexto(token + "-a");
    const token2 = `tok-nt1b-${Math.random().toString(36).slice(2, 10)}`;
    const { os: os2 } = await seedContexto(token2);
    // Use the same tecnicoId for second OS
    await db.update(schema.ordemServico).set({ tecnicoId: tec1 }).where(
      inArray(schema.ordemServico.id, [os2.id])
    );

    await seedAvaliacao(os1.id, tec1, 5, false);
    await seedAvaliacao(os2.id, tec1, 1, true); // invalidada — não conta

    const repo = criarNotaTecnicoRepoDrizzle(db);
    const resultado = await repo.obterNotaMedia(tec1!);

    expect(resultado).not.toBeNull();
    expect(resultado!.media).toBe(5); // apenas nota 5 conta
    expect(resultado!.total).toBe(1);
  });

  it("NT2: avaliação invalidada não conta na média", async () => {
    const token = `tok-nt2-${Math.random().toString(36).slice(2, 10)}`;
    const { os, tecnicoId } = await seedContexto(token);

    await seedAvaliacao(os.id, tecnicoId, 2, true); // só invalidada

    const repo = criarNotaTecnicoRepoDrizzle(db);
    const resultado = await repo.obterNotaMedia(tecnicoId!);

    // Sem avaliações válidas → total = 0
    expect(resultado).not.toBeNull();
    expect(resultado!.total).toBe(0);
    expect(resultado!.media).toBeNull();
  });

  it("NT3: listarNotasPorTecnico agrega por técnico", async () => {
    const token = `tok-nt3-${Math.random().toString(36).slice(2, 10)}`;
    const { os, tecnicoId } = await seedContexto(token);

    await seedAvaliacao(os.id, tecnicoId, 4, false);

    const repo = criarNotaTecnicoRepoDrizzle(db);
    const lista = await repo.listarNotasPorTecnico();

    const meuTecnico = lista.find(l => l.tecnicoId === tecnicoId);
    expect(meuTecnico).toBeDefined();
    expect(meuTecnico!.media).toBeGreaterThan(0);
    expect(meuTecnico!.total).toBeGreaterThanOrEqual(1);
  });
});
