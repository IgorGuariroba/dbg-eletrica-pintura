import { config } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("CampoRepo Drizzle — listarTecnicosEmCampo", () => {
  let repo: import("@/operacao/campo-repo").CampoRepo;
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");

  // IDs criados neste arquivo (cleanup no afterAll)
  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let membroIds: string[] = [];

  // ----- Helpers de seed -----

  async function seedMembro(opts?: { whatsapp?: string }) {
    const r = Math.random().toString(36).slice(2, 10);
    const [m] = await dbRaw
      .insert(schema.membro)
      .values({
        nome: `Tec ${r}`,
        email: `tec-${r}@dbg.test`,
        isTecnico: true,
        especialidades: ["ELETRICA"],
        // whatsapp não existe no schema membro; guardamos o número no cliente
      })
      .returning();
    membroIds.push(m.id);
    void opts;
    return m;
  }

  async function seedCliente() {
    const r = Math.random().toString(36).slice(2, 10);
    const [c] = await dbRaw
      .insert(schema.cliente)
      .values({
        nome: `Cli ${r}`,
        whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)),
      })
      .returning();
    clienteIds.push(c.id);
    return c;
  }

  async function seedOsEmEstado(
    estado: "A_CAMINHO" | "NO_LOCAL" | "EM_EXECUCAO",
    tecnicoId: string,
    categoria: "ELETRICA" | "PINTURA" = "ELETRICA",
  ) {
    const r = Math.random().toString(36).slice(2, 10);
    const cliente = await seedCliente();
    const [sol] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: `tok-${r}`,
        clienteId: cliente.id,
        categorias: [categoria],
        descricao: null,
        fotosUrls: [],
        endereco: {
          logradouro: "Rua Teste, 10",
          cidade: "São Paulo",
          uf: "SP",
        },
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
        estado,
        tecnicoId,
      })
      .returning();
    solicitacaoIds.push(sol.id);

    // Registrar a transição que colocou a OS no estado atual
    const transicaoAnterior: Record<string, string> = {
      A_CAMINHO: "APROVADA",
      NO_LOCAL: "A_CAMINHO",
      EM_EXECUCAO: "NO_LOCAL",
    };
    await dbRaw.insert(schema.transicaoOs).values({
      osId: os.id,
      estadoAnterior: transicaoAnterior[estado] as import("@/operacao/fila-repo").EstadoOs,
      estadoNovo: estado as import("@/operacao/fila-repo").EstadoOs,
      atorEmail: "tec@dbg.test",
      em: new Date(),
    });

    return os;
  }

  async function seedFotoAntes(osId: string, tecnicoId: string) {
    await dbRaw.insert(schema.fotoPortfolio).values({
      osId,
      tecnicoId,
      categoria: "ELETRICA",
      tipo: "ANTES",
      chavePrivada: `os/${osId}/antes/test-${Math.random().toString(36).slice(2)}.jpg`,
    });
  }

  // ----- Setup -----

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    const { criarCampoRepoDrizzle } = await import(
      "@/operacao/campo-repo-drizzle"
    );
    dbRaw = dbMod.db;
    repo = criarCampoRepoDrizzle(dbMod.db);
  });

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
    membroIds = [];
  });

  afterAll(async () => {
    const { inArray, eq } = await import("drizzle-orm");

    // Remove fotos de portfolio de teste
    if (solicitacaoIds.length) {
      const osRows = await dbRaw
        .select({ id: schema.ordemServico.id })
        .from(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      const osIds = osRows.map((r) => r.id);
      if (osIds.length) {
        await dbRaw
          .delete(schema.fotoPortfolio)
          .where(inArray(schema.fotoPortfolio.osId, osIds));
        await dbRaw
          .delete(schema.transicaoOs)
          .where(inArray(schema.transicaoOs.osId, osIds));
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
    if (membroIds.length) {
      await dbRaw
        .delete(schema.membro)
        .where(inArray(schema.membro.id, membroIds));
    }
  });

  // ----- Testes -----

  it("retorna apenas OS em estados de campo (A_CAMINHO, NO_LOCAL, EM_EXECUCAO)", async () => {
    const tec = await seedMembro();
    const osACaminho = await seedOsEmEstado("A_CAMINHO", tec.id);
    const osNoLocal = await seedOsEmEstado("NO_LOCAL", tec.id);
    const osEmExecucao = await seedOsEmEstado("EM_EXECUCAO", tec.id);

    const resultado = await repo.listarTecnicosEmCampo();
    const ids = resultado.map((r) => r.osId);

    expect(ids).toContain(osACaminho.id);
    expect(ids).toContain(osNoLocal.id);
    expect(ids).toContain(osEmExecucao.id);
    // Garante que só estados de campo aparecem
    expect(
      resultado.every((r) =>
        ["A_CAMINHO", "NO_LOCAL", "EM_EXECUCAO"].includes(r.estado),
      ),
    ).toBe(true);
  });

  it("ordenação padrão: maior tempo no estado primeiro (ultimaTransicaoEm ASC)", async () => {
    const tec = await seedMembro();

    // Cria OS com transições em momentos diferentes (mais antiga primeiro)
    const r1 = Math.random().toString(36).slice(2, 10);
    const r2 = Math.random().toString(36).slice(2, 10);
    const cli1 = await seedCliente();
    const cli2 = await seedCliente();

    const [sol1] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: `tok-${r1}`,
        clienteId: cli1.id,
        categorias: ["ELETRICA"],
        descricao: null,
        fotosUrls: [],
        endereco: { logradouro: "Rua A", cidade: "SP", uf: "SP" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "FORMULARIO",
      })
      .returning();
    const [sol2] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: `tok-${r2}`,
        clienteId: cli2.id,
        categorias: ["ELETRICA"],
        descricao: null,
        fotosUrls: [],
        endereco: { logradouro: "Rua B", cidade: "SP", uf: "SP" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "FORMULARIO",
      })
      .returning();
    solicitacaoIds.push(sol1.id, sol2.id);

    const [osAntiga] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol1.id,
        categoria: "ELETRICA",
        tipo: "NORMAL",
        estado: "A_CAMINHO",
        tecnicoId: tec.id,
      })
      .returning();
    const [osNova] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol2.id,
        categoria: "ELETRICA",
        tipo: "NORMAL",
        estado: "A_CAMINHO",
        tecnicoId: tec.id,
      })
      .returning();

    // Transição antiga (há 2 horas)
    const doisAtras = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const umaAtras = new Date(Date.now() - 1 * 60 * 60 * 1000);

    await dbRaw.insert(schema.transicaoOs).values({
      osId: osAntiga.id,
      estadoAnterior: "APROVADA",
      estadoNovo: "A_CAMINHO",
      atorEmail: "tec@dbg.test",
      em: doisAtras,
    });
    await dbRaw.insert(schema.transicaoOs).values({
      osId: osNova.id,
      estadoAnterior: "APROVADA",
      estadoNovo: "A_CAMINHO",
      atorEmail: "tec@dbg.test",
      em: umaAtras,
    });

    const resultado = await repo.listarTecnicosEmCampo();
    const idsDeTeste = resultado.filter((r) =>
      [osAntiga.id, osNova.id].includes(r.osId),
    );
    // A OS mais antiga no estado deve vir primeiro
    const posAntiga = idsDeTeste.findIndex((r) => r.osId === osAntiga.id);
    const posNova = idsDeTeste.findIndex((r) => r.osId === osNova.id);
    expect(posAntiga).toBeLessThan(posNova);
  });

  it("filtra por estado", async () => {
    const tec = await seedMembro();
    const osACaminho = await seedOsEmEstado("A_CAMINHO", tec.id);
    const osNoLocal = await seedOsEmEstado("NO_LOCAL", tec.id);

    const resultado = await repo.listarTecnicosEmCampo({
      estado: "A_CAMINHO",
    });
    const ids = resultado.map((r) => r.osId);
    expect(ids).toContain(osACaminho.id);
    expect(ids).not.toContain(osNoLocal.id);
  });

  it("filtra por técnico", async () => {
    const tec1 = await seedMembro();
    const tec2 = await seedMembro();
    const osTec1 = await seedOsEmEstado("A_CAMINHO", tec1.id);
    await seedOsEmEstado("A_CAMINHO", tec2.id);

    const resultado = await repo.listarTecnicosEmCampo({
      tecnicoId: tec1.id,
    });
    const ids = resultado.map((r) => r.osId);
    expect(ids).toContain(osTec1.id);
    expect(resultado.every((r) => r.tecnicoId === tec1.id)).toBe(true);
  });

  it("filtra por categoria", async () => {
    const tec = await seedMembro();
    const osEletrica = await seedOsEmEstado("A_CAMINHO", tec.id, "ELETRICA");
    const osPintura = await seedOsEmEstado("A_CAMINHO", tec.id, "PINTURA");

    const resultado = await repo.listarTecnicosEmCampo({
      categoria: "ELETRICA",
    });
    const ids = resultado.map((r) => r.osId);
    expect(ids).toContain(osEletrica.id);
    expect(ids).not.toContain(osPintura.id);
  });

  it("badge inconsistente: EM_EXECUCAO sem foto antes aparece com inconsistente=true", async () => {
    const tec = await seedMembro();
    const os = await seedOsEmEstado("EM_EXECUCAO", tec.id);

    // Não semeia foto antes — deve ser inconsistente
    const resultado = await repo.listarTecnicosEmCampo();
    const linha = resultado.find((r) => r.osId === os.id);
    expect(linha).toBeDefined();
    expect(linha!.inconsistente).toBe(true);
  });

  it("badge inconsistente: EM_EXECUCAO COM foto antes aparece com inconsistente=false", async () => {
    const tec = await seedMembro();
    const os = await seedOsEmEstado("EM_EXECUCAO", tec.id);
    await seedFotoAntes(os.id, tec.id);

    const resultado = await repo.listarTecnicosEmCampo();
    const linha = resultado.find((r) => r.osId === os.id);
    expect(linha).toBeDefined();
    expect(linha!.inconsistente).toBe(false);
  });

  it("A_CAMINHO nunca aparece como inconsistente (foto antes não é requisito)", async () => {
    const tec = await seedMembro();
    const os = await seedOsEmEstado("A_CAMINHO", tec.id);

    const resultado = await repo.listarTecnicosEmCampo();
    const linha = resultado.find((r) => r.osId === os.id);
    expect(linha).toBeDefined();
    expect(linha!.inconsistente).toBe(false);
  });
});
