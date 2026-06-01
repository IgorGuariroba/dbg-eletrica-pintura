import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

// Quarta-feira (2026-06-01 é segunda, logo +9 dias cai numa quarta).
const DIA = "2026-06-10";
const JANELA = { inicio: "08:00", fim: "12:00" };

function configRepoFixo() {
  return {
    async obter() {
      return {
        precoLitro: "6.00",
        kmPorLitro: "10.00",
        horarioComercial: { qua: JANELA },
      };
    },
    async atualizar(c: any) {
      return c;
    },
  };
}

describe.skipIf(!hasDb)("Agendamento do cliente (instant booking) Integration", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let loader: typeof import("@/operacao/slots-loader");
  let reserva: typeof import("@/operacao/reserva-slot");
  let repo: import("@/operacao/reserva-slot").ReservaSlotRepo;
  let booking: typeof import("@/operacao/agendamento-cliente");

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
    return os.id;
  }

  /** Repete o que a action faz: lista slots, colapsa por horário e reserva. */
  async function agendar(osId: string, categoria: string) {
    const slots = await loader.listarSlotsDisponiveis(
      dbRaw,
      {
        inicio: new Date(`${DIA}T00:00:00Z`),
        fim: new Date(`${DIA}T23:59:59Z`),
        categoria: categoria as any,
      },
      { configRepo: configRepoFixo() },
    );
    const oferecidos = booking.slotsPorHorario(slots);
    const escolhido = booking.escolherSlot(oferecidos, oferecidos[0].inicio.toISOString());
    await reserva.reservarSlot(
      {
        osId,
        tecnicoId: escolhido.tecnicoId,
        agendadoPara: escolhido.inicio,
        atorEmail: "cliente:tok-test",
      },
      { reservaRepo: repo },
    );
    return escolhido.tecnicoId;
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    loader = await import("@/operacao/slots-loader");
    reserva = await import("@/operacao/reserva-slot");
    booking = await import("@/operacao/agendamento-cliente");
    repo = (await import("@/operacao/reserva-slot-repo-drizzle")).criarReservaSlotRepoDrizzle(dbMod.db);
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

  it("agenda 2 OS de categorias diferentes em técnicos diferentes", async () => {
    const tecEletrica = await seedTecnico("ELETRICA");
    const tecPintura = await seedTecnico("PINTURA");
    const osEletrica = await seedOs("ELETRICA", "APROVADA");
    const osPintura = await seedOs("PINTURA", "APROVADA");

    const t1 = await agendar(osEletrica, "ELETRICA");
    const t2 = await agendar(osPintura, "PINTURA");

    expect(t1).toBe(tecEletrica);
    expect(t2).toBe(tecPintura);
    expect(t1).not.toBe(t2);

    const { eq, inArray } = await import("drizzle-orm");
    const rows = await dbRaw
      .select({ id: schema.ordemServico.id, estado: schema.ordemServico.estado })
      .from(schema.ordemServico)
      .where(inArray(schema.ordemServico.id, [osEletrica, osPintura]));
    expect(rows.every((r) => r.estado === "AGENDADA")).toBe(true);

    // Cada OS tem exatamente uma transição APROVADA → AGENDADA.
    const trans = await dbRaw
      .select()
      .from(schema.transicaoOs)
      .where(eq(schema.transicaoOs.osId, osEletrica));
    expect(trans).toHaveLength(1);
    expect(trans[0].estadoNovo).toBe("AGENDADA");
  });

  it("não duplica reserva ao tentar agendar OS já AGENDADA", async () => {
    await seedTecnico("ELETRICA");
    const osId = await seedOs("ELETRICA", "AGENDADA");

    await expect(agendar(osId, "ELETRICA")).rejects.toBeInstanceOf(
      reserva.ReservaInvalidaError,
    );
  });
});
