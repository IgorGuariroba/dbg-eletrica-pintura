import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db as dbClient } from "@/db/client";
import * as schema from "@/db/schema";
import { criarTratativaRepoDrizzle } from "@/marketing/tratativa-repo-drizzle";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Tratativa CRUD (Bloco TR)", () => {
  let db: typeof dbClient;
  const osIds: string[] = [];
  const solIds: string[] = [];
  const cliIds: string[] = [];
  const tecIds: string[] = [];
  const alertaIds: string[] = [];

  beforeAll(() => {
    db = dbClient;
  });

  afterEach(async () => {
    if (alertaIds.length) {
      await db.delete(schema.tratativa).where(inArray(schema.tratativa.alertaAvaliacaoId, alertaIds));
      await db.delete(schema.alertaAvaliacao).where(inArray(schema.alertaAvaliacao.id, alertaIds));
      alertaIds.length = 0;
    }
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
      descricao: "teste tratativa",
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

    const [alerta] = await db.insert(schema.alertaAvaliacao).values({
      osId: os.id,
      solicitacaoId: sol.id,
      tecnicoId: tec.id,
      nota: 2,
      status: "PENDENTE",
    }).returning();
    alertaIds.push(alerta.id);

    return { os, sol, tec, alerta };
  }

  it("TR1 — tracer: criar tratativa persiste no banco", async () => {
    const token = `tok-tr1-${Math.random().toString(36).slice(2, 10)}`;
    const { os, tec, alerta } = await seedContexto(token);

    const repo = criarTratativaRepoDrizzle(db);
    await repo.criar({
      alertaAvaliacaoId: alerta.id,
      osId: os.id,
      tipo: "LIGOU",
      descricao: "Liguei para o cliente e ele ficou satisfeito",
      responsavelId: tec.id,
      data: new Date(),
    });

    const [salvo] = await db
      .select()
      .from(schema.tratativa)
      .where(eq(schema.tratativa.alertaAvaliacaoId, alerta.id));

    expect(salvo).toBeDefined();
    expect(salvo.tipo).toBe("LIGOU");
    expect(salvo.descricao).toBe("Liguei para o cliente e ele ficou satisfeito");
    expect(salvo.responsavelId).toBe(tec.id);
  });

  it("TR2: listarPorAlerta retorna tratativas do alerta", async () => {
    const token = `tok-tr2-${Math.random().toString(36).slice(2, 10)}`;
    const { os, tec, alerta } = await seedContexto(token);

    const repo = criarTratativaRepoDrizzle(db);
    await repo.criar({
      alertaAvaliacaoId: alerta.id,
      osId: os.id,
      tipo: "DESCONTO",
      descricao: "Oferecemos 20% de desconto",
      responsavelId: null,
      data: new Date(),
    });
    await repo.criar({
      alertaAvaliacaoId: alerta.id,
      osId: os.id,
      tipo: "OUTRO",
      descricao: "Contato via WhatsApp",
      responsavelId: tec.id,
      data: new Date(),
    });

    const tratativas = await repo.listarPorAlerta(alerta.id);

    expect(tratativas).toHaveLength(2);
    const tipos = tratativas.map(t => t.tipo);
    expect(tipos).toContain("DESCONTO");
    expect(tipos).toContain("OUTRO");
  });
});
