import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);
const cfg = { precoLitro: "6.00", kmPorLitro: "10" };

describe.skipIf(!hasDb)("Orçamento Complementar Integration", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: import("@/operacao/complementar").ComplementarRepo;
  let criarComplementar: typeof import("@/operacao/complementar").criarComplementar;
  let filaRepo: import("@/operacao/fila-repo").FilaRepo;

  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let membroIds: string[] = [];
  let servicoIds: string[] = [];

  async function seedPaiEmExecucao() {
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
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({ nome: `Cli ${r}`, whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)) })
      .returning();
    const [sol] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: `tok-${r}`,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        descricao: null,
        fotosUrls: [],
        endereco: { logradouro: "Rua X", cidade: "SP", uf: "SP" },
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "FORMULARIO",
      })
      .returning();
    const [pai] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "ELETRICA",
        tipo: "NORMAL",
        estado: "EM_EXECUCAO",
        tecnicoId: m.id,
      })
      .returning();
    const [srv] = await dbRaw
      .insert(schema.servico)
      .values({
        nome: `Srv ${r}`,
        categoria: "ELETRICA",
        precoBase: "100",
        unidade: "PONTO",
        prazoGarantiaMeses: 3,
        ativo: true,
      })
      .returning();
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    membroIds.push(m.id);
    servicoIds.push(srv.id);
    return { paiId: pai.id, tecnicoId: m.id, servicoId: srv.id };
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    const mod = await import("@/operacao/complementar");
    criarComplementar = mod.criarComplementar;
    repo = (
      await import("@/operacao/complementar-repo-drizzle")
    ).criarComplementarRepoDrizzle(dbMod.db);
    filaRepo = (
      await import("@/operacao/fila-repo-drizzle")
    ).criarFilaRepoDrizzle(dbMod.db);
  });

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
    membroIds = [];
    servicoIds = [];
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (solicitacaoIds.length) {
      const osRows = await dbRaw
        .select({ id: schema.ordemServico.id })
        .from(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      const osIds = osRows.map((o) => o.id);
      if (osIds.length) {
        await dbRaw
          .delete(schema.orcamento)
          .where(inArray(schema.orcamento.osId, osIds));
        // Filhas (osPaiId) primeiro para não violar a FK auto-referente.
        await dbRaw
          .delete(schema.ordemServico)
          .where(inArray(schema.ordemServico.osPaiId, osIds));
        await dbRaw
          .delete(schema.ordemServico)
          .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      }
      await dbRaw
        .delete(schema.solicitacao)
        .where(inArray(schema.solicitacao.id, solicitacaoIds));
    }
    if (servicoIds.length) {
      await dbRaw.delete(schema.servico).where(inArray(schema.servico.id, servicoIds));
    }
    if (membroIds.length) {
      await dbRaw.delete(schema.membro).where(inArray(schema.membro.id, membroIds));
    }
    if (clienteIds.length) {
      await dbRaw.delete(schema.cliente).where(inArray(schema.cliente.id, clienteIds));
    }
  });

  it("nasce COMPLEMENTAR ORÇADA vinculada à pai, com orçamento e técnico do criador", async () => {
    const { paiId, tecnicoId, servicoId } = await seedPaiEmExecucao();

    const out = await criarComplementar(
      { osPaiId: paiId, itens: [{ servicoId, quantidade: "2" }], km: 10 },
      { membroId: tecnicoId, isTecnico: true },
      cfg,
      repo,
    );

    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select()
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, out.osId))
      .limit(1);
    expect(os.tipo).toBe("COMPLEMENTAR");
    expect(os.estado).toBe("ORCADA");
    expect(os.osPaiId).toBe(paiId);
    expect(os.categoria).toBe("ELETRICA");
    expect(os.tecnicoId).toBe(tecnicoId);

    const [orc] = await dbRaw
      .select()
      .from(schema.orcamento)
      .where(eq(schema.orcamento.osId, out.osId))
      .limit(1);
    expect(orc.total).toBe("206.00"); // 2×100 + 6 deslocamento
  });

  it("não aparece na fila pública de OS abertas", async () => {
    const { paiId, tecnicoId, servicoId } = await seedPaiEmExecucao();
    const out = await criarComplementar(
      { osPaiId: paiId, itens: [{ servicoId, quantidade: "1" }], km: 5 },
      { membroId: tecnicoId, isTecnico: true },
      cfg,
      repo,
    );
    const fila = await filaRepo.listar({
      apenasDisponiveis: true,
      categorias: ["ELETRICA"],
      limit: 50,
      offset: 0,
    });
    expect(fila.itens.map((o) => o.id)).not.toContain(out.osId);
  });

  it("listarComplementares retorna as filhas da pai", async () => {
    const { paiId, tecnicoId, servicoId } = await seedPaiEmExecucao();
    const out = await criarComplementar(
      { osPaiId: paiId, itens: [{ servicoId, quantidade: "1" }], km: 5 },
      { membroId: tecnicoId, isTecnico: true },
      cfg,
      repo,
    );
    const filhas = await repo.listarComplementares(paiId);
    expect(filhas.map((f) => f.id)).toContain(out.osId);
  });

  it("marcarAguardando grava metadado na pai sem apagar os existentes", async () => {
    const { paiId, tecnicoId, servicoId } = await seedPaiEmExecucao();
    const out = await criarComplementar(
      { osPaiId: paiId, itens: [{ servicoId, quantidade: "1" }], km: 5 },
      { membroId: tecnicoId, isTecnico: true },
      cfg,
      repo,
    );
    await repo.marcarAguardando(paiId, out.osId);

    const { eq } = await import("drizzle-orm");
    const [pai] = await dbRaw
      .select({ metadados: schema.ordemServico.metadados })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, paiId))
      .limit(1);
    expect(pai.metadados.aguardandoComplementar).toBe(true);
    expect(pai.metadados.complementarId).toBe(out.osId);
  });
});
