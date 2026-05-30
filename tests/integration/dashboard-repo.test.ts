import { config } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("DashboardRepo Drizzle (contadores de OS)", () => {
  let repo: import("@/features/dashboard/dashboard").DashboardRepo;
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

  async function seedOs(
    categoria: "ELETRICA" | "PINTURA",
    estado: "NOVA" | "ORCADA",
    tecnicoId: string | null = null,
  ) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({
        nome: `Cli ${r}`,
        whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)),
      })
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
      .values({ solicitacaoId: sol.id, categoria, tipo: "NORMAL", estado, tecnicoId })
      .returning();
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    return os.id;
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    const { criarDashboardRepoDrizzle } = await import(
      "@/features/dashboard/dashboard-repo-drizzle"
    );
    dbRaw = dbMod.db;
    repo = criarDashboardRepoDrizzle(dbMod.db);
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
      await dbRaw.delete(schema.cliente).where(inArray(schema.cliente.id, clienteIds));
    }
    if (membroIds.length) {
      await dbRaw.delete(schema.membro).where(inArray(schema.membro.id, membroIds));
    }
  });

  it("conta OS por estado/atribuição refletindo o que foi semeado", async () => {
    await seedOs("ELETRICA", "NOVA"); // entra na fila + minha fila ELETRICA
    await seedOs("PINTURA", "NOVA"); // entra na fila, NÃO na fila ELETRICA
    await seedOs("ELETRICA", "ORCADA"); // aguardando aprovação, fora da fila

    // Contadores globais: outros arquivos de teste rodam em paralelo no mesmo
    // banco. As linhas semeadas aqui só são removidas no afterAll, então um
    // limite inferior absoluto (>=) é estável — concorrência só soma rows.
    expect(await repo.contarOsNovasNaFila()).toBeGreaterThanOrEqual(2);
    expect(await repo.contarOsAguardandoAprovacao()).toBeGreaterThanOrEqual(1);
    expect(await repo.contarOsCriadasHoje()).toBeGreaterThanOrEqual(3);
    expect(await repo.contarMinhaFila(["ELETRICA"])).toBeGreaterThanOrEqual(1);
    // Lista vazia de especialidades nunca conta nada — determinístico.
    expect(await repo.contarMinhaFila([])).toBe(0);
  });

  it("conta apenas as OS atribuídas ao técnico informado", async () => {
    const tec = await seedTecnico();
    expect(await repo.contarOsAtribuidasA(tec)).toBe(0);
    await seedOs("ELETRICA", "NOVA", tec);
    await seedOs("ELETRICA", "ORCADA", tec);
    expect(await repo.contarOsAtribuidasA(tec)).toBe(2);
  });
});
