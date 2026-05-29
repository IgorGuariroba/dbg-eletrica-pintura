import { config } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("FilaRepo Drizzle", () => {
  let repo: import("@/operacao/fila-repo").FilaRepo;
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let membroIds: string[] = [];

  async function seedTecnico() {
    const r = Math.random().toString(36).slice(2, 10);
    const [m] = await dbRaw
      .insert(schema.membro)
      .values({
        nome: `Tec ${r}`,
        email: `tec-${r}@dbg.test`,
        isTecnico: true,
        especialidades: ["ELETRICA"],
      })
      .returning();
    membroIds.push(m.id);
    return m.id;
  }

  async function seedOs(categoria: "ELETRICA" | "PINTURA") {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({ nome: `Cli ${r}`, whatsapp: `11${Date.now()}${Math.floor(Math.random() * 1e3)}`.slice(0, 13) })
      .returning();
    const [sol] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: `tok-${r}`,
        clienteId: cli.id,
        categorias: [categoria],
        descricao: null,
        fotosUrls: [],
        endereco: { logradouro: "Rua X", cidade: "SP", uf: "SP" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "FORMULARIO",
      })
      .returning();
    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria,
        tipo: "NORMAL",
        estado: "NOVA",
      })
      .returning();
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    return os.id;
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    const { criarFilaRepoDrizzle } = await import(
      "@/operacao/fila-repo-drizzle"
    );
    dbRaw = dbMod.db;
    repo = criarFilaRepoDrizzle(dbMod.db);
  });

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
    membroIds = [];
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (solicitacaoIds.length) {
      await dbRaw
        .delete(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      await dbRaw
        .delete(schema.solicitacao)
        .where(inArray(schema.solicitacao.id, solicitacaoIds));
    }
    if (clienteIds.length) {
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    }
    if (membroIds.length) {
      await dbRaw
        .delete(schema.membro)
        .where(inArray(schema.membro.id, membroIds));
    }
  });

  it("filtra fila do técnico pela especialidade (ELETRICA não vê PINTURA)", async () => {
    const osEletrica = await seedOs("ELETRICA");
    await seedOs("PINTURA");
    const r = await repo.listar({
      apenasDisponiveis: true,
      categorias: ["ELETRICA"],
      limit: 50,
      offset: 0,
    });
    const ids = r.itens.map((o) => o.id);
    expect(ids).toContain(osEletrica);
    expect(r.itens.every((o) => o.categoria === "ELETRICA")).toBe(true);
  });

  it("técnico continua vendo na fila a OS NOVA que ele pegou (pra devolver)", async () => {
    const osId = await seedOs("ELETRICA");
    const tec = await seedTecnico();
    await repo.autoatribuir(osId, tec);
    const r = await repo.listar({
      apenasDisponiveis: true,
      incluirTecnicoId: tec,
      categorias: ["ELETRICA"],
      limit: 50,
      offset: 0,
    });
    const minha = r.itens.find((o) => o.id === osId);
    expect(minha?.tecnicoId).toBe(tec);
  });

  it("técnico não vê OS NOVA atribuída a outro técnico", async () => {
    const osId = await seedOs("ELETRICA");
    const dono = await seedTecnico();
    const outro = await seedTecnico();
    await repo.autoatribuir(osId, dono);
    const r = await repo.listar({
      apenasDisponiveis: true,
      incluirTecnicoId: outro,
      categorias: ["ELETRICA"],
      limit: 50,
      offset: 0,
    });
    expect(r.itens.some((o) => o.id === osId)).toBe(false);
  });

  it("self-assign concorrente: só um técnico vence a corrida", async () => {
    const osId = await seedOs("ELETRICA");
    const tecA = await seedTecnico();
    const tecB = await seedTecnico();
    const [a, b] = await Promise.all([
      repo.autoatribuir(osId, tecA),
      repo.autoatribuir(osId, tecB),
    ]);
    const vencedores = [a, b].filter((x) => x !== null);
    expect(vencedores).toHaveLength(1);
  });

  it("devolver limpa técnico e registra motivo em metadados", async () => {
    const osId = await seedOs("ELETRICA");
    const tec = await seedTecnico();
    await repo.autoatribuir(osId, tec);
    const devolvida = await repo.devolver(osId, tec, "fora da área");
    expect(devolvida?.tecnicoId).toBeNull();

    const { eq } = await import("drizzle-orm");
    const [row] = await dbRaw
      .select()
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId))
      .limit(1);
    expect(row.metadados.devolucoes?.[0]?.motivo).toBe("fora da área");
  });

  it("não devolve OS de outro técnico", async () => {
    const osId = await seedOs("ELETRICA");
    const dono = await seedTecnico();
    const intruso = await seedTecnico();
    await repo.autoatribuir(osId, dono);
    const r = await repo.devolver(osId, intruso, "tentativa");
    expect(r).toBeNull();
  });
});
