import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Slot reservation and concurrency Integration", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: import("@/operacao/reserva-slot").ReservaSlotRepo;
  let mod: typeof import("@/operacao/reserva-slot");

  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let membroIds: string[] = [];

  async function seedOs(estado: string) {
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
        estado: estado as any,
        tecnicoId: null,
        agendadoPara: null,
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
    mod = await import("@/operacao/reserva-slot");
    repo = (
      await import("@/operacao/reserva-slot-repo-drizzle")
    ).criarReservaSlotRepoDrizzle(dbMod.db);
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

  it("reservaSlot atualiza o estado para AGENDADA e cria registro de histórico", async () => {
    const { osId, tecnicoId } = await seedOs("APROVADA");
    const agendadoPara = new Date("2026-06-10T10:00:00Z");

    await mod.reservarSlot(
      {
        osId,
        tecnicoId,
        agendadoPara,
        atorEmail: "admin@dbg.com",
      },
      { reservaRepo: repo }
    );

    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select()
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId))
      .limit(1);

    expect(os.estado).toBe("AGENDADA");
    expect(os.tecnicoId).toBe(tecnicoId);
    expect(new Date(os.agendadoPara!).getTime()).toBe(agendadoPara.getTime());

    const transicoes = await dbRaw
      .select()
      .from(schema.transicaoOs)
      .where(eq(schema.transicaoOs.osId, osId));
    expect(transicoes).toHaveLength(1);
    expect(transicoes[0].estadoAnterior).toBe("APROVADA");
    expect(transicoes[0].estadoNovo).toBe("AGENDADA");
    expect(transicoes[0].atorEmail).toBe("admin@dbg.com");
  });

  it("impede agendamento direto se a OS estiver em estado de execução ativo (ex: EM_EXECUCAO)", async () => {
    const { osId, tecnicoId } = await seedOs("EM_EXECUCAO");
    const agendadoPara = new Date("2026-06-10T10:00:00Z");

    await expect(
      mod.reservarSlot(
        {
          osId,
          tecnicoId,
          agendadoPara,
          atorEmail: "admin@dbg.com",
        },
        { reservaRepo: repo }
      )
    ).rejects.toThrow(mod.ReservaInvalidaError);
  });

  it("impede reserva concorrente para o mesmo técnico e mesmo horário", async () => {
    const { osId: os1, tecnicoId } = await seedOs("APROVADA");
    
    // Cria uma segunda OS para o mesmo cliente/tecnico
    const r = Math.random().toString(36).slice(2, 10);
    const [cli2] = await dbRaw
      .insert(schema.cliente)
      .values({ nome: `Cli ${r}`, whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)) })
      .returning();
    const [sol2] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: `tok-${r}`,
        clienteId: cli2.id,
        categorias: ["ELETRICA"],
        endereco: { logradouro: "Rua Y", cidade: "SP", uf: "SP" },
        lgpdAceito: true,
        origem: "FORMULARIO",
      })
      .returning();
    const [os2] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol2.id,
        categoria: "ELETRICA",
        tipo: "NORMAL",
        estado: "APROVADA",
        tecnicoId: null,
        agendadoPara: null,
      })
      .returning();
    
    clienteIds.push(cli2.id);
    solicitacaoIds.push(sol2.id);

    const agendadoPara = new Date("2026-06-12T14:00:00Z");

    // 1. Agenda a primeira OS com sucesso
    await mod.reservarSlot(
      {
        osId: os1,
        tecnicoId,
        agendadoPara,
        atorEmail: "admin@dbg.com",
      },
      { reservaRepo: repo }
    );

    // 2. Tenta agendar a segunda OS no mesmo slot para o mesmo técnico -> deve falhar com SlotIndisponivelError
    await expect(
      mod.reservarSlot(
        {
          osId: os2.id,
          tecnicoId,
          agendadoPara,
          atorEmail: "admin2@dbg.com",
        },
        { reservaRepo: repo }
      )
    ).rejects.toBeInstanceOf(mod.SlotIndisponivelError);
  });

  describe("listarSlotsDisponiveis Integration", () => {
    function configRepoFixo() {
      return {
        async obter() {
          return {
            precoLitro: "6.00",
            kmPorLitro: "10.00",
            horarioComercial: {
              seg: { inicio: "08:00", fim: "12:00" }, // 4 slots de 60 min (8h, 9h, 10h, 11h)
            },
          };
        },
        async atualizar(c: any) {
          return c;
        },
      };
    }

    it("carrega slots disponíveis para técnicos ativos com a especialidade no banco", async () => {
      const loader = await import("@/operacao/slots-loader");
      
      // 1. Seed um técnico ativo com especialidade ELETRICA e disponibilidade na segunda-feira
      const r = Math.random().toString(36).slice(2, 10);
      const [tec] = await dbRaw
        .insert(schema.membro)
        .values({
          nome: `Tec Slots ${r}`,
          email: `tec-slots-${r}@dbg.test`,
          isTecnico: true,
          especialidades: ["ELETRICA"],
          disponibilidade: {
            seg: { inicio: "08:00", fim: "12:00" },
          },
          ativo: true,
        })
        .returning();
      membroIds.push(tec.id);

      // 2026-06-01 é uma segunda-feira
      const inicio = new Date("2026-06-01T00:00:00Z");
      const fim = new Date("2026-06-01T23:59:59Z");

      const slots = await loader.listarSlotsDisponiveis(
        dbRaw,
        {
          inicio,
          fim,
          categoria: "ELETRICA",
        },
        { configRepo: configRepoFixo() }
      );

      // Deve listar os slots do técnico criado
      const slotsDoTecnico = slots.filter(s => s.tecnicoId === tec.id);
      expect(slotsDoTecnico).toHaveLength(4);
      expect(slotsDoTecnico[0].inicio.getUTCHours()).toBe(8);
      expect(slotsDoTecnico[3].inicio.getUTCHours()).toBe(11);
    });

    it("não retorna slots ocupados por ordens de serviço ativas", async () => {
      const loader = await import("@/operacao/slots-loader");

      // 1. Seed técnico
      const r = Math.random().toString(36).slice(2, 10);
      const [tec] = await dbRaw
        .insert(schema.membro)
        .values({
          nome: `Tec Ocupado ${r}`,
          email: `tec-ocupado-${r}@dbg.test`,
          isTecnico: true,
          especialidades: ["ELETRICA"],
          disponibilidade: {
            seg: { inicio: "08:00", fim: "12:00" },
          },
          ativo: true,
        })
        .returning();
      membroIds.push(tec.id);

      // 2. Seed cliente e solicitação
      const [cli] = await dbRaw
        .insert(schema.cliente)
        .values({ nome: `Cli Ocupado ${r}`, whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)) })
        .returning();
      const [sol] = await dbRaw
        .insert(schema.solicitacao)
        .values({
          token: `tok-ocup-${r}`,
          clienteId: cli.id,
          categorias: ["ELETRICA"],
          endereco: { logradouro: "Rua Ocupada", cidade: "SP", uf: "SP" },
          lgpdAceito: true,
          origem: "FORMULARIO",
        })
        .returning();
      
      // 3. Seed uma OS ocupando o slot das 10:00 na segunda-feira 2026-06-01
      const [os] = await dbRaw
        .insert(schema.ordemServico)
        .values({
          solicitacaoId: sol.id,
          categoria: "ELETRICA",
          tipo: "NORMAL",
          estado: "AGENDADA", // Estado ativo
          tecnicoId: tec.id,
          agendadoPara: new Date("2026-06-01T10:00:00Z"),
        })
        .returning();

      clienteIds.push(cli.id);
      solicitacaoIds.push(sol.id);

      const inicio = new Date("2026-06-01T00:00:00Z");
      const fim = new Date("2026-06-01T23:59:59Z");

      const slots = await loader.listarSlotsDisponiveis(
        dbRaw,
        {
          inicio,
          fim,
          categoria: "ELETRICA",
        },
        { configRepo: configRepoFixo() }
      );

      const slotsDoTecnico = slots.filter(s => s.tecnicoId === tec.id);
      
      // O slot das 10h deve sumir, restando apenas 3 slots (8h, 9h, 11h)
      expect(slotsDoTecnico).toHaveLength(3);
      const contemSlot10h = slotsDoTecnico.some(s => s.inicio.getUTCHours() === 10);
      expect(contemSlot10h).toBe(false);
    });
  });
});
