import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

/**
 * Cobertura do adapter Drizzle nos caminhos admin/técnico: `buscarOs`,
 * `liberarAgendamento` e o catch de violação única que vira SlotIndisponivelError.
 * O fluxo cliente (buscarOsComToken + salvarAgendamento feliz) já é coberto em
 * operacao-agendamento-cliente.test.ts.
 */
describe.skipIf(!hasDb)("Agendamento admin/técnico (adapter Drizzle) Integration", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let service: import("@/operacao/agendamento").AgendamentoService;

  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let membroIds: string[] = [];

  async function seedTecnico(categoria: string) {
    const r = Math.random().toString(36).slice(2, 10);
    const [m] = await dbRaw
      .insert(schema.membro)
      .values({
        nome: `Tec ${categoria} ${r}`,
        email: `tec-${r}@dbg.test`,
        isTecnico: true,
        ativo: true,
        especialidades: [categoria as any],
        disponibilidade: { qua: { inicio: "08:00", fim: "18:00" } },
      })
      .returning();
    membroIds.push(m.id);
    return m.id;
  }

  async function seedOs(opts: {
    categoria: string;
    estado: string;
    tecnicoId?: string | null;
    agendadoPara?: Date | null;
  }) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({ nome: `Cli ${r}`, whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)) })
      .returning();
    const [sol] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: `tok-${r}`,
        clienteId: cli.id,
        categorias: [opts.categoria as any],
        endereco: { logradouro: "Rua X", cidade: "SP", uf: "SP" },
        lgpdAceito: true,
        origem: "FORMULARIO",
      })
      .returning();
    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: opts.categoria as any,
        tipo: "NORMAL",
        estado: opts.estado as any,
        tecnicoId: opts.tecnicoId ?? null,
        agendadoPara: opts.agendadoPara ?? null,
      })
      .returning();
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    return { id: os.id, token: sol.token };
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;

    const { criarAgendamentoRepoDrizzle } = await import("@/operacao/agendamento-repo-drizzle");
    const { criarAgendamentoService } = await import("@/operacao/agendamento");
    service = criarAgendamentoService(criarAgendamentoRepoDrizzle(dbMod.db));
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
        await dbRaw.delete(schema.transicaoOs).where(inArray(schema.transicaoOs.osId, osIds));
      }
      await dbRaw.delete(schema.ordemServico).where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      await dbRaw.delete(schema.solicitacao).where(inArray(schema.solicitacao.id, solicitacaoIds));
    }
    if (membroIds.length) {
      await dbRaw.delete(schema.membro).where(inArray(schema.membro.id, membroIds));
    }
    if (clienteIds.length) {
      await dbRaw.delete(schema.cliente).where(inArray(schema.cliente.id, clienteIds));
    }
  });

  it("reagendarAdmin persiste novo slot/técnico e registra transição (buscarOs + salvarAgendamento)", async () => {
    const { eq } = await import("drizzle-orm");
    const tec = await seedTecnico("ELETRICA");
    const { id: os } = await seedOs({
      categoria: "ELETRICA",
      estado: "EM_EXECUCAO",
      tecnicoId: tec,
      agendadoPara: new Date("2026-06-10T11:00:00Z"),
    });

    const novoSlot = new Date("2026-06-17T11:00:00Z");
    await service.reagendarAdmin(os, "admin@dbg.com.br", novoSlot, tec);

    const [row] = await dbRaw
      .select({ estado: schema.ordemServico.estado, agendadoPara: schema.ordemServico.agendadoPara })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, os));
    expect(row.estado).toBe("AGENDADA");
    expect(new Date(row.agendadoPara!).toISOString()).toBe(novoSlot.toISOString());

    const trans = await dbRaw
      .select()
      .from(schema.transicaoOs)
      .where(eq(schema.transicaoOs.osId, os));
    expect(trans).toHaveLength(1);
    expect(trans[0].estadoNovo).toBe("AGENDADA");
    expect(trans[0].atorEmail).toBe("admin@dbg.com.br");
  });

  it("cancelarAdmin libera a OS para APROVADA e zera técnico/horário (liberarAgendamento)", async () => {
    const { eq } = await import("drizzle-orm");
    const tec = await seedTecnico("ELETRICA");
    const { id: os } = await seedOs({
      categoria: "ELETRICA",
      estado: "AGENDADA",
      tecnicoId: tec,
      agendadoPara: new Date("2026-06-10T11:00:00Z"),
    });

    await service.cancelarAdmin(os, "admin@dbg.com.br", "Cancelamento administrativo de teste");

    const [row] = await dbRaw
      .select({
        estado: schema.ordemServico.estado,
        tecnicoId: schema.ordemServico.tecnicoId,
        agendadoPara: schema.ordemServico.agendadoPara,
      })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, os));
    expect(row.estado).toBe("APROVADA");
    expect(row.tecnicoId).toBeNull();
    expect(row.agendadoPara).toBeNull();
  });

  it("cancelarLoteAdmin marca CANCELADA as válidas e reporta as inexistentes", async () => {
    const { eq } = await import("drizzle-orm");
    const tec = await seedTecnico("ELETRICA");
    const { id: os } = await seedOs({
      categoria: "ELETRICA",
      estado: "AGENDADA",
      tecnicoId: tec,
      agendadoPara: new Date("2026-06-10T11:00:00Z"),
    });

    const res = await service.cancelarLoteAdmin(
      [os, "00000000-0000-0000-0000-000000000000"],
      "admin@dbg.com.br",
      "Cancelamento em lote de teste"
    );

    expect(res.find((r) => r.osId === os)?.ok).toBe(true);
    expect(res.find((r) => r.osId !== os)?.ok).toBe(false);

    const [row] = await dbRaw
      .select({ estado: schema.ordemServico.estado })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, os));
    expect(row.estado).toBe("CANCELADA");
  });

  it("converte violação de slot único em SlotIndisponivelError (catch do salvarAgendamento)", async () => {
    const { SlotIndisponivelError } = await import("@/operacao/agendamento");
    const tec = await seedTecnico("ELETRICA");
    const { id: osA } = await seedOs({ categoria: "ELETRICA", estado: "AGENDADA", tecnicoId: tec });
    const { id: osB } = await seedOs({ categoria: "ELETRICA", estado: "AGENDADA", tecnicoId: tec });

    const slot = new Date("2026-06-24T11:00:00Z");
    await service.reagendarTecnico(osA, tec, "t@dbg.com.br", slot, null);

    await expect(
      service.reagendarTecnico(osB, tec, "t@dbg.com.br", slot, null)
    ).rejects.toBeInstanceOf(SlotIndisponivelError);
  });

  it("rethrow de erro de banco não-único (FK inexistente) sem virar SlotIndisponivelError", async () => {
    const { SlotIndisponivelError } = await import("@/operacao/agendamento");
    const { id: os } = await seedOs({ categoria: "ELETRICA", estado: "AGENDADA" });
    const tecInexistente = "00000000-0000-0000-0000-000000000000";

    const erro = await service
      .reagendarAdmin(os, "admin@dbg.com.br", new Date("2026-06-30T11:00:00Z"), tecInexistente)
      .then(() => null, (e) => e);

    expect(erro).toBeInstanceOf(Error);
    expect(erro).not.toBeInstanceOf(SlotIndisponivelError);
  });
});
