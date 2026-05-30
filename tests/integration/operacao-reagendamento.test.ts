import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Reagendamento/Cancelamento técnico Integration", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: import("@/operacao/reagendamento").ReagendamentoRepo;
  let filaRepo: import("@/operacao/fila-repo").FilaRepo;
  let mod: typeof import("@/operacao/reagendamento");

  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let membroIds: string[] = [];

  const tecnico = (membroId: string) => ({ membroId, email: "tec@dbg.com" });

  async function seedOs(estado: string, agendado: boolean) {
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
    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "ELETRICA",
        tipo: "NORMAL",
        estado: estado as never,
        tecnicoId: m.id,
        agendadoPara: agendado ? new Date("2026-06-01T10:00:00Z") : null,
      })
      .returning();
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    membroIds.push(m.id);
    return { osId: os.id, tecnicoId: m.id };
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    mod = await import("@/operacao/reagendamento");
    repo = (
      await import("@/operacao/reagendamento-repo-drizzle")
    ).criarReagendamentoRepoDrizzle(dbMod.db);
    filaRepo = (
      await import("@/operacao/fila-repo-drizzle")
    ).criarFilaRepoDrizzle(dbMod.db);
  });

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
    membroIds = [];
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
          .delete(schema.transicaoOs)
          .where(inArray(schema.transicaoOs.osId, osIds));
      }
      await dbRaw
        .delete(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      await dbRaw
        .delete(schema.solicitacao)
        .where(inArray(schema.solicitacao.id, solicitacaoIds));
    }
    if (membroIds.length) {
      await dbRaw.delete(schema.membro).where(inArray(schema.membro.id, membroIds));
    }
    if (clienteIds.length) {
      await dbRaw.delete(schema.cliente).where(inArray(schema.cliente.id, clienteIds));
    }
  });

  it("cancelar devolve à fila (AGENDADA, técnico null) com histórico e visível ao admin", async () => {
    const { osId, tecnicoId } = await seedOs("A_CAMINHO", true);
    await mod.cancelarOsTecnico(
      osId,
      tecnico(tecnicoId),
      "cliente não estava no local combinado",
      repo,
    );

    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select()
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId))
      .limit(1);
    expect(os.estado).toBe("AGENDADA");
    expect(os.tecnicoId).toBeNull();

    const trans = await dbRaw
      .select()
      .from(schema.transicaoOs)
      .where(eq(schema.transicaoOs.osId, osId));
    const cancel = trans.find((t) => t.estadoAnterior === "A_CAMINHO");
    expect(cancel?.motivo).toBe("cliente não estava no local combinado");

    // Admin (sem apenasDisponiveis) enxerga a OS devolvida na fila.
    const fila = await filaRepo.listar({ limit: 200, offset: 0 });
    expect(fila.itens.map((o) => o.id)).toContain(osId);
  });

  it("cancelar sem agendamento regride para ORÇADA", async () => {
    const { osId, tecnicoId } = await seedOs("APROVADA", false);
    await mod.cancelarOsTecnico(
      osId,
      tecnico(tecnicoId),
      "não consigo atender este endereço hoje",
      repo,
    );
    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select()
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId))
      .limit(1);
    expect(os.estado).toBe("ORCADA");
    expect(os.tecnicoId).toBeNull();
  });

  it("reagendar atualiza o slot e mantém AGENDADA", async () => {
    const { osId, tecnicoId } = await seedOs("AGENDADA", true);
    const novo = new Date("2026-06-10T15:00:00Z");
    await mod.reagendarOsTecnico(osId, tecnico(tecnicoId), novo, null, repo);

    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select()
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId))
      .limit(1);
    expect(os.estado).toBe("AGENDADA");
    expect(os.agendadoPara?.toISOString()).toBe(novo.toISOString());
    expect(os.tecnicoId).toBe(tecnicoId); // reagendar mantém o técnico
  });
});
