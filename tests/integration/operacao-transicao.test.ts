import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { aplicarTransicao, TransicaoInvalidaError } from "@/operacao/maquina-estado";
import { criarTransicaoRepoDrizzle } from "@/operacao/transicao-repo-drizzle";
import { OsInexistenteError } from "@/operacao/transicao-repo";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("TransicaoRepo Drizzle + máquina", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: import("@/operacao/transicao-repo").TransicaoRepo;
  let solicitacaoIds: string[] = [];
  let clienteIds: string[] = [];

  async function seedOs(estado: "NOVA" | "APROVADA") {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({
        nome: `Cli ${r}`,
        whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)),
      })
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
        estado,
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
    repo = criarTransicaoRepoDrizzle(dbMod.db);
  });

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
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
    if (clienteIds.length) {
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    }
  });

  it("persiste a transição no histórico e atualiza o estado da OS", async () => {
    const osId = await seedOs("NOVA");

    const registro = await aplicarTransicao(
      osId,
      "ORCADA",
      "ana@dbg.com",
      null,
      repo,
    );

    expect(registro.estadoAnterior).toBe("NOVA");
    expect(registro.estadoNovo).toBe("ORCADA");

    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select({ estado: schema.ordemServico.estado })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId));
    expect(os.estado).toBe("ORCADA");

    const hist = await dbRaw
      .select()
      .from(schema.transicaoOs)
      .where(eq(schema.transicaoOs.osId, osId));
    expect(hist).toHaveLength(1);
    expect(hist[0].estadoAnterior).toBe("NOVA");
    expect(hist[0].estadoNovo).toBe("ORCADA");
    expect(hist[0].atorEmail).toBe("ana@dbg.com");
  });

  it("usa o histórico persistido como contexto da próxima transição", async () => {
    const osId = await seedOs("NOVA");

    await aplicarTransicao(osId, "ORCADA", "ana@dbg.com", null, repo);
    await aplicarTransicao(osId, "APROVADA", "ana@dbg.com", null, repo);
    const registro = await aplicarTransicao(
      osId,
      "AGENDADA",
      "ana@dbg.com",
      null,
      repo,
    );

    expect(registro.estadoNovo).toBe("AGENDADA");
  });

  it("rejeita transição inválida sem persistir nada", async () => {
    const osId = await seedOs("NOVA");

    await expect(
      aplicarTransicao(osId, "EM_EXECUCAO", "ana@dbg.com", null, repo),
    ).rejects.toBeInstanceOf(TransicaoInvalidaError);

    const { eq } = await import("drizzle-orm");
    const hist = await dbRaw
      .select()
      .from(schema.transicaoOs)
      .where(eq(schema.transicaoOs.osId, osId));
    expect(hist).toHaveLength(0);
  });

  it("lança OsInexistenteError para OS desconhecida", async () => {
    await expect(
      aplicarTransicao(
        "00000000-0000-0000-0000-000000000000",
        "ORCADA",
        "ana@dbg.com",
        null,
        repo,
      ),
    ).rejects.toBeInstanceOf(OsInexistenteError);
  });
});
