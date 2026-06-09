import { config } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("SolicitacaoRepo Drizzle", () => {
  let repo: import("@/operacao/solicitacao-repo").SolicitacaoRepo;
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    const { criarSolicitacaoRepoDrizzle } = await import(
      "@/operacao/solicitacao-repo-drizzle"
    );
    dbRaw = dbMod.db;
    repo = criarSolicitacaoRepoDrizzle(dbMod.db);
  });

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
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
  });

  async function rand() {
    return Math.random().toString(36).slice(2, 10);
  }

  it("cria solicitação com 3 categorias e gera 3 OS NOVA", async () => {
    const r = await rand();
    const out = await repo.criarComOrdens({
      cliente: {
        nome: `Teste ${r}`,
        whatsapp: `11${Math.floor(Math.random() * 1e9)
          .toString()
          .padStart(9, "0")}`,
      },
      solicitacao: {
        token: `tok-${r}`,
        categorias: ["ELETRICA", "PINTURA", "DRYWALL"],
        descricao: "test",
        fotosUrls: [],
        endereco: { logradouro: "Rua X", cidade: "SP", uf: "SP" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "FORMULARIO",
      },
    });
    clienteIds.push(out.cliente.id);
    solicitacaoIds.push(out.solicitacao.id);

    expect(out.ordens).toHaveLength(3);
    expect(out.ordens.every((o) => o.estado === "NOVA")).toBe(true);
    expect(out.ordens.every((o) => o.tipo === "NORMAL")).toBe(true);
    expect(out.ordens.map((o) => o.categoria).sort()).toEqual([
      "DRYWALL",
      "ELETRICA",
      "PINTURA",
    ]);

    const lido = await repo.buscarPorToken(out.solicitacao.token);
    expect(lido?.solicitacao.id).toBe(out.solicitacao.id);
    expect(lido?.ordens).toHaveLength(3);
  });

  it("upsert cliente por WhatsApp (mesmo número → mesmo cliente)", async () => {
    const r = await rand();
    const wpp = `11${Math.floor(Math.random() * 1e9)
      .toString()
      .padStart(9, "0")}`;
    const a = await repo.criarComOrdens({
      cliente: { nome: `A ${r}`, whatsapp: wpp },
      solicitacao: {
        token: `tok-a-${r}`,
        categorias: ["ELETRICA"],
        descricao: null,
        fotosUrls: [],
        endereco: { logradouro: "Rua A", cidade: "SP", uf: "SP" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "FORMULARIO",
      },
    });
    const b = await repo.criarComOrdens({
      cliente: { nome: `A novo ${r}`, whatsapp: wpp },
      solicitacao: {
        token: `tok-b-${r}`,
        categorias: ["PINTURA"],
        descricao: null,
        fotosUrls: [],
        endereco: { logradouro: "Rua B", cidade: "SP", uf: "SP" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "FORMULARIO",
      },
    });
    clienteIds.push(a.cliente.id);
    solicitacaoIds.push(a.solicitacao.id, b.solicitacao.id);

    expect(b.cliente.id).toBe(a.cliente.id);
    // Nome do primeiro cadastro é preservado (coalesce protege contra defacement)
    expect(b.cliente.nome).toBe(`A ${r}`);
  });

  it("persiste foraCobertura = true quando a solicitação é criada fora da cobertura", async () => {
    const r = await rand();
    const out = await repo.criarComOrdens({
      cliente: {
        nome: `Teste ${r}`,
        whatsapp: `11${Math.floor(Math.random() * 1e9)
          .toString()
          .padStart(9, "0")}`,
      },
      solicitacao: {
        token: `tok-${r}`,
        categorias: ["ELETRICA"],
        descricao: "test",
        fotosUrls: [],
        endereco: { logradouro: "Rua X", cidade: "SP", uf: "SP" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "FORMULARIO",
        foraCobertura: true,
      },
    });
    clienteIds.push(out.cliente.id);
    solicitacaoIds.push(out.solicitacao.id);

    expect(out.solicitacao.foraCobertura).toBe(true);

    const lido = await repo.buscarPorToken(out.solicitacao.token);
    expect(lido?.solicitacao.foraCobertura).toBe(true);
  });

  it("persiste foraCobertura = false quando a solicitação é criada dentro da cobertura (ou não informada)", async () => {
    const r = await rand();
    const out = await repo.criarComOrdens({
      cliente: {
        nome: `Teste ${r}`,
        whatsapp: `11${Math.floor(Math.random() * 1e9)
          .toString()
          .padStart(9, "0")}`,
      },
      solicitacao: {
        token: `tok-${r}`,
        categorias: ["ELETRICA"],
        descricao: "test",
        fotosUrls: [],
        endereco: { logradouro: "Rua X", cidade: "SP", uf: "SP" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "FORMULARIO",
        foraCobertura: false,
      },
    });
    clienteIds.push(out.cliente.id);
    solicitacaoIds.push(out.solicitacao.id);

    expect(out.solicitacao.foraCobertura).toBe(false);

    const lido = await repo.buscarPorToken(out.solicitacao.token);
    expect(lido?.solicitacao.foraCobertura).toBe(false);
  });

  it("registra indicação quando solicitado com indicadorId válido", async () => {
    const r = await rand();
    
    // 1. Cria o cliente indicador
    const [indicador] = await dbRaw
      .insert(schema.cliente)
      .values({
        nome: `Indicador ${r}`,
        whatsapp: `11${Math.floor(Math.random() * 1e9).toString().padStart(9, "0")}`,
      })
      .returning();
    
    clienteIds.push(indicador.id);

    // 2. Cria a solicitação do cliente indicado passando o indicadorId
    const out = await repo.criarComOrdens({
      cliente: {
        nome: `Indicado ${r}`,
        whatsapp: `11${Math.floor(Math.random() * 1e9).toString().padStart(9, "0")}`,
      },
      solicitacao: {
        token: `tok-ind-${r}`,
        categorias: ["ELETRICA"],
        descricao: "teste indicação",
        fotosUrls: [],
        endereco: { logradouro: "Rua Y", cidade: "SP", uf: "SP" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "FORMULARIO",
      },
      indicadorId: indicador.id, // Parâmetro novo a ser implementado
    });

    clienteIds.push(out.cliente.id);
    solicitacaoIds.push(out.solicitacao.id);

    // 3. Verifica se a linha de indicação foi criada no banco
    const { eq } = await import("drizzle-orm");
    const [row] = await dbRaw
      .select()
      .from(schema.indicacao)
      .where(eq(schema.indicacao.indicadoId, out.cliente.id))
      .limit(1);

    expect(row).toBeDefined();
    expect(row.indicadorId).toBe(indicador.id);
    expect(row.indicadoId).toBe(out.cliente.id);
    expect(row.descontoAplicado).toBe(false);
    expect(row.creditoGerado).toBe(false);
  });
});
