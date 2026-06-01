import { config as loadEnv } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { agendaDoTecnico } from "@/operacao/agenda-tecnico";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Agenda do técnico Integration", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");

  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let membroIds: string[] = [];

  async function seedTecnico() {
    const r = Math.random().toString(36).slice(2, 10);
    const [m] = await dbRaw
      .insert(schema.membro)
      .values({
        nome: `Tecnico ${r}`,
        email: `tec-${r}@dbg.test`,
        isTecnico: true,
        ativo: true,
        especialidades: ["ELETRICA"],
      })
      .returning();
    membroIds.push(m.id);
    return m.id;
  }

  async function seedOs(tecnicoId: string | null, estado: string, agendadoPara: Date | null) {
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
        categorias: ["ELETRICA"],
        endereco: { logradouro: "Rua das Flores", numero: "10", cidade: "SP", uf: "SP" },
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
        tecnicoId,
        agendadoPara,
      })
      .returning();
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    return os.id;
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
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

  it("agenda traz só OS do técnico em [hoje, hoje+7d] ativas ordenadas por horário", async () => {
    const tecId = await seedTecnico();
    const outroTecId = await seedTecnico();

    const agora = new Date("2026-06-01T12:00:00Z"); // segunda-feira

    // 1. OS do técnico no range (hoje, terça, segunda da outra semana)
    const os1 = await seedOs(tecId, "AGENDADA", new Date("2026-06-01T14:00:00Z")); // hoje mais tarde
    const os2 = await seedOs(tecId, "A_CAMINHO", new Date("2026-06-03T10:00:00Z")); // quarta-feira
    const os3 = await seedOs(tecId, "EM_EXECUCAO", new Date("2026-06-08T16:00:00Z")); // segunda da outra semana (hoje + 7 dias)

    // 2. OS do técnico fora do range (ontem, hoje+8 dias)
    const osOntem = await seedOs(tecId, "AGENDADA", new Date("2026-05-31T10:00:00Z"));
    const osFuturo = await seedOs(tecId, "AGENDADA", new Date("2026-06-09T08:00:00Z")); // hoje + 8 dias

    // 3. OS do técnico no range mas inativas (concluída, cancelada)
    const osConcluida = await seedOs(tecId, "CONCLUIDA", new Date("2026-06-02T10:00:00Z"));
    const osCancelada = await seedOs(tecId, "CANCELADA", new Date("2026-06-04T10:00:00Z"));

    // 4. OS de outro técnico no range
    const osOutro = await seedOs(outroTecId, "AGENDADA", new Date("2026-06-02T10:00:00Z"));

    const agenda = await agendaDoTecnico(dbRaw, tecId, agora);

    expect(agenda).toHaveLength(3);
    // Ordenado por horário
    expect(agenda[0].osId).toBe(os1);
    expect(agenda[1].osId).toBe(os2);
    expect(agenda[2].osId).toBe(os3);

    // Estrutura
    expect(agenda[0]).toEqual({
      osId: os1,
      categoria: "ELETRICA",
      agendadoPara: expect.any(Date),
      endereco: "Rua das Flores, 10, SP/SP",
      estado: "AGENDADA",
    });
  });
});
