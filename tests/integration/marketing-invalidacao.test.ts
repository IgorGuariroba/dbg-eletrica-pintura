import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db as dbClient } from "@/db/client";
import * as schema from "@/db/schema";
import { criarAvaliacaoRepoDrizzle } from "@/operacao/avaliacao/avaliacao-repo-drizzle";
import { criarNotaTecnicoRepoDrizzle } from "@/marketing/nota-tecnico-repo-drizzle";
import { MotivoObrigatorioError } from "@/marketing/invalidacao";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Invalidação de Avaliação (Bloco INV)", () => {
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

  async function seedContexto(token: string) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await db.insert(schema.cliente).values({
      nome: `Cliente ${r}`,
      whatsapp: `55119${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `cli-${r}@dbg.test`,
      endereco: { logradouro: "Rua Teste", cidade: "SP", uf: "SP" },
    }).returning();
    cliIds.push(cli.id);

    const [sol] = await db.insert(schema.solicitacao).values({
      token,
      clienteId: cli.id,
      categorias: ["ELETRICA"],
      descricao: "teste inv",
      endereco: { logradouro: "Rua Teste", cidade: "SP", uf: "SP" },
    }).returning();
    solIds.push(sol.id);

    const [tec] = await db.insert(schema.membro).values({
      nome: `Tecnico ${r}`,
      email: `tec-${r}@dbg.test`,
      isTecnico: true,
    }).returning();
    tecIds.push(tec.id);

    const [os] = await db.insert(schema.ordemServico).values({
      solicitacaoId: sol.id,
      categoria: "ELETRICA",
      tipo: "NORMAL",
      estado: "CONCLUIDA",
      tecnicoId: tec.id,
    }).returning();
    osIds.push(os.id);

    await db.insert(schema.avaliacao).values({
      osId: os.id,
      tecnicoId: tec.id,
      nota: 2,
      atorToken: "tok",
      ip: "127.0.0.1",
      invalida: false,
    });

    return { os, sol, tec };
  }

  it("INV1 — tracer: invalidar com motivo marca invalida=true e sai da média", async () => {
    const token = `tok-inv1-${Math.random().toString(36).slice(2, 10)}`;
    const { os, tec } = await seedContexto(token);

    const repo = criarAvaliacaoRepoDrizzle(db);
    await repo.invalidarAvaliacao(os.id, "Spam/abuso", "admin@dbg.test");

    const [salvo] = await db
      .select()
      .from(schema.avaliacao)
      .where(eq(schema.avaliacao.osId, os.id));

    expect(salvo.invalida).toBe(true);
    expect(salvo.motivoInvalidacao).toBe("Spam/abuso");
    expect(salvo.invalidadaPor).toBe("admin@dbg.test");
    expect(salvo.invalidadaEm).toBeDefined();

    // Deve sair da média
    const notaRepo = criarNotaTecnicoRepoDrizzle(db);
    const nota = await notaRepo.obterNotaMedia(tec.id);
    expect(nota!.total).toBe(0);
  });

  it("INV2: motivo vazio lança MotivoObrigatorioError", async () => {
    const token = `tok-inv2-${Math.random().toString(36).slice(2, 10)}`;
    const { os } = await seedContexto(token);

    const repo = criarAvaliacaoRepoDrizzle(db);
    await expect(repo.invalidarAvaliacao(os.id, "", "admin@dbg.test"))
      .rejects.toThrow(MotivoObrigatorioError);
  });

  it("INV3: motivo em branco (espaços) lança MotivoObrigatorioError", async () => {
    const token = `tok-inv3-${Math.random().toString(36).slice(2, 10)}`;
    const { os } = await seedContexto(token);

    const repo = criarAvaliacaoRepoDrizzle(db);
    await expect(repo.invalidarAvaliacao(os.id, "   ", "admin@dbg.test"))
      .rejects.toThrow(MotivoObrigatorioError);
  });
});
