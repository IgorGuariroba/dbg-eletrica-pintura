import { config } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  iniciarVinculacao,
  confirmarVinculacao,
  desvincular,
} from "@/cliente/vinculacao";
import { criarVinculacaoRepoDrizzle } from "@/cliente/vinculacao-repo-drizzle";
import {
  ClienteNaoEncontradoError,
  WhatsappJaVinculadoError,
  CodigoInvalidoError,
} from "@/cliente/vinculacao-repo";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Vinculação Google Cliente - Integração Drizzle", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: import("@/cliente/vinculacao-repo").VinculacaoRepo;
  let inClienteIds: string[] = [];
  let inEmails: string[] = [];

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    repo = criarVinculacaoRepoDrizzle(dbRaw);
  });

  beforeEach(() => {
    inClienteIds = [];
    inEmails = [];
  });

  afterAll(async () => {
    // Limpar o que criamos
    if (inClienteIds.length) {
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, inClienteIds));
    }
    if (inEmails.length) {
      await dbRaw
        .delete(schema.vinculacaoGooglePendente)
        .where(inArray(schema.vinculacaoGooglePendente.googleEmail, inEmails));
    }
  });

  async function semearCliente(over: Partial<typeof schema.cliente.$inferInsert> = {}) {
    const rand = Math.random().toString(36).slice(2);
    const num = `55119${Math.floor(10000000 + Math.random() * 90000000)}`;
    const [c] = await dbRaw
      .insert(schema.cliente)
      .values({
        nome: `Cli Teste ${rand}`,
        whatsapp: num,
        ...over,
      })
      .returning();
    inClienteIds.push(c.id);
    return c;
  }

  it("fluxo feliz de iniciar e confirmar vinculação", async () => {
    const cli = await semearCliente();
    const googleEmail = `test-${Math.random().toString(36).slice(2)}@gmail.com`;
    inEmails.push(googleEmail);

    // 1. Iniciar vinculação
    await iniciarVinculacao({ googleEmail, whatsapp: cli.whatsapp }, repo);

    // Validar pendente salva
    const pendente = await repo.buscarPendente(googleEmail);
    expect(pendente).not.toBeNull();
    expect(pendente?.whatsapp).toBe(cli.whatsapp);
    expect(pendente?.codigo).toMatch(/^\d{6}$/);

    // Validar notificação in-app criada para EQUIPE
    const { desc, and, like } = await import("drizzle-orm");
    const [notif] = await dbRaw
      .select()
      .from(schema.notificacaoInApp)
      .where(
        and(
          eq(schema.notificacaoInApp.destinatarioModulo, "EQUIPE"),
          like(schema.notificacaoInApp.mensagem, `%${cli.whatsapp}%`)
        )
      )
      .orderBy(desc(schema.notificacaoInApp.criadoEm));
    expect(notif).toBeDefined();
    expect(notif.mensagem).toContain(pendente?.codigo);

    // 2. Confirmar vinculação
    await confirmarVinculacao(
      { googleEmail, codigo: pendente!.codigo },
      repo
    );

    // Validar cliente atualizado
    const [updatedCli] = await dbRaw
      .select()
      .from(schema.cliente)
      .where(eq(schema.cliente.id, cli.id));
    expect(updatedCli.googleEmail).toBe(googleEmail);

    // Validar pendente removida
    const pendenteApos = await repo.buscarPendente(googleEmail);
    expect(pendenteApos).toBeNull();

    // Validar log registrado
    const [log] = await dbRaw
      .select()
      .from(schema.vinculacaoGoogleLog)
      .where(eq(schema.vinculacaoGoogleLog.clienteId, cli.id));
    expect(log).toMatchObject({
      googleEmail,
      whatsapp: cli.whatsapp,
      evento: "VINCULADO",
    });
  });

  it("impede vinculação de número inexistente", async () => {
    const googleEmail = `test-${Math.random().toString(36).slice(2)}@gmail.com`;
    await expect(
      iniciarVinculacao({ googleEmail, whatsapp: "5511999998888" }, repo)
    ).rejects.toThrow(ClienteNaoEncontradoError);
  });

  it("impede que o mesmo WhatsApp seja vinculado a outro e-mail concurrentemente", async () => {
    const cli1 = await semearCliente();
    const googleEmail1 = `test1-${Math.random().toString(36).slice(2)}@gmail.com`;
    const googleEmail2 = `test2-${Math.random().toString(36).slice(2)}@gmail.com`;
    inEmails.push(googleEmail1, googleEmail2);

    // Vincula o primeiro
    await iniciarVinculacao({ googleEmail: googleEmail1, whatsapp: cli1.whatsapp }, repo);
    const pend1 = await repo.buscarPendente(googleEmail1);
    await confirmarVinculacao({ googleEmail: googleEmail1, codigo: pend1!.codigo }, repo);

    // Tenta iniciar com o segundo Google email para o mesmo WhatsApp
    await expect(
      iniciarVinculacao({ googleEmail: googleEmail2, whatsapp: cli1.whatsapp }, repo)
    ).rejects.toThrow(WhatsappJaVinculadoError);
  });

  it("desvincula e permite nova vinculação", async () => {
    const cli = await semearCliente();
    const googleEmail = `test-${Math.random().toString(36).slice(2)}@gmail.com`;
    inEmails.push(googleEmail);

    // Vincula
    await iniciarVinculacao({ googleEmail, whatsapp: cli.whatsapp }, repo);
    const pend = await repo.buscarPendente(googleEmail);
    await confirmarVinculacao({ googleEmail, codigo: pend!.codigo }, repo);

    // Desvincula
    const desvinculou = await desvincular({ whatsapp: cli.whatsapp, atorEmail: "admin@dbg.com.br" }, repo);
    expect(desvinculou).toBe(true);

    // Verifica BD
    const [lido] = await dbRaw
      .select({ googleEmail: schema.cliente.googleEmail })
      .from(schema.cliente)
      .where(eq(schema.cliente.id, cli.id));
    expect(lido.googleEmail).toBeNull();

    // Log registrado
    const logs = await dbRaw
      .select()
      .from(schema.vinculacaoGoogleLog)
      .where(eq(schema.vinculacaoGoogleLog.clienteId, cli.id))
      .orderBy(schema.vinculacaoGoogleLog.em);
    expect(logs).toHaveLength(2); // VINCULADO e DESVINCULADO
    expect(logs[1].evento).toBe("DESVINCULADO");
    expect(logs[1].atorEmail).toBe("admin@dbg.com.br");

    // Permite re-vincular
    const novoGoogleEmail = `novo-${Math.random().toString(36).slice(2)}@gmail.com`;
    inEmails.push(novoGoogleEmail);
    await iniciarVinculacao({ googleEmail: novoGoogleEmail, whatsapp: cli.whatsapp }, repo);
    const pendNovo = await repo.buscarPendente(novoGoogleEmail);
    expect(pendNovo).not.toBeNull();
  });
});
