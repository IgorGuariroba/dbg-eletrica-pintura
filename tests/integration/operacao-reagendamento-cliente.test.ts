import { config as loadEnv } from "dotenv";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

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

describe.skipIf(!hasDb)("Reagendamento/Cancelamento do cliente Integration", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let loader: typeof import("@/operacao/slots-loader");
  let repo: import("@/operacao/reagendamento").ReagendamentoRepo;
  let mod: typeof import("@/operacao/reagendamento");

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

  async function seedOs(categoria: string, estado: string, tecnicoId: string | null, agendadoPara: Date | null) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({ nome: `Cli ${r}`, whatsapp: `55119${r}` })
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
        tecnicoId,
        agendadoPara,
      })
      .returning();
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    return { osId: os.id, whatsapp: cli.whatsapp };
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    loader = await import("@/operacao/slots-loader");
    mod = await import("@/operacao/reagendamento");
    repo = (await import("@/operacao/reagendamento-repo-drizzle")).criarReagendamentoRepoDrizzle(dbMod.db);
  });

  afterEach(async () => {
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
    clienteIds = [];
    solicitacaoIds = [];
    membroIds = [];
  });

  it("Cliente reagenda 25h antes → libera slot anterior + reserva novo slot", async () => {
    const tecId = await seedTecnico("ELETRICA");
    
    // Slot 1: DIA às 08h local (11h UTC). Slot 2: DIA às 10h local (13h UTC).
    const slot1 = new Date(`${DIA}T11:00:00Z`);
    const slot2 = new Date(`${DIA}T13:00:00Z`);

    const { osId, whatsapp } = await seedOs("ELETRICA", "AGENDADA", tecId, slot1);

    // No momento inicial, listando slots para ELETRICA, slot1 está ocupado, apenas slot2 está livre.
    const slotsIniciais = await loader.listarSlotsDisponiveis(
      dbRaw,
      {
        inicio: new Date(`${DIA}T00:00:00Z`),
        fim: new Date(`${DIA}T23:59:59Z`),
        categoria: "ELETRICA",
      },
      { configRepo: configRepoFixo() }
    );
    expect(slotsIniciais.map((s) => s.inicio.toISOString())).not.toContain(slot1.toISOString());
    expect(slotsIniciais.map((s) => s.inicio.toISOString())).toContain(slot2.toISOString());

    // Reagenda: 25h antes (agora = slot1 - 25h)
    const agora = new Date(slot1.getTime() - 25 * 60 * 60 * 1000);
    await mod.reagendarOsCliente(osId, { whatsapp }, slot2, tecId, repo, agora);

    // Após o reagendamento, slot1 deve estar livre e slot2 ocupado.
    const slotsFinais = await loader.listarSlotsDisponiveis(
      dbRaw,
      {
        inicio: new Date(`${DIA}T00:00:00Z`),
        fim: new Date(`${DIA}T23:59:59Z`),
        categoria: "ELETRICA",
      },
      { configRepo: configRepoFixo() }
    );
    expect(slotsFinais.map((s) => s.inicio.toISOString())).toContain(slot1.toISOString());
    expect(slotsFinais.map((s) => s.inicio.toISOString())).not.toContain(slot2.toISOString());

    // Verificar no banco que a OS está agora no slot2 e continua AGENDADA
    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select()
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId))
      .limit(1);
    expect(os.estado).toBe("AGENDADA");
    expect(os.agendadoPara?.toISOString()).toBe(slot2.toISOString());
  });

  it("Cliente cancela → slot volta a ficar disponível e OS = APROVADA", async () => {
    const tecId = await seedTecnico("ELETRICA");
    // Slot 1: DIA às 08h local (11h UTC).
    const slot1 = new Date(`${DIA}T11:00:00Z`);

    const { osId, whatsapp } = await seedOs("ELETRICA", "AGENDADA", tecId, slot1);

    // Slot 1 está ocupado inicialmente
    const slotsIniciais = await loader.listarSlotsDisponiveis(
      dbRaw,
      {
        inicio: new Date(`${DIA}T00:00:00Z`),
        fim: new Date(`${DIA}T23:59:59Z`),
        categoria: "ELETRICA",
      },
      { configRepo: configRepoFixo() }
    );
    expect(slotsIniciais.map((s) => s.inicio.toISOString())).not.toContain(slot1.toISOString());

    // Cancela 25h antes
    const agora = new Date(slot1.getTime() - 25 * 60 * 60 * 1000);
    await mod.cancelarOsCliente(osId, { whatsapp }, repo, agora);

    // Após cancelamento, slot1 deve voltar a ficar livre.
    const slotsFinais = await loader.listarSlotsDisponiveis(
      dbRaw,
      {
        inicio: new Date(`${DIA}T00:00:00Z`),
        fim: new Date(`${DIA}T23:59:59Z`),
        categoria: "ELETRICA",
      },
      { configRepo: configRepoFixo() }
    );
    expect(slotsFinais.map((s) => s.inicio.toISOString())).toContain(slot1.toISOString());

    // OS deve estar como APROVADA, sem tecnicoId e sem data agendada
    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select()
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId))
      .limit(1);
    expect(os.estado).toBe("APROVADA");
    expect(os.tecnicoId).toBeNull();
    expect(os.agendadoPara).toBeNull();
  });
});
