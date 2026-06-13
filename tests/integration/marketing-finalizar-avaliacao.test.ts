import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db as dbClient } from "@/db/client";
import * as schema from "@/db/schema";
import { criarAvaliacaoRepoDrizzle } from "@/operacao/avaliacao/avaliacao-repo";
import { criarAlertaAvaliacaoRepoDrizzle } from "@/marketing/alerta-avaliacao-repo";
import { criarOperacaoConfigRepoDrizzle } from "@/operacao/config-repo-drizzle";
import { finalizarAvaliacao } from "@/marketing/filtro-avaliacao";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Orquestrador finalizarAvaliacao (Bloco D)", () => {
  let db: typeof dbClient;
  const osIds: string[] = [];
  const solIds: string[] = [];
  const cliIds: string[] = [];
  const tecIds: string[] = [];
  let originalConfig: any;

  beforeAll(async () => {
    db = dbClient;
    const configRepo = criarOperacaoConfigRepoDrizzle(db);
    originalConfig = await configRepo.obter();
  });

  afterEach(async () => {
    if (osIds.length) {
      await db.delete(schema.alertaAvaliacao).where(inArray(schema.alertaAvaliacao.osId, osIds));
      await db.delete(schema.avaliacao).where(inArray(schema.avaliacao.osId, osIds));
      await db.delete(schema.ordemServico).where(inArray(schema.ordemServico.id, osIds));
      osIds.length = 0;
    }
    if (solIds.length) {
      await db.delete(schema.comentarioGeral).where(inArray(schema.comentarioGeral.solicitacaoId, solIds));
      await db.delete(schema.solicitacao).where(inArray(schema.solicitacao.id, solIds));
      solIds.length = 0;
    }
    if (tecIds.length) {
      await db.delete(schema.membro).where(inArray(schema.membro.id, tecIds));
      tecIds.length = 0;
    }
    if (cliIds.length) {
      await db.delete(schema.cliente).where(inArray(schema.cliente.id, cliIds));
      cliIds.length = 0;
    }
    // Restore config
    const configRepo = criarOperacaoConfigRepoDrizzle(db);
    await configRepo.atualizar(originalConfig);
  });

  async function seedContexto(opts: {
    token: string;
    estado?: "CONCLUIDA" | "PAGA" | "EM_EXECUCAO";
    tipo?: "NORMAL" | "PREVENTIVA";
    comTecnico?: boolean;
  }) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await db
      .insert(schema.cliente)
      .values({
        nome: `Cliente ${r}`,
        whatsapp: `55119` + Math.floor(10000000 + Math.random() * 90000000).toString(),
        email: `cli-${r}@dbg.test`,
        endereco: { logradouro: "Rua Teste", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    cliIds.push(cli.id);

    const [sol] = await db
      .insert(schema.solicitacao)
      .values({
        token: opts.token,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        descricao: "teste avaliacao",
        endereco: { logradouro: "Rua Teste", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    solIds.push(sol.id);

    let tecnicoId: string | null = null;
    if (opts.comTecnico) {
      const [tec] = await db
        .insert(schema.membro)
        .values({
          nome: `Tecnico ${r}`,
          email: `tec-${r}@dbg.test`,
          isTecnico: true,
        })
        .returning();
      tecIds.push(tec.id);
      tecnicoId = tec.id;
    }

    const [os] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "ELETRICA",
        tipo: opts.tipo ?? "NORMAL",
        estado: opts.estado ?? "CONCLUIDA",
        tecnicoId,
      })
      .returning();
    osIds.push(os.id);

    return { os, sol, cli, tecnicoId };
  }

  it("D1 — tracer: todas notas >= 4 -> qualificada=true com googleReviewUrl, 0 alertas", async () => {
    const token = `tok-test-d1-${Math.random().toString(36).slice(2, 10)}`;
    const { os, sol } = await seedContexto({ token, comTecnico: true });

    const avaliacaoRepo = criarAvaliacaoRepoDrizzle(db);
    const alertaRepo = criarAlertaAvaliacaoRepoDrizzle(db);
    const configRepo = criarOperacaoConfigRepoDrizzle(db);

    // Configura a URL do Google Review
    await configRepo.atualizar({
      ...originalConfig,
      googleReviewUrl: "https://g.page/dbg-review-d1",
    });

    const res = await finalizarAvaliacao(
      token,
      {
        avaliacoes: [{ osId: os.id, nota: 4, comentarioOs: "Ótimo" }],
        comentarioGeral: "Muito satisfeito"
      },
      { ip: "127.0.0.1" },
      { avaliacaoRepo, alertaRepo, configRepo }
    );

    expect(res).toEqual({
      qualificada: true,
      googleReviewUrl: "https://g.page/dbg-review-d1",
    });

    // Verifica que gravou a avaliação
    const [salvoAv] = await db
      .select()
      .from(schema.avaliacao)
      .where(eq(schema.avaliacao.osId, os.id));
    expect(salvoAv).toBeDefined();
    expect(salvoAv.nota).toBe(4);

    // Verifica que 0 alertas foram criados
    const alertas = await db
      .select()
      .from(schema.alertaAvaliacao)
      .where(eq(schema.alertaAvaliacao.osId, os.id));
    expect(alertas).toHaveLength(0);
  });

  it("D2 — tracer: mix 5★ + 3★ -> qualificada=false com googleReviewUrl=null, 1 alerta criado", async () => {
    const token = `tok-test-d2-${Math.random().toString(36).slice(2, 10)}`;
    const { os: os1, sol, tecnicoId: tec1 } = await seedContexto({ token, comTecnico: true });

    // Seed segunda OS para a mesma solicitação
    const r = Math.random().toString(36).slice(2, 10);
    const [tec2] = await db
      .insert(schema.membro)
      .values({
        nome: `Tecnico ${r}`,
        email: `tec-${r}@dbg.test`,
        isTecnico: true,
      })
      .returning();
    tecIds.push(tec2.id);

    const [os2] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "PINTURA",
        tipo: "NORMAL",
        estado: "CONCLUIDA",
        tecnicoId: tec2.id,
      })
      .returning();
    osIds.push(os2.id);

    const avaliacaoRepo = criarAvaliacaoRepoDrizzle(db);
    const alertaRepo = criarAlertaAvaliacaoRepoDrizzle(db);
    const configRepo = criarOperacaoConfigRepoDrizzle(db);

    await configRepo.atualizar({
      ...originalConfig,
      googleReviewUrl: "https://g.page/dbg-review-d2",
    });

    const res = await finalizarAvaliacao(
      token,
      {
        avaliacoes: [
          { osId: os1.id, nota: 5, comentarioOs: "Excelente" },
          { osId: os2.id, nota: 3, comentarioOs: "Atrasou um pouco" }
        ],
        comentarioGeral: "Serviço misto"
      },
      { ip: "127.0.0.1" },
      { avaliacaoRepo, alertaRepo, configRepo }
    );

    expect(res).toEqual({
      qualificada: false,
      googleReviewUrl: null,
    });

    // Verifica que 1 alerta foi criado apenas para a OS 2
    const alertas = await db
      .select()
      .from(schema.alertaAvaliacao)
      .where(inArray(schema.alertaAvaliacao.osId, [os1.id, os2.id]));

    expect(alertas).toHaveLength(1);
    expect(alertas[0].osId).toBe(os2.id);
    expect(alertas[0].nota).toBe(3);
    expect(alertas[0].comentarioOs).toBe("Atrasou um pouco");
    expect(alertas[0].tecnicoId).toBe(tec2.id);
  });

  it("D3: googleReviewUrl ausente no config + todas >= 4 -> qualificada=true, googleReviewUrl=null", async () => {
    const token = `tok-test-d3-${Math.random().toString(36).slice(2, 10)}`;
    const { os } = await seedContexto({ token, comTecnico: true });

    const avaliacaoRepo = criarAvaliacaoRepoDrizzle(db);
    const alertaRepo = criarAlertaAvaliacaoRepoDrizzle(db);
    const configRepo = criarOperacaoConfigRepoDrizzle(db);

    // Remove a URL do Google Review
    await configRepo.atualizar({
      ...originalConfig,
      googleReviewUrl: null,
    });

    const res = await finalizarAvaliacao(
      token,
      {
        avaliacoes: [{ osId: os.id, nota: 5, comentarioOs: "Perfeito" }]
      },
      { ip: "127.0.0.1" },
      { avaliacaoRepo, alertaRepo, configRepo }
    );

    expect(res).toEqual({
      qualificada: true,
      googleReviewUrl: null,
    });
  });

  it("D4: reavaliação >= 4★ marca alerta RESOLVIDO como REAVALIADO", async () => {
    const token = `tok-test-d4-${Math.random().toString(36).slice(2, 10)}`;
    const { os, sol, tecnicoId } = await seedContexto({ token, comTecnico: true });

    // Alerta já passou por tratativa (status RESOLVIDO).
    await db.insert(schema.alertaAvaliacao).values({
      osId: os.id,
      solicitacaoId: sol.id,
      tecnicoId,
      nota: 2,
      status: "RESOLVIDO",
      resolvidoEm: new Date(),
    });

    const avaliacaoRepo = criarAvaliacaoRepoDrizzle(db);
    const alertaRepo = criarAlertaAvaliacaoRepoDrizzle(db);
    const configRepo = criarOperacaoConfigRepoDrizzle(db);

    await finalizarAvaliacao(
      token,
      { avaliacoes: [{ osId: os.id, nota: 5, comentarioOs: "Resolvido, obrigado" }] },
      { ip: "127.0.0.1" },
      { avaliacaoRepo, alertaRepo, configRepo },
    );

    const [alerta] = await db
      .select()
      .from(schema.alertaAvaliacao)
      .where(eq(schema.alertaAvaliacao.osId, os.id));

    expect(alerta.status).toBe("REAVALIADO");
  });

  it("D5: primeira avaliação >= 4★ sem alerta não cria nem marca nada", async () => {
    const token = `tok-test-d5-${Math.random().toString(36).slice(2, 10)}`;
    const { os } = await seedContexto({ token, comTecnico: true });

    const avaliacaoRepo = criarAvaliacaoRepoDrizzle(db);
    const alertaRepo = criarAlertaAvaliacaoRepoDrizzle(db);
    const configRepo = criarOperacaoConfigRepoDrizzle(db);

    await finalizarAvaliacao(
      token,
      { avaliacoes: [{ osId: os.id, nota: 5, comentarioOs: "Ótimo" }] },
      { ip: "127.0.0.1" },
      { avaliacaoRepo, alertaRepo, configRepo },
    );

    const alertas = await db
      .select()
      .from(schema.alertaAvaliacao)
      .where(eq(schema.alertaAvaliacao.osId, os.id));

    expect(alertas).toHaveLength(0);
  });
});
