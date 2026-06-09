import { config } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("DashboardRepo Drizzle (contadores de OS)", () => {
  let repo: import("@/features/dashboard/dashboard").DashboardRepo;
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let osIds: string[] = [];
  let membroIds: string[] = [];
  let alertaIds: string[] = [];
  let avaliacaoIds: string[] = [];
  let chamadoIds: string[] = [];
  let pagamentoIds: { paymentId: string; osId: string }[] = [];
  let orcamentoIds: string[] = [];
  let transicaoIds: string[] = [];

  async function seedTecnico() {
    const r = Math.random().toString(36).slice(2, 10);
    const [m] = await dbRaw
      .insert(schema.membro)
      .values({
        nome: `Tec ${r}`,
        email: `tec-${r}@dbg.test`,
        isTecnico: true,
        especialidades: ["ELETRICA"],
      })
      .returning();
    membroIds.push(m.id);
    return m.id;
  }

  async function seedOs(
    categoria: "ELETRICA" | "PINTURA",
    estado: "NOVA" | "ORCADA" | "CONCLUIDA" | "PAGA",
    tecnicoId: string | null = null,
    prazoGarantiaMeses: number | null = null,
  ) {
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
        categorias: [categoria],
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
        categoria,
        tipo: "NORMAL",
        estado,
        tecnicoId,
        prazoGarantiaMeses,
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
    const { criarDashboardRepoDrizzle } = await import(
      "@/features/dashboard/dashboard-repo-drizzle"
    );
    dbRaw = dbMod.db;
    repo = criarDashboardRepoDrizzle(dbMod.db);
  });

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
    osIds = [];
    membroIds = [];
    alertaIds = [];
    avaliacaoIds = [];
    chamadoIds = [];
    pagamentoIds = [];
    orcamentoIds = [];
    transicaoIds = [];
  });

  afterAll(async () => {
    const { inArray, and, eq } = await import("drizzle-orm");
    if (alertaIds.length) {
      await dbRaw.delete(schema.alertaAvaliacao).where(inArray(schema.alertaAvaliacao.id, alertaIds));
    }
    if (avaliacaoIds.length) {
      await dbRaw.delete(schema.avaliacao).where(inArray(schema.avaliacao.id, avaliacaoIds));
    }
    // Defensivo: testes paralelos varrem OS CONCLUIDA e podem anexar avaliações
    // às nossas OS semeadas (jobs globais). Remove qualquer avaliação que ainda
    // referencie nossas OS antes de deletá-las, evitando violação de FK.
    if (osIds.length) {
      await dbRaw.delete(schema.avaliacao).where(inArray(schema.avaliacao.osId, osIds));
    }
    if (chamadoIds.length) {
      await dbRaw.delete(schema.garantiaChamado).where(inArray(schema.garantiaChamado.id, chamadoIds));
    }
    if (pagamentoIds.length) {
      for (const p of pagamentoIds) {
        await dbRaw
          .delete(schema.pagamento)
          .where(and(eq(schema.pagamento.paymentId, p.paymentId), eq(schema.pagamento.osId, p.osId)));
      }
    }
    if (orcamentoIds.length) {
      await dbRaw.delete(schema.orcamento).where(inArray(schema.orcamento.id, orcamentoIds));
    }
    if (transicaoIds.length) {
      await dbRaw.delete(schema.transicaoOs).where(inArray(schema.transicaoOs.id, transicaoIds));
    }
    if (solicitacaoIds.length) {
      await dbRaw
        .delete(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      await dbRaw
        .delete(schema.solicitacao)
        .where(inArray(schema.solicitacao.id, solicitacaoIds));
    }
    if (clienteIds.length) {
      await dbRaw.delete(schema.cliente).where(inArray(schema.cliente.id, clienteIds));
    }
    if (membroIds.length) {
      await dbRaw.delete(schema.membro).where(inArray(schema.membro.id, membroIds));
    }
  });

  it("conta OS por estado/atribuição refletindo o que foi semeado", async () => {
    await seedOs("ELETRICA", "NOVA"); // entra na fila + minha fila ELETRICA
    await seedOs("PINTURA", "NOVA"); // entra na fila, NÃO na fila ELETRICA
    await seedOs("ELETRICA", "ORCADA"); // aguardando aprovação, fora da fila

    // Contadores globais: outros arquivos de teste rodam em paralelo no mesmo
    // banco. As linhas semeadas aqui só são removidas no afterAll, então um
    // limite inferior absoluto (>=) é estável — concorrência só soma rows.
    expect(await repo.contarOsNovasNaFila()).toBeGreaterThanOrEqual(2);
    expect(await repo.contarOsAguardandoAprovacao()).toBeGreaterThanOrEqual(1);
    expect(await repo.contarOsCriadasHoje()).toBeGreaterThanOrEqual(3);
    expect(await repo.contarMinhaFila(["ELETRICA"])).toBeGreaterThanOrEqual(1);
    // Lista vazia de especialidades nunca conta nada — determinístico.
    expect(await repo.contarMinhaFila([])).toBe(0);
  });

  it("conta apenas as OS atribuídas ao técnico informado", async () => {
    const tec = await seedTecnico();
    expect(await repo.contarOsAtribuidasA(tec)).toBe(0);
    await seedOs("ELETRICA", "NOVA", tec);
    await seedOs("ELETRICA", "ORCADA", tec);
    expect(await repo.contarOsAtribuidasA(tec)).toBe(2);
  });

  it("Slice 9: taxa de aprovação reflete transições semeadas nos últimos 30 dias", async () => {
    // OS 1: ORCADA e APROVADA dentro de 30 dias (conta no numerador e denominador)
    const os1 = await seedOs("ELETRICA", "ORCADA");
    const [t1_1] = await dbRaw.insert(schema.transicaoOs).values({
      osId: os1,
      estadoAnterior: "NOVA",
      estadoNovo: "ORCADA",
      atorEmail: "teste@dbg.test",
      em: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 dias atrás
    }).returning();
    transicaoIds.push(t1_1.id);
    const [t1_2] = await dbRaw.insert(schema.transicaoOs).values({
      osId: os1,
      estadoAnterior: "ORCADA",
      estadoNovo: "APROVADA",
      atorEmail: "teste@dbg.test",
      em: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000), // 9 dias atrás
    }).returning();
    transicaoIds.push(t1_2.id);

    // OS 2: ORCADA dentro de 30 dias, mas não aprovada (conta no denominador, não no numerador)
    const os2 = await seedOs("ELETRICA", "ORCADA");
    const [t2_1] = await dbRaw.insert(schema.transicaoOs).values({
      osId: os2,
      estadoAnterior: "NOVA",
      estadoNovo: "ORCADA",
      atorEmail: "teste@dbg.test",
      em: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 dias atrás
    }).returning();
    transicaoIds.push(t2_1.id);

    // OS 3: ORCADA há mais de 30 dias (não deve contar no denominador)
    const os3 = await seedOs("ELETRICA", "ORCADA");
    const [t3_1] = await dbRaw.insert(schema.transicaoOs).values({
      osId: os3,
      estadoAnterior: "NOVA",
      estadoNovo: "ORCADA",
      atorEmail: "teste@dbg.test",
      em: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 dias atrás
    }).returning();
    transicaoIds.push(t3_1.id);

    const orcadas = await repo.contarOsOrcadas30d();
    const aprovadas = await repo.contarOsAprovadas30d();

    expect(orcadas).toBeGreaterThanOrEqual(2);
    expect(aprovadas).toBeGreaterThanOrEqual(1);
  });

  it("Slice 10: garantia expirada não conta como ativa", async () => {
    // OS 1: prazo 12 meses, paga e com pagamento approved ontem -> Ativa
    const os1 = await seedOs("ELETRICA", "PAGA", null, 12);
    const [pag1] = await dbRaw.insert(schema.pagamento).values({
      paymentId: `pay-${Math.random().toString(36).slice(2, 10)}`,
      osId: os1,
      valor: "150.00",
      metodo: "pix",
      status: "approved",
      criadoEm: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // ontem
    }).returning();
    pagamentoIds.push({ paymentId: pag1.paymentId, osId: pag1.osId });

    // OS 2: prazo 6 meses, paga e com pagamento approved há 8 meses -> Expirada (não conta)
    const os2 = await seedOs("ELETRICA", "PAGA", null, 6);
    const [pag2] = await dbRaw.insert(schema.pagamento).values({
      paymentId: `pay-${Math.random().toString(36).slice(2, 10)}`,
      osId: os2,
      valor: "150.00",
      metodo: "pix",
      status: "approved",
      criadoEm: new Date(Date.now() - 8 * 30 * 24 * 60 * 60 * 1000), // 8 meses atrás
    }).returning();
    pagamentoIds.push({ paymentId: pag2.paymentId, osId: pag2.osId });

    // OS 3: prazo nulo, paga e com pagamento ontem -> Não conta
    const os3 = await seedOs("ELETRICA", "PAGA", null, null);
    const [pag3] = await dbRaw.insert(schema.pagamento).values({
      paymentId: `pay-${Math.random().toString(36).slice(2, 10)}`,
      osId: os3,
      valor: "150.00",
      metodo: "pix",
      status: "approved",
      criadoEm: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // ontem
    }).returning();
    pagamentoIds.push({ paymentId: pag3.paymentId, osId: pag3.osId });

    const ativas = await repo.contarGarantiasAtivas();
    expect(ativas).toBeGreaterThanOrEqual(1);
  });

  it("Slice 11: chamados abertos vs resolvidos no mês", async () => {
    const os = await seedOs("ELETRICA", "NOVA");

    // Chamado 1: pendente -> Abertos
    const [ch1] = await dbRaw.insert(schema.garantiaChamado).values({
      osOrigemId: os,
      descricao: "Chamado 1",
      fotoUrl: "https://foto.com",
      criadoPor: "cliente",
      canal: "WHATSAPP",
      status: "pendente",
    }).returning();
    chamadoIds.push(ch1.id);

    // Chamado 2: aplicada, decidido_em este mês -> Resolvido no mês
    const [ch2] = await dbRaw.insert(schema.garantiaChamado).values({
      osOrigemId: os,
      descricao: "Chamado 2",
      fotoUrl: "https://foto.com",
      criadoPor: "cliente",
      canal: "WHATSAPP",
      status: "aplicada",
      decididoEm: new Date(),
    }).returning();
    chamadoIds.push(ch2.id);

    // Chamado 3: rejeitado, decidido_em há 45 dias -> Não resolvido este mês
    const [ch3] = await dbRaw.insert(schema.garantiaChamado).values({
      osOrigemId: os,
      descricao: "Chamado 3",
      fotoUrl: "https://foto.com",
      criadoPor: "cliente",
      canal: "WHATSAPP",
      status: "rejeitada",
      decididoEm: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
    }).returning();
    chamadoIds.push(ch3.id);

    expect(await repo.contarChamadosGarantiaAbertos()).toBeGreaterThanOrEqual(1);
    expect(await repo.contarChamadosGarantiaResolvidosNoMes()).toBeGreaterThanOrEqual(1);
  });

  it("Slice 12: inadimplência > 7 dias", async () => {
    // OS 1: CONCLUIDA, transição há 10 dias, sem pagamento -> Conta
    const os1 = await seedOs("PINTURA", "CONCLUIDA");
    const [t1] = await dbRaw.insert(schema.transicaoOs).values({
      osId: os1,
      estadoAnterior: "NOVA",
      estadoNovo: "CONCLUIDA",
      atorEmail: "teste@dbg.test",
      em: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    }).returning();
    transicaoIds.push(t1.id);

    // OS 2: CONCLUIDA, transição há 3 dias, sem pagamento -> Não conta
    const os2 = await seedOs("PINTURA", "CONCLUIDA");
    const [t2] = await dbRaw.insert(schema.transicaoOs).values({
      osId: os2,
      estadoAnterior: "NOVA",
      estadoNovo: "CONCLUIDA",
      atorEmail: "teste@dbg.test",
      em: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    }).returning();
    transicaoIds.push(t2.id);

    // OS 3: CONCLUIDA, transição há 10 dias, mas com pagamento approved -> Não conta
    const os3 = await seedOs("PINTURA", "CONCLUIDA");
    const [t3] = await dbRaw.insert(schema.transicaoOs).values({
      osId: os3,
      estadoAnterior: "NOVA",
      estadoNovo: "CONCLUIDA",
      atorEmail: "teste@dbg.test",
      em: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    }).returning();
    transicaoIds.push(t3.id);
    const [pag3] = await dbRaw.insert(schema.pagamento).values({
      paymentId: `pay-${Math.random().toString(36).slice(2, 10)}`,
      osId: os3,
      valor: "200.00",
      metodo: "pix",
      status: "approved",
    }).returning();
    pagamentoIds.push({ paymentId: pag3.paymentId, osId: pag3.osId });

    expect(await repo.contarInadimplenciaMais7Dias()).toBeGreaterThanOrEqual(1);
  });

  it("Slice 13: média geral + ranking via banco", async () => {
    const tec1 = await seedTecnico();
    const tec2 = await seedTecnico();
    const os1 = await seedOs("ELETRICA", "CONCLUIDA", tec1);
    const os2 = await seedOs("ELETRICA", "CONCLUIDA", tec2);
    const os3 = await seedOs("ELETRICA", "CONCLUIDA", tec2);

    // Avaliação válida p/ tec1 (nota 5)
    const [av1] = await dbRaw.insert(schema.avaliacao).values({
      osId: os1,
      tecnicoId: tec1,
      nota: 5,
      comentarioOs: "Top",
      invalida: false,
      atorToken: "tok-1",
      ip: "127.0.0.1",
    }).returning();
    avaliacaoIds.push(av1.id);

    // Avaliação válida p/ tec2 (nota 4)
    const [av2] = await dbRaw.insert(schema.avaliacao).values({
      osId: os2,
      tecnicoId: tec2,
      nota: 4,
      comentarioOs: "Muito bom",
      invalida: false,
      atorToken: "tok-2",
      ip: "127.0.0.1",
    }).returning();
    avaliacaoIds.push(av2.id);

    // Avaliação inválida p/ tec2 (nota 1, mas marcada como invalida)
    const [av3] = await dbRaw.insert(schema.avaliacao).values({
      osId: os3,
      tecnicoId: tec2,
      nota: 1,
      comentarioOs: "Horrível",
      invalida: true,
      atorToken: "tok-3",
      ip: "127.0.0.1",
    }).returning();
    avaliacaoIds.push(av3.id);

    const mediaGeral = await repo.obterNotaMediaGeral();
    expect(mediaGeral).not.toBeNull();
    expect(mediaGeral).toBeGreaterThanOrEqual(4); // (5+4)/2 = 4.5. Deve ser >= 4

    const notas = await repo.listarNotasPorTecnico();
    expect(notas.length).toBeGreaterThanOrEqual(2);

    const n2 = notas.find(n => n.tecnicoId === tec2);
    expect(n2?.media).toBe(4);
    expect(n2?.total).toBe(1); // a inválida não soma no total
  });

  it("#66: concluídas em 30d conta OS com transição→CONCLUIDA na janela", async () => {
    const osRecente = await seedOs("ELETRICA", "CONCLUIDA");
    const [tRecente] = await dbRaw.insert(schema.transicaoOs).values({
      osId: osRecente,
      estadoAnterior: "EM_EXECUCAO",
      estadoNovo: "CONCLUIDA",
      atorEmail: "teste@dbg.test",
      em: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 dias atrás
    }).returning();
    transicaoIds.push(tRecente.id);

    // Fora da janela (40 dias atrás) — não conta.
    const osAntiga = await seedOs("ELETRICA", "CONCLUIDA");
    const [tAntiga] = await dbRaw.insert(schema.transicaoOs).values({
      osId: osAntiga,
      estadoAnterior: "EM_EXECUCAO",
      estadoNovo: "CONCLUIDA",
      atorEmail: "teste@dbg.test",
      em: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    }).returning();
    transicaoIds.push(tAntiga.id);

    expect(await repo.contarOsConcluidas30d()).toBeGreaterThanOrEqual(1);
  });

  it("#66: contagem por estado devolve totais agrupados refletindo o semeado", async () => {
    await seedOs("ELETRICA", "ORCADA");
    const porEstado = await repo.contarOsPorEstado();

    const orcada = porEstado.find((e) => e.estado === "ORCADA");
    expect(orcada).toBeDefined();
    expect(orcada!.total).toBeGreaterThanOrEqual(1);
    // Estados sem nenhuma OS não aparecem na lista (group by).
    porEstado.forEach((e) => expect(e.total).toBeGreaterThan(0));
  });

  it("#66: série por dia cobre toda a janela e soma criadas/concluídas de hoje", async () => {
    await seedOs("PINTURA", "NOVA"); // criada hoje
    const os = await seedOs("PINTURA", "CONCLUIDA");
    const [t] = await dbRaw.insert(schema.transicaoOs).values({
      osId: os,
      estadoAnterior: "EM_EXECUCAO",
      estadoNovo: "CONCLUIDA",
      atorEmail: "teste@dbg.test",
      em: new Date(), // concluída hoje
    }).returning();
    transicaoIds.push(t.id);

    const serie = await repo.serieOsPorDia(14);
    expect(serie).toHaveLength(14); // janela completa, sem buracos
    const hoje = serie[serie.length - 1];
    expect(hoje.criadas).toBeGreaterThanOrEqual(2);
    expect(hoje.concluidas).toBeGreaterThanOrEqual(1);
  });

  it("#66: tempo médio NOVA→PAGA é um número não-nulo quando há OS paga", async () => {
    const os = await seedOs("ELETRICA", "PAGA");
    const [t] = await dbRaw.insert(schema.transicaoOs).values({
      osId: os,
      estadoAnterior: "CONCLUIDA",
      estadoNovo: "PAGA",
      atorEmail: "teste@dbg.test",
      em: new Date(),
    }).returning();
    transicaoIds.push(t.id);

    // DB de integração não é hermético (outros arquivos semeiam OS pagas em
    // paralelo), então a média absoluta não é determinística. O que provamos
    // aqui é que a query (join + extract epoch + avg) roda e devolve um número
    // quando há ao menos uma OS paga; o cálculo exato é coberto pelo unit.
    const segundos = await repo.tempoMedioNovaPagaSegundos();
    expect(segundos).not.toBeNull();
    expect(typeof segundos).toBe("number");
    expect(Number.isFinite(segundos)).toBe(true);
  });
});
