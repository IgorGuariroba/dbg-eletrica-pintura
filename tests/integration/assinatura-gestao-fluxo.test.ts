import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Gestão de assinatura — fluxo (Drizzle)", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let eq: typeof import("drizzle-orm").eq;
  let inArray: typeof import("drizzle-orm").inArray;
  let clienteIds: string[] = [];
  let planoIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let osIds: string[] = [];
  let preapprovalIds: string[] = [];

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    ({ eq, inArray } = await import("drizzle-orm"));
  });

  beforeEach(() => {
    clienteIds = [];
    planoIds = [];
    solicitacaoIds = [];
    osIds = [];
    preapprovalIds = [];
  });

  afterAll(async () => {
    if (osIds.length)
      await dbRaw
        .delete(schema.ordemServico)
        .where(inArray(schema.ordemServico.id, osIds));
    if (preapprovalIds.length)
      await dbRaw
        .delete(schema.assinatura)
        .where(inArray(schema.assinatura.preapprovalIdMp, preapprovalIds));
    if (solicitacaoIds.length)
      await dbRaw
        .delete(schema.solicitacao)
        .where(inArray(schema.solicitacao.id, solicitacaoIds));
    if (planoIds.length)
      await dbRaw.delete(schema.plano).where(inArray(schema.plano.id, planoIds));
    if (clienteIds.length)
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
  });

  async function seedCliente(whatsapp: string, email: string | null) {
    const r = Math.random().toString(36).slice(2, 8);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({ nome: `Cli ${r}`, whatsapp, email })
      .returning();
    clienteIds.push(cli.id);
    return cli;
  }

  async function seedPlano(nome: string, preco: string) {
    const [p] = await dbRaw
      .insert(schema.plano)
      .values({ nome, preco, ativo: true })
      .returning();
    planoIds.push(p.id);
    return p;
  }

  async function seedAssinatura(
    clienteId: string,
    planoId: string,
    fim: Date,
  ) {
    const preapproval = `pre-${Math.random().toString(36).slice(2, 10)}`;
    const [a] = await dbRaw
      .insert(schema.assinatura)
      .values({
        clienteId,
        planoId,
        preapprovalIdMp: preapproval,
        status: "ATIVA",
        fimCicloAtual: fim,
      })
      .returning();
    preapprovalIds.push(preapproval);
    return { ...a, preapproval };
  }

  it("carregarGestaoAssinatura separa upgrade/downgrade pelo preço", async () => {
    const wpp = String(Math.floor(1e12 + Math.random() * 9e12));
    const cli = await seedCliente(wpp, "x@x.com");
    const basico = await seedPlano(`Básico ${wpp}`, "49.90");
    const conforto = await seedPlano(`Conforto ${wpp}`, "79.90");
    const premium = await seedPlano(`Premium ${wpp}`, "129.90");
    await seedAssinatura(cli.id, conforto.id, new Date("2026-06-28T00:00:00Z"));

    const { carregarGestaoAssinatura } = await import(
      "@/assinatura/gestao-assinatura-loader"
    );
    const gestao = await carregarGestaoAssinatura(wpp, dbRaw);

    expect(gestao?.plano.id).toBe(conforto.id);
    expect(gestao?.opcoesUpgrade.map((p) => p.id)).toContain(premium.id);
    expect(gestao?.opcoesDowngrade.map((p) => p.id)).toContain(basico.id);
    expect(gestao?.opcoesUpgrade.map((p) => p.id)).not.toContain(basico.id);
  });

  it("PreventivaRepo cancela só a preventiva agendada depois do fim do ciclo", async () => {
    const cli = await seedCliente(
      String(Math.floor(1e12 + Math.random() * 9e12)),
      null,
    );
    const [sol] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: `tok-${Math.random().toString(36).slice(2, 10)}`,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        endereco: { logradouro: "R. X", cidade: "SP", uf: "SP" },
      })
      .returning();
    solicitacaoIds.push(sol.id);

    const plano = await seedPlano(
      `Plano ${Math.random().toString(36).slice(2, 6)}`,
      "79.90",
    );
    const fim = new Date("2026-06-28T00:00:00Z");
    const ass = await seedAssinatura(cli.id, plano.id, fim);

    async function seedPreventiva(agendadoPara: Date) {
      const [os] = await dbRaw
        .insert(schema.ordemServico)
        .values({
          solicitacaoId: sol.id,
          tipo: "PREVENTIVA",
          estado: "AGENDADA",
          categoria: "ELETRICA",
          agendadoPara,
          assinaturaId: ass.id,
        })
        .returning();
      osIds.push(os.id);
      return os;
    }
    const dentro = await seedPreventiva(new Date("2026-06-18T00:00:00Z"));
    const depois = await seedPreventiva(new Date("2026-07-08T00:00:00Z"));

    const { cancelarPreventivasFuturas } = await import(
      "@/assinatura/cancelar-preventivas-futuras"
    );
    const { criarPreventivaRepoDrizzle } = await import(
      "@/assinatura/preventiva-repo-drizzle"
    );

    const out = await cancelarPreventivasFuturas(
      ass.id,
      fim,
      criarPreventivaRepoDrizzle(dbRaw),
    );

    expect(out.canceladas).toEqual([depois.id]);

    const [osDentro] = await dbRaw
      .select({ estado: schema.ordemServico.estado })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, dentro.id));
    const [osDepois] = await dbRaw
      .select({ estado: schema.ordemServico.estado })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, depois.id));
    expect(osDentro.estado).toBe("AGENDADA");
    expect(osDepois.estado).toBe("CANCELADA");

    const transicoes = await dbRaw
      .select({ estadoNovo: schema.transicaoOs.estadoNovo })
      .from(schema.transicaoOs)
      .where(eq(schema.transicaoOs.osId, depois.id));
    expect(transicoes.map((t) => t.estadoNovo)).toContain("CANCELADA");
  });

  it("notificar(assinatura.pagamento_falhou) carrega dados pelos loaders internos e dispara", async () => {
    const wpp = String(Math.floor(1e12 + Math.random() * 9e12));
    const cli = await seedCliente(wpp, "falha@x.com");
    const plano = await seedPlano(
      `Plano ${Math.random().toString(36).slice(2, 6)}`,
      "79.90",
    );
    const ass = await seedAssinatura(
      cli.id,
      plano.id,
      new Date("2026-06-28T00:00:00Z"),
    );

    const { notificar } = await import("@/notificacao/notificar");
    // Loaders internos (Drizzle) + adapter de e-mail fake (sem Resend real).
    const enviados: { para: string }[] = [];
    const res = await notificar(
      {
        tipo: "assinatura.pagamento_falhou",
        preapprovalIdMp: ass.preapproval,
        eventId: `ev-gestao-${Math.random().toString(36).slice(2, 8)}`,
      },
      {
        email: {
          enviar: async (input) => {
            enviados.push({ para: input.para });
            return { id: "mock-gestao" };
          },
        },
      },
    );

    expect(res.email?.status).toBe("sent");
    expect(enviados).toHaveLength(1);

    const { db } = await import("@/db/client");
    const schemaDb = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await db
      .delete(schemaDb.notificacaoMarco)
      .where(eq(schemaDb.notificacaoMarco.refId, ass.id));
  });
});
