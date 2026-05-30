import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

const assinaturaOk = "data:image/png;base64," + "A".repeat(4096);

describe.skipIf(!hasDb)("AprovacaoPresencialRepo Drizzle", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: import("@/operacao/aprovacao-presencial").AprovacaoPresencialRepo;
  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];

  type TipoOs = "NORMAL" | "EXPRESS" | "COMPLEMENTAR";

  async function seedOrcada(tipo: TipoOs = "NORMAL", noLocal = false) {
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
        origem: tipo === "EXPRESS" ? "EXPRESS_TECNICO" : "FORMULARIO",
      })
      .returning();
    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "ELETRICA",
        tipo,
        estado: "ORCADA",
      })
      .returning();
    await dbRaw.insert(schema.orcamento).values({
      osId: os.id,
      tokenAprovacao: `apr-${r}`,
      totalMaoDeObra: "200",
      totalDeslocamento: "12",
      total: "212",
      validoAte: new Date(Date.now() + 7 * 86_400_000),
    });
    if (noLocal) {
      await dbRaw.insert(schema.transicaoOs).values({
        osId: os.id,
        estadoAnterior: "A_CAMINHO",
        estadoNovo: "NO_LOCAL",
        atorEmail: "tec@dbg.com",
      });
    }
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    return { osId: os.id };
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
    repo = (
      await import("@/operacao/aprovacao-presencial-repo-drizzle")
    ).criarAprovacaoPresencialRepoDrizzle(dbMod.db);
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
        await dbRaw
          .delete(schema.orcamento)
          .where(inArray(schema.orcamento.osId, osIds));
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

  it("aprovarPresencial transita ORÇADA→APROVADA e carimba o orçamento", async () => {
    const { osId } = await seedOrcada();
    const ok = await repo.aprovarPresencial({
      osId,
      assinaturaUrl: "assinaturas/os/x/abc.png",
      aprovadoPor: "tec@dbg.com",
      lgpdAceito: true,
      em: new Date(),
    });
    expect(ok).toBe(true);

    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select()
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId))
      .limit(1);
    expect(os.estado).toBe("APROVADA");

    const [orc] = await dbRaw
      .select()
      .from(schema.orcamento)
      .where(eq(schema.orcamento.osId, osId))
      .limit(1);
    expect(orc.aprovacaoTipo).toBe("PRESENCIAL");
    expect(orc.assinaturaUrl).toBe("assinaturas/os/x/abc.png");
    expect(orc.aprovacaoPor).toBe("tec@dbg.com");
    expect(orc.aprovacaoLgpd).toBe(true);
    expect(orc.aprovadoEm).not.toBeNull();

    const transicoes = await dbRaw
      .select()
      .from(schema.transicaoOs)
      .where(eq(schema.transicaoOs.osId, osId));
    expect(transicoes.some((t) => t.estadoNovo === "APROVADA")).toBe(true);
  });

  it("gate atômico: segunda aprovação na mesma OS retorna false", async () => {
    const { osId } = await seedOrcada();
    const base = {
      osId,
      assinaturaUrl: "k.png",
      aprovadoPor: "tec@dbg.com",
      lgpdAceito: true,
      em: new Date(),
    };
    expect(await repo.aprovarPresencial(base)).toBe(true);
    expect(await repo.aprovarPresencial(base)).toBe(false);
  });

  it("podeIniciarExecucao: EXPRESS sempre, NORMAL só com NO_LOCAL", async () => {
    const express = await seedOrcada("EXPRESS");
    const normalSemNoLocal = await seedOrcada("NORMAL");
    const normalNoLocal = await seedOrcada("NORMAL", true);

    expect(await repo.podeIniciarExecucao(express.osId)).toBe(true);
    expect(await repo.podeIniciarExecucao(normalSemNoLocal.osId)).toBe(false);
    expect(await repo.podeIniciarExecucao(normalNoLocal.osId)).toBe(true);
  });

  it("OS Express dispensa LGPD na aprovação presencial (caso de uso completo)", async () => {
    const { osId } = await seedOrcada("EXPRESS");
    const { aprovarPresencial } = await import("@/operacao/aprovacao-presencial");

    const out = await aprovarPresencial(
      {
        osId,
        aprovou: true,
        lgpdAceito: false, // Express não exige
        origem: "EXPRESS_TECNICO",
        assinaturaDataUrl: assinaturaOk,
        tecnicoEmail: "tec@dbg.com",
      },
      {
        repo,
        upload: {
          enviarAssinatura: async ({ osId }) => ({
            url: `assinaturas/os/${osId}/u.png`,
          }),
        },
      },
    );

    expect(out.podeIniciarExecucao).toBe(true);
    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select()
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId))
      .limit(1);
    expect(os.estado).toBe("APROVADA");
  });
});
