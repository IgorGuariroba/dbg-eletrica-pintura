import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db as dbClient } from "@/db/client";
import * as schema from "@/db/schema";
import { registrarAvaliacoes, carregarParaAvaliar } from "@/operacao/avaliacao/avaliacao";
import { criarAvaliacaoRepoDrizzle } from "@/operacao/avaliacao/avaliacao-repo";
import { NotaInvalidaError, OsNaoAvaliavelError } from "@/operacao/avaliacao/avaliacao-repo";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Avaliação de OS e Solicitação (Bloco A)", () => {
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

  it("A1 — tracer: registrarAvaliacoes persiste 1 linha nota=4 + tecnicoId snapshot da OS", async () => {
    const token = `tok-test-a1-${Math.random().toString(36).slice(2, 10)}`;
    const { os, tecnicoId } = await seedContexto({ token, comTecnico: true, estado: "CONCLUIDA" });
    const repo = criarAvaliacaoRepoDrizzle(db);

    await registrarAvaliacoes(token, {
      avaliacoes: [{ osId: os.id, nota: 4 }]
    }, { ip: "127.0.0.1" }, repo);

    const [salvo] = await db
      .select()
      .from(schema.avaliacao)
      .where(eq(schema.avaliacao.osId, os.id))
      .limit(1);

    expect(salvo).toBeDefined();
    expect(salvo.nota).toBe(4);
    expect(salvo.tecnicoId).toBe(tecnicoId);
    expect(salvo.atorToken).toBe(token);
    expect(salvo.ip).toBe("127.0.0.1");
  });

  it("A2 — 2 OS (4★ + 5★) → 2 registros", async () => {
    const token = `tok-test-a2-${Math.random().toString(36).slice(2, 10)}`;
    const { os: os1, tecnicoId: tec1, sol } = await seedContexto({ token, comTecnico: true, estado: "CONCLUIDA" });

    // Seed second OS for the same solicitation
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
        categoria: "ELETRICA",
        tipo: "NORMAL",
        estado: "PAGA",
        tecnicoId: tec2.id,
      })
      .returning();
    osIds.push(os2.id);

    const repo = criarAvaliacaoRepoDrizzle(db);

    await registrarAvaliacoes(token, {
      avaliacoes: [
        { osId: os1.id, nota: 4 },
        { osId: os2.id, nota: 5 }
      ]
    }, { ip: "127.0.0.1" }, repo);

    const avs = await db
      .select()
      .from(schema.avaliacao)
      .where(inArray(schema.avaliacao.osId, [os1.id, os2.id]));

    expect(avs).toHaveLength(2);
    const map = new Map(avs.map(a => [a.osId, a]));
    
    const av1 = map.get(os1.id);
    expect(av1).toBeDefined();
    expect(av1!.nota).toBe(4);
    expect(av1!.tecnicoId).toBe(tec1);

    const av2 = map.get(os2.id);
    expect(av2).toBeDefined();
    expect(av2!.nota).toBe(5);
    expect(av2!.tecnicoId).toBe(tec2.id);
  });

  it("A3 — Reenvio sobrescreve (nota 4→2 no mesmo osId, segue 1 linha)", async () => {
    const token = `tok-test-a3-${Math.random().toString(36).slice(2, 10)}`;
    const { os } = await seedContexto({ token, comTecnico: true, estado: "CONCLUIDA" });
    const repo = criarAvaliacaoRepoDrizzle(db);

    await registrarAvaliacoes(token, {
      avaliacoes: [{ osId: os.id, nota: 4, comentarioOs: "Ótimo" }]
    }, { ip: "127.0.0.1" }, repo);

    const [salvo1] = await db
      .select()
      .from(schema.avaliacao)
      .where(eq(schema.avaliacao.osId, os.id));
    expect(salvo1).toBeDefined();
    expect(salvo1.nota).toBe(4);
    expect(salvo1.comentarioOs).toBe("Ótimo");

    await registrarAvaliacoes(token, {
      avaliacoes: [{ osId: os.id, nota: 2, comentarioOs: "Poderia ser melhor" }]
    }, { ip: "127.0.0.1" }, repo);

    const avs = await db
      .select()
      .from(schema.avaliacao)
      .where(eq(schema.avaliacao.osId, os.id));
    expect(avs).toHaveLength(1);
    expect(avs[0].nota).toBe(2);
    expect(avs[0].comentarioOs).toBe("Poderia ser melhor");
  });

  it("A4 — Comentário geral: 1 por Solicitação; reenvio sobrescreve", async () => {
    const token = `tok-test-a4-${Math.random().toString(36).slice(2, 10)}`;
    const { os, sol } = await seedContexto({ token, comTecnico: true, estado: "CONCLUIDA" });
    const repo = criarAvaliacaoRepoDrizzle(db);

    await registrarAvaliacoes(token, {
      avaliacoes: [{ osId: os.id, nota: 4 }],
      comentarioGeral: "Gostei muito do serviço"
    }, { ip: "127.0.0.1" }, repo);

    const [com1] = await db
      .select()
      .from(schema.comentarioGeral)
      .where(eq(schema.comentarioGeral.solicitacaoId, sol.id));
    expect(com1).toBeDefined();
    expect(com1.comentario).toBe("Gostei muito do serviço");
    expect(com1.atorToken).toBe(token);
    expect(com1.ip).toBe("127.0.0.1");

    await registrarAvaliacoes(token, {
      avaliacoes: [{ osId: os.id, nota: 5 }],
      comentarioGeral: "Excelente atendimento geral"
    }, { ip: "127.0.0.1" }, repo);

    const coms = await db
      .select()
      .from(schema.comentarioGeral)
      .where(eq(schema.comentarioGeral.solicitacaoId, sol.id));
    expect(coms).toHaveLength(1);
    expect(coms[0].comentario).toBe("Excelente atendimento geral");
  });

  it("A5 — validações: nota inválida lança NotaInvalidaError; OS de outro token/não concluída lança OsNaoAvaliavelError", async () => {
    const token = `tok-test-a5-${Math.random().toString(36).slice(2, 10)}`;
    const { os } = await seedContexto({ token, comTecnico: true, estado: "CONCLUIDA" });
    const repo = criarAvaliacaoRepoDrizzle(db);

    // Nota 0 (inválida)
    await expect(
      registrarAvaliacoes(token, {
        avaliacoes: [{ osId: os.id, nota: 0 }]
      }, { ip: "127.0.0.1" }, repo)
    ).rejects.toThrow(NotaInvalidaError);

    // Nota 6 (inválida)
    await expect(
      registrarAvaliacoes(token, {
        avaliacoes: [{ osId: os.id, nota: 6 }]
      }, { ip: "127.0.0.1" }, repo)
    ).rejects.toThrow(NotaInvalidaError);

    // OS não concluída/paga (EM_EXECUCAO)
    const { os: osExec } = await seedContexto({ token: token + "-exec", comTecnico: true, estado: "EM_EXECUCAO" });
    await expect(
      registrarAvaliacoes(token, {
        avaliacoes: [{ osId: osExec.id, nota: 4 }]
      }, { ip: "127.0.0.1" }, repo)
    ).rejects.toThrow(OsNaoAvaliavelError);

    // OS de outra solicitação (token diferente)
    const otherToken = `tok-other-${Math.random().toString(36).slice(2, 10)}`;
    const { os: osOutra } = await seedContexto({ token: otherToken, comTecnico: true, estado: "CONCLUIDA" });
    await expect(
      registrarAvaliacoes(token, {
        avaliacoes: [{ osId: osOutra.id, nota: 4 }]
      }, { ip: "127.0.0.1" }, repo)
    ).rejects.toThrow(OsNaoAvaliavelError);
  });

  it("A6 — carregarParaAvaliar: lista apenas OS elegíveis e associa a avaliação anterior", async () => {
    const token = `tok-test-a6-${Math.random().toString(36).slice(2, 10)}`;
    
    // Seed: 1 OS concluída, com técnico
    const { os: os1, sol, cli, tecnicoId } = await seedContexto({ token, comTecnico: true, estado: "CONCLUIDA" });
    
    // Seed: second OS that is PAGA (evaluable) under same solicitation
    const [os2] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "PINTURA",
        tipo: "NORMAL",
        estado: "PAGA",
      })
      .returning();
    osIds.push(os2.id);

    // Seed: third OS that is EM_EXECUCAO (NOT evaluable) under same solicitation
    const [os3] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "DRYWALL",
        tipo: "NORMAL",
        estado: "EM_EXECUCAO",
      })
      .returning();
    osIds.push(os3.id);

    // Seed: OS from another solicitation (NOT evaluable under this token)
    const otherToken = `tok-other-a6-${Math.random().toString(36).slice(2, 10)}`;
    await seedContexto({ token: otherToken, comTecnico: false, estado: "CONCLUIDA" });

    const repo = criarAvaliacaoRepoDrizzle(db);

    // Set evaluation for OS 1
    await registrarAvaliacoes(token, {
      avaliacoes: [{ osId: os1.id, nota: 3, comentarioOs: "Bom" }],
      comentarioGeral: "Geralmente bom"
    }, { ip: "127.0.0.1" }, repo);

    // Load view
    const view = await carregarParaAvaliar(token, repo);

    expect(view).toBeDefined();
    expect(view.clienteNome).toBe(cli.nome);
    expect(view.clienteEmail).toBe(cli.email);
    expect(view.clienteWhatsapp).toBe(cli.whatsapp);
    expect(view.solicitacaoId).toBe(sol.id);
    expect(view.comentarioGeral).toBe("Geralmente bom");

    // ordens should have exactly 2 elements: os1 and os2
    expect(view.ordens).toHaveLength(2);
    const ordensMap = new Map(view.ordens.map(o => [o.id, o]));
    
    const viewOs1 = ordensMap.get(os1.id);
    expect(viewOs1).toBeDefined();
    expect(viewOs1!.tipo).toBe(os1.tipo);
    expect(viewOs1!.estado).toBe(os1.estado);
    expect(viewOs1!.tecnicoId).toBe(tecnicoId);
    expect(viewOs1!.avaliacao).toEqual({
      nota: 3,
      comentarioOs: "Bom"
    });

    const viewOs2 = ordensMap.get(os2.id);
    expect(viewOs2).toBeDefined();
    expect(viewOs2!.tipo).toBe(os2.tipo);
    expect(viewOs2!.estado).toBe(os2.estado);
    expect(viewOs2!.tecnicoId).toBeNull();
    expect(viewOs2!.avaliacao).toBeNull();
  });
});
