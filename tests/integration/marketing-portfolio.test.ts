import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aprovarFoto, rejeitarFoto } from "@/marketing/portfolio";
import type {
  CopiadorFotoPublica,
  PortfolioRepo,
} from "@/marketing/portfolio-repo";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

// Copiador falso: não toca o R2, só devolve uma chave pública determinística.
function copiadorFake(): CopiadorFotoPublica {
  return {
    copiar: async (chavePrivada) => ({
      chavePublica: `portfolio/${chavePrivada.split("/").pop()}`,
    }),
  };
}

describe.skipIf(!hasDb)("PortfolioRepo Drizzle", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: PortfolioRepo;
  let osIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let clienteIds: string[] = [];
  let membroIds: string[] = [];

  async function seedTecnico(): Promise<string> {
    const r = Math.random().toString(36).slice(2, 10);
    const [m] = await dbRaw
      .insert(schema.membro)
      .values({
        nome: `Tec ${r}`,
        email: `tec-${r}@dbg.com.br`,
        isTecnico: true,
        especialidades: ["ELETRICA"],
      })
      .returning();
    membroIds.push(m.id);
    return m.id;
  }

  async function seedOs(): Promise<string> {
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
        fotosUrls: [],
        endereco: { logradouro: "Rua X", cidade: "SP", uf: "SP" },
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
        estado: "CONCLUIDA",
        metadados: { notaServico: "Quadro reorganizado" },
      })
      .returning();
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    osIds.push(os.id);
    return os.id;
  }

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    const { criarPortfolioRepoDrizzle } = await import(
      "@/marketing/portfolio-repo-drizzle"
    );
    dbRaw = dbMod.db;
    repo = criarPortfolioRepoDrizzle(dbMod.db);
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (osIds.length) {
      await dbRaw
        .delete(schema.fotoPortfolio)
        .where(inArray(schema.fotoPortfolio.osId, osIds));
      await dbRaw
        .delete(schema.ordemServico)
        .where(inArray(schema.ordemServico.id, osIds));
    }
    if (solicitacaoIds.length) {
      await dbRaw
        .delete(schema.solicitacao)
        .where(inArray(schema.solicitacao.id, solicitacaoIds));
    }
    if (clienteIds.length) {
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    }
    if (membroIds.length) {
      await dbRaw
        .delete(schema.membro)
        .where(inArray(schema.membro.id, membroIds));
    }
  });

  it("marcar é idempotente por chave privada", async () => {
    const osId = await seedOs();
    const chave = `os/${osId}/depois/foto.jpg`;
    const a = await repo.marcar({
      osId,
      tecnicoId: null,
      categoria: "ELETRICA",
      tipo: "DEPOIS",
      chavePrivada: chave,
    });
    const b = await repo.marcar({
      osId,
      tecnicoId: null,
      categoria: "ELETRICA",
      tipo: "DEPOIS",
      chavePrivada: chave,
    });
    expect(b.id).toBe(a.id);
    expect(a.status).toBe("PENDENTE");
  });

  it("listarPendentes traz só PENDENTE com nome do técnico e nota da OS", async () => {
    const osId = await seedOs();
    const tecnicoId = await seedTecnico();
    const f = await repo.marcar({
      osId,
      tecnicoId,
      categoria: "ELETRICA",
      tipo: "ANTES",
      chavePrivada: `os/${osId}/antes/p.jpg`,
    });
    const pend = await repo.listarPendentes();
    const item = pend.find((p) => p.id === f.id);
    expect(item).toBeDefined();
    expect(item!.tecnicoNome).toContain("Tec");
    expect(item!.notaServico).toBe("Quadro reorganizado");
  });

  it("foto marcada mas não aprovada NÃO aparece em listarPublicas", async () => {
    const osId = await seedOs();
    const f = await repo.marcar({
      osId,
      tecnicoId: null,
      categoria: "ELETRICA",
      tipo: "DEPOIS",
      chavePrivada: `os/${osId}/depois/pend.jpg`,
    });
    const publicas = await repo.listarPublicas(100);
    expect(publicas.some((p) => p.id === f.id)).toBe(false);
  });

  it("aprovarFoto: vira APROVADA e aparece em listarPublicas com chave pública", async () => {
    const osId = await seedOs();
    const tecnicoId = await seedTecnico();
    const f = await repo.marcar({
      osId,
      tecnicoId,
      categoria: "ELETRICA",
      tipo: "DEPOIS",
      chavePrivada: `os/${osId}/depois/ok.jpg`,
    });
    await aprovarFoto(
      f.id,
      { decididoPor: "marketing@dbg.com.br", temDadoSensivel: true },
      repo,
      copiadorFake(),
    );
    const publicas = await repo.listarPublicas(100);
    const pub = publicas.find((p) => p.id === f.id);
    expect(pub).toBeDefined();
    expect(pub!.chavePublica).toBe("portfolio/ok.jpg");

    const porTec = await repo.listarPublicasPorTecnico(tecnicoId, 100);
    expect(porTec.some((p) => p.id === f.id)).toBe(true);
  });

  it("rejeitarFoto: vira REJEITADA e nunca aparece em listarPublicas", async () => {
    const osId = await seedOs();
    const f = await repo.marcar({
      osId,
      tecnicoId: null,
      categoria: "ELETRICA",
      tipo: "ANTES",
      chavePrivada: `os/${osId}/antes/rej.jpg`,
    });
    await rejeitarFoto(
      f.id,
      { decididoPor: "marketing@dbg.com.br", motivo: "rosto visível" },
      repo,
    );
    const atual = await repo.buscar(f.id);
    expect(atual!.status).toBe("REJEITADA");
    expect(atual!.motivoRejeicao).toBe("rosto visível");
    const publicas = await repo.listarPublicas(100);
    expect(publicas.some((p) => p.id === f.id)).toBe(false);
  });

  it("não aprova/rejeita foto já decidida", async () => {
    const osId = await seedOs();
    const f = await repo.marcar({
      osId,
      tecnicoId: null,
      categoria: "ELETRICA",
      tipo: "DEPOIS",
      chavePrivada: `os/${osId}/depois/dupla.jpg`,
    });
    await aprovarFoto(f.id, { decididoPor: "m@dbg" }, repo, copiadorFake());
    await expect(
      rejeitarFoto(f.id, { decididoPor: "m@dbg", motivo: "x" }, repo),
    ).rejects.toThrow();
  });
});
