import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

// Quarta-feira (2026-06-01 é segunda, logo +9 dias cai numa quarta).
const DIA = "2026-06-10";
const JANELA = { inicio: "08:00", fim: "12:00" };

describe.skipIf(!hasDb)("Agendamento do cliente (instant booking) Integration", () => {
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
        disponibilidade: { qua: JANELA },
      })
      .returning();
    membroIds.push(m.id);
    return m.id;
  }

  async function seedOs(categoria: string, estado: string) {
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
        categorias: [categoria as any],
        endereco: { logradouro: "Rua X", cidade: "SP", uf: "SP" },
        lgpdAceito: true,
        origem: "FORMULARIO",
      })
      .returning();
    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: categoria as any,
        tipo: "NORMAL",
        estado: estado as any,
        tecnicoId: null,
        agendadoPara: null,
      })
      .returning();
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    return { osId: os.id, token: sol.token };
  }

  async function agendar(token: string, osId: string) {
    const slots = await service.obterSlotsCliente(token, osId);
    const escolhido = slots[0];
    if (!escolhido) {
      throw new Error(`Nenhum slot disponível encontrado para a OS ${osId}`);
    }
    await service.agendarCliente(token, osId, escolhido.inicio);
    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select({ tecnicoId: schema.ordemServico.tecnicoId })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId));
    return os.tecnicoId;
  }

  let configOriginal: any = null;

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;

    const { eq } = await import("drizzle-orm");
    const [row] = await dbRaw
      .select()
      .from(schema.operacaoConfig)
      .where(eq(schema.operacaoConfig.id, "default"))
      .limit(1);
    configOriginal = row;

    const configTeste = {
      seg: { inicio: "08:00", fim: "18:00" },
      ter: { inicio: "08:00", fim: "18:00" },
      qua: { inicio: "08:00", fim: "18:00" },
      qui: { inicio: "08:00", fim: "18:00" },
      sex: { inicio: "08:00", fim: "18:00" },
      sab: { inicio: "08:00", fim: "12:00" },
    };

    if (configOriginal) {
      await dbRaw
        .update(schema.operacaoConfig)
        .set({ horarioComercial: configTeste })
        .where(eq(schema.operacaoConfig.id, "default"));
    } else {
      await dbRaw
        .insert(schema.operacaoConfig)
        .values({
          id: "default",
          precoLitro: "6.00",
          kmPorLitro: "10.00",
          horarioComercial: configTeste,
        });
    }

    const { criarAgendamentoRepoDrizzle } = await import("@/operacao/agendamento-repo-drizzle");
    const { criarAgendamentoService } = await import("@/operacao/agendamento");
    const repo = criarAgendamentoRepoDrizzle(dbMod.db);
    service = criarAgendamentoService(repo);
  });

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
    membroIds = [];
  });

  afterAll(async () => {
    const { eq, inArray } = await import("drizzle-orm");

    if (configOriginal) {
      await dbRaw
        .update(schema.operacaoConfig)
        .set({ horarioComercial: configOriginal.horarioComercial })
        .where(eq(schema.operacaoConfig.id, "default"));
    } else {
      await dbRaw
        .delete(schema.operacaoConfig)
        .where(eq(schema.operacaoConfig.id, "default"));
    }

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

  it("agenda 2 OS de categorias diferentes em técnicos diferentes", async () => {
    const tecEletrica = await seedTecnico("ELETRICA");
    const tecPintura = await seedTecnico("PINTURA");
    const osEletrica = await seedOs("ELETRICA", "APROVADA");
    const osPintura = await seedOs("PINTURA", "APROVADA");

    const t1 = await agendar(osEletrica.token, osEletrica.osId);
    const t2 = await agendar(osPintura.token, osPintura.osId);

    expect(t1).toBeDefined();
    expect(t2).toBeDefined();
    expect(t1).not.toBe(t2);

    const { eq, inArray } = await import("drizzle-orm");
    const [tecEletricaDb] = await dbRaw
      .select({ especialidades: schema.membro.especialidades })
      .from(schema.membro)
      .where(eq(schema.membro.id, t1!));
    expect(tecEletricaDb.especialidades).toContain("ELETRICA");

    const [tecPinturaDb] = await dbRaw
      .select({ especialidades: schema.membro.especialidades })
      .from(schema.membro)
      .where(eq(schema.membro.id, t2!));
    expect(tecPinturaDb.especialidades).toContain("PINTURA");
    const rows = await dbRaw
      .select({ id: schema.ordemServico.id, estado: schema.ordemServico.estado })
      .from(schema.ordemServico)
      .where(inArray(schema.ordemServico.id, [osEletrica.osId, osPintura.osId]));
    expect(rows.every((r) => r.estado === "AGENDADA")).toBe(true);

    // Cada OS tem exatamente uma transição APROVADA → AGENDADA.
    const trans = await dbRaw
      .select()
      .from(schema.transicaoOs)
      .where(eq(schema.transicaoOs.osId, osEletrica.osId));
    expect(trans).toHaveLength(1);
    expect(trans[0].estadoNovo).toBe("AGENDADA");
  });

  it("não duplica reserva ao tentar agendar OS já AGENDADA", async () => {
    await seedTecnico("ELETRICA");
    const os = await seedOs("ELETRICA", "AGENDADA");

    const { OsNaoAgendavelError } = await import("@/operacao/agendamento");
    await expect(agendar(os.token, os.osId)).rejects.toBeInstanceOf(
      OsNaoAgendavelError,
    );
  });
});
