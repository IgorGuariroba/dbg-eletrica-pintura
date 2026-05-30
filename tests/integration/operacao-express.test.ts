import { config } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Solicitacao Express Integration", () => {
  let repo: import("@/operacao/solicitacao-repo").SolicitacaoRepo;
  let filaRepo: import("@/operacao/fila-repo").FilaRepo;
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let membroIds: string[] = [];

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    const { criarSolicitacaoRepoDrizzle } = await import(
      "@/operacao/solicitacao-repo-drizzle"
    );
    const { criarFilaRepoDrizzle } = await import(
      "@/operacao/fila-repo-drizzle"
    );
    dbRaw = dbMod.db;
    repo = criarSolicitacaoRepoDrizzle(dbMod.db);
    filaRepo = criarFilaRepoDrizzle(dbMod.db);
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
    if (membroIds.length) {
      await dbRaw
        .delete(schema.membro)
        .where(inArray(schema.membro.id, membroIds));
    }
    if (clienteIds.length) {
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    }
  });

  async function seedTecnico() {
    const r = Math.random().toString(36).slice(2, 10);
    const [m] = await dbRaw
      .insert(schema.membro)
      .values({
        nome: `Tec Express ${r}`,
        email: `tec-${r}@dbg.test`,
        isTecnico: true,
        especialidades: ["ELETRICA", "PINTURA"],
      })
      .returning();
    membroIds.push(m.id);
    return m.id;
  }

  it("cria solicitacao express com origem EXPRESS_TECNICO e OS em estado ORCADA e tipo EXPRESS atribuidas ao tecnico", async () => {
    const tecnicoId = await seedTecnico();
    const r = Math.random().toString(36).slice(2, 10);
    
    const out = await repo.criarComOrdens({
      cliente: {
        nome: `Cliente Express ${r}`,
        whatsapp: `119${Math.floor(10000000 + Math.random() * 90000000)}`,
      },
      solicitacao: {
        token: `tok-exp-${r}`,
        categorias: ["ELETRICA", "PINTURA"],
        descricao: "Solicitação criada no local pelo técnico",
        fotosUrls: [],
        endereco: { logradouro: "Rua Express", cidade: "São Paulo", uf: "SP" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "EXPRESS_TECNICO",
      },
      ordensCustom: {
        tipo: "EXPRESS",
        estado: "ORCADA",
        tecnicoId,
      },
    });

    clienteIds.push(out.cliente.id);
    solicitacaoIds.push(out.solicitacao.id);

    // 1. Validar a Solicitação
    expect(out.solicitacao.origem).toBe("EXPRESS_TECNICO");
    expect(out.solicitacao.lgpdAceito).toBe(true);

    // 2. Validar as OS geradas
    expect(out.ordens).toHaveLength(2);
    expect(out.ordens.every((o) => o.tipo === "EXPRESS")).toBe(true);
    expect(out.ordens.every((o) => o.estado === "ORCADA")).toBe(true);
    expect(out.ordens.every((o) => o.tecnicoId === tecnicoId)).toBe(true);

    // 3. Buscar e validar persistência
    const lido = await repo.buscarPorToken(out.solicitacao.token);
    expect(lido).not.toBeNull();
    expect(lido?.ordens).toHaveLength(2);
    expect(lido?.ordens.every((o) => o.tipo === "EXPRESS")).toBe(true);
    expect(lido?.ordens.every((o) => o.estado === "ORCADA")).toBe(true);
    expect(lido?.ordens.every((o) => o.tecnicoId === tecnicoId)).toBe(true);
  });

  it("OS Express com tecnico atribuido nao deve aparecer na fila publica de OS abertas", async () => {
    const tecnicoId = await seedTecnico();
    const r = Math.random().toString(36).slice(2, 10);
    
    const out = await repo.criarComOrdens({
      cliente: {
        nome: `Cli Fila ${r}`,
        whatsapp: `119${Math.floor(10000000 + Math.random() * 90000000)}`,
      },
      solicitacao: {
        token: `tok-fila-${r}`,
        categorias: ["ELETRICA"],
        descricao: "Express a ocultar",
        fotosUrls: [],
        endereco: { logradouro: "Rua X", cidade: "São Paulo", uf: "SP" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "EXPRESS_TECNICO",
      },
      ordensCustom: {
        tipo: "EXPRESS",
        estado: "ORCADA",
        tecnicoId,
      },
    });

    clienteIds.push(out.cliente.id);
    solicitacaoIds.push(out.solicitacao.id);

    // Listar a fila pública (sem especialidade / especialidade ELETRICA)
    const fila = await filaRepo.listar({
      apenasDisponiveis: true,
      categorias: ["ELETRICA"],
      limit: 50,
      offset: 0,
    });

    const ids = fila.itens.map((o) => o.id);
    // As OS geradas do tipo EXPRESS já com técnico não devem constar na fila pública
    for (const os of out.ordens) {
      expect(ids).not.toContain(os.id);
    }
  });

  it("tecnico ve a OS Express criada na sua lista de atribuídas", async () => {
    const tecnicoId = await seedTecnico();
    const r = Math.random().toString(36).slice(2, 10);
    
    const out = await repo.criarComOrdens({
      cliente: {
        nome: `Cli Atrib ${r}`,
        whatsapp: `119${Math.floor(10000000 + Math.random() * 90000000)}`,
      },
      solicitacao: {
        token: `tok-atrib-${r}`,
        categorias: ["ELETRICA"],
        descricao: "Express a listar nas dele",
        fotosUrls: [],
        endereco: { logradouro: "Rua Y", cidade: "São Paulo", uf: "SP" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "EXPRESS_TECNICO",
      },
      ordensCustom: {
        tipo: "EXPRESS",
        estado: "ORCADA",
        tecnicoId,
      },
    });

    clienteIds.push(out.cliente.id);
    solicitacaoIds.push(out.solicitacao.id);

    // Buscar lista de OS atribuídas ao técnico
    const atribuídas = await filaRepo.listarPorTecnico(tecnicoId);
    const ids = atribuídas.map((o) => o.id);

    expect(atribuídas).toHaveLength(1);
    expect(ids).toContain(out.ordens[0].id);
  });
});
