import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db as dbClient } from "@/db/client";
import * as schema from "@/db/schema";
import { criarAlertaAvaliacaoRepoDrizzle } from "@/marketing/alerta-avaliacao-repo-drizzle";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Alerta de Avaliação Integration (Bloco B)", () => {
  let db: typeof dbClient;
  const osIds: string[] = [];
  const solIds: string[] = [];
  const cliIds: string[] = [];
  const tecIds: string[] = [];

  beforeAll(async () => {
    db = dbClient;
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

  it("B1 — tracer: criar persiste 1 linha status='PENDENTE'", async () => {
    const token = `tok-test-b1-${Math.random().toString(36).slice(2, 10)}`;
    const { os, sol, tecnicoId } = await seedContexto({ token, comTecnico: true });
    
    const repo = criarAlertaAvaliacaoRepoDrizzle(db);
    await repo.criar({
      osId: os.id,
      solicitacaoId: sol.id,
      tecnicoId,
      nota: 2,
      comentarioOs: "Muito ruim"
    });

    const [salvo] = await db
      .select()
      .from(schema.alertaAvaliacao)
      .where(eq(schema.alertaAvaliacao.osId, os.id));

    expect(salvo).toBeDefined();
    expect(salvo.nota).toBe(2);
    expect(salvo.comentarioOs).toBe("Muito ruim");
    expect(salvo.status).toBe("PENDENTE");
    expect(solIds).toContain(salvo.solicitacaoId);
    expect(salvo.tecnicoId).toBe(tecnicoId);
  });

  it("B2: reenvio do mesmo osId atualiza o alerta (upsert)", async () => {
    const token = `tok-test-b2-${Math.random().toString(36).slice(2, 10)}`;
    const { os, sol, tecnicoId } = await seedContexto({ token, comTecnico: true });

    const repo = criarAlertaAvaliacaoRepoDrizzle(db);
    
    // Primeiro envio (nota 2)
    await repo.criar({
      osId: os.id,
      solicitacaoId: sol.id,
      tecnicoId,
      nota: 2,
      comentarioOs: "Ruim"
    });

    // Reenvio (nota 1, comentário atualizado)
    await repo.criar({
      osId: os.id,
      solicitacaoId: sol.id,
      tecnicoId,
      nota: 1,
      comentarioOs: "Péssimo"
    });

    const resultados = await db
      .select()
      .from(schema.alertaAvaliacao)
      .where(eq(schema.alertaAvaliacao.osId, os.id));

    expect(resultados).toHaveLength(1);
    expect(resultados[0].nota).toBe(1);
    expect(resultados[0].comentarioOs).toBe("Péssimo");
  });

  it("B3: listarPendentes traz alertas pendentes com joins corretos", async () => {
    const token = `tok-test-b3-${Math.random().toString(36).slice(2, 10)}`;
    
    // Alerta 1: com técnico, PENDENTE
    const { os: osPendente, sol: solPendente, tecnicoId } = await seedContexto({ token, comTecnico: true });
    
    // Alerta 2: com técnico, RESOLVIDO
    const { os: osResolvido, sol: solResolvido } = await seedContexto({ token: token + "-res", comTecnico: true });

    const repo = criarAlertaAvaliacaoRepoDrizzle(db);

    await repo.criar({
      osId: osPendente.id,
      solicitacaoId: solPendente.id,
      tecnicoId,
      nota: 2,
      comentarioOs: "Não gostei"
    });

    await repo.criar({
      osId: osResolvido.id,
      solicitacaoId: solResolvido.id,
      tecnicoId,
      nota: 3,
      comentarioOs: "Ok"
    });

    // Atualiza status do segundo alerta para RESOLVIDO diretamente no banco
    await db
      .update(schema.alertaAvaliacao)
      .set({ status: "RESOLVIDO" })
      .where(eq(schema.alertaAvaliacao.osId, osResolvido.id));

    const pendentes = await repo.listarPendentes();

    // Deve conter apenas o pendente correspondente a esta execução
    const meusPendentes = pendentes.filter(p => p.osId === osPendente.id);
    expect(meusPendentes).toHaveLength(1);

    const alerta = meusPendentes[0];
    expect(alerta.nota).toBe(2);
    expect(alerta.comentarioOs).toBe("Não gostei");
    expect(alerta.status).toBe("PENDENTE");
    expect(alerta.solicitacaoId).toBe(solPendente.id);
    expect(alerta.tecnicoNome).toBeDefined();
    expect(alerta.tecnicoNome).not.toBeNull();
  });
});
