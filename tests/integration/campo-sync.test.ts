import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { processarItemSync } from "@/features/campo/sync";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("processarItemSync Integration Tests", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let membroIds: string[] = [];
  let notificacaoIds: string[] = [];

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
  });

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
    membroIds = [];
    notificacaoIds = [];
  });

  afterAll(async () => {
    const { inArray, eq } = await import("drizzle-orm");
    
    if (notificacaoIds.length) {
      await dbRaw
        .delete(schema.notificacaoInApp)
        .where(inArray(schema.notificacaoInApp.id, notificacaoIds));
    }
    
    // Deleta notificações gerais criadas durantes os testes que possam não estar listadas
    await dbRaw
      .delete(schema.notificacaoInApp)
      .where(eq(schema.notificacaoInApp.destinatarioModulo, "OPERACAO"));

    if (solicitacaoIds.length) {
      const osRows = await dbRaw
        .select({ id: schema.ordemServico.id })
        .from(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      const osIds = osRows.map((o) => o.id);
      
      if (osIds.length) {
        await dbRaw
          .delete(schema.pagamento)
          .where(inArray(schema.pagamento.osId, osIds));
        await dbRaw
          .delete(schema.transicaoOs)
          .where(inArray(schema.transicaoOs.osId, osIds));
        await dbRaw
          .delete(schema.osHistoricoConflito)
          .where(inArray(schema.osHistoricoConflito.osId, osIds));
      }
      
      await dbRaw
        .delete(schema.ordemServico)
        .where(inArray(schema.ordemServico.solicitacaoId, solicitacaoIds));
      await dbRaw
        .delete(schema.solicitacao)
        .where(inArray(schema.solicitacao.id, solicitacaoIds));
    }

    if (membroIds.length) {
      await dbRaw
        .delete(schema.membro)
        .where(inArray(schema.membro.id, membroIds));
    }

    if (clienteIds.length) {
      await dbRaw
        .delete(schema.cliente)
        .where(inArray(schema.cliente.id, clienteIds));
    }
  });

  async function seedMembro(nome: string, email: string, isTecnico = true) {
    const [m] = await dbRaw
      .insert(schema.membro)
      .values({
        nome,
        email,
        isTecnico,
        especialidades: ["ELETRICA"],
      })
      .returning();
    membroIds.push(m.id);
    return m.id;
  }

  async function seedOs(estado: "NOVA" | "AGENDADA" | "EM_EXECUCAO", tecnicoId: string | null = null) {
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
        tecnicoId,
        metadados: {},
      })
      .returning();

    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    return os.id;
  }

  it("sem conflito, processa transição com sucesso atualizando a base de dados", async () => {
    const email = `tec-normal-${Math.random().toString(36).slice(2, 6)}@dbg.test`;
    const tecId = await seedMembro("Técnico Normal", email);
    const osId = await seedOs("AGENDADA", tecId);

    const item = {
      tipo: "TRANSICAO",
      payload: {
        osId,
        alvo: "A_CAMINHO",
        lat: -23.5,
        lon: -46.6,
      },
      criadoEm: new Date().toISOString(),
    };

    const res = await processarItemSync(dbRaw, item, email);
    expect(res.conflito).toBe(false);

    // Verifica atualização no banco de dados
    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select({ estado: schema.ordemServico.estado })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId));
    expect(os.estado).toBe("A_CAMINHO");

    // Verifica que a transição foi gravada no histórico
    const hist = await dbRaw
      .select()
      .from(schema.transicaoOs)
      .where(eq(schema.transicaoOs.osId, osId));
    expect(hist).toHaveLength(1);
    expect(hist[0].estadoAnterior).toBe("AGENDADA");
    expect(hist[0].estadoNovo).toBe("A_CAMINHO");
  });

  it("detecta conflito e bloqueia transição se a OS estiver atribuída a outro técnico", async () => {
    const originalEmail = `tec-orig-${Math.random().toString(36).slice(2, 6)}@dbg.test`;
    const outroEmail = `tec-outro-${Math.random().toString(36).slice(2, 6)}@dbg.test`;

    const tecOriginalId = await seedMembro("Técnico Original", originalEmail);
    const tecOutroId = await seedMembro("Técnico Outro", outroEmail);

    // OS começa atribuída ao outro técnico
    const osId = await seedOs("AGENDADA", tecOutroId);

    const item = {
      tipo: "TRANSICAO",
      payload: {
        osId,
        alvo: "A_CAMINHO",
      },
      criadoEm: new Date().toISOString(),
    };

    // Original envia offline
    const res = await processarItemSync(dbRaw, item, originalEmail);
    expect(res.conflito).toBe(true);

    // Estado da OS não deve ter mudado
    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select({ estado: schema.ordemServico.estado })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId));
    expect(os.estado).toBe("AGENDADA");

    // Deve ter gravado o histórico de conflitos
    const conflitos = await dbRaw
      .select()
      .from(schema.osHistoricoConflito)
      .where(eq(schema.osHistoricoConflito.osId, osId));
    expect(conflitos).toHaveLength(1);
    expect(conflitos[0].tecnicoEmail).toBe(originalEmail);

    // Deve ter gerado notificação in-app para o técnico
    const notificacoesTec = await dbRaw
      .select()
      .from(schema.notificacaoInApp)
      .where(eq(schema.notificacaoInApp.destinatarioEmail, originalEmail));
    expect(notificacoesTec).toHaveLength(1);
    expect(notificacoesTec[0].titulo).toContain("OS Reatribuída");
    notificacaoIds.push(notificacoesTec[0].id);

    // Deve ter gerado notificação para o admin da OPERAÇÃO
    const notificacoesAdmin = await dbRaw
      .select()
      .from(schema.notificacaoInApp)
      .where(eq(schema.notificacaoInApp.destinatarioModulo, "OPERACAO"));
    expect(notificacoesAdmin.length).toBeGreaterThanOrEqual(1);
    for (const notif of notificacoesAdmin) {
      notificacaoIds.push(notif.id);
    }
  });

  it("sem conflito, processa NOTA e MATERIAL atualizando metadados da OS no banco de dados", async () => {
    const email = `tec-meta-${Math.random().toString(36).slice(2, 6)}@dbg.test`;
    const tecId = await seedMembro("Técnico Metadados", email);
    const osId = await seedOs("EM_EXECUCAO", tecId);

    const itemNota = {
      tipo: "NOTA",
      payload: {
        osId,
        texto: "Minha nota offline de teste real",
      },
      criadoEm: new Date().toISOString(),
    };

    const resNota = await processarItemSync(dbRaw, itemNota, email);
    expect(resNota.conflito).toBe(false);

    const itemMaterial = {
      tipo: "MATERIAL",
      payload: {
        osId,
        item: "Cabo Flexível 2.5mm",
        quantidade: 10,
        observacao: "ligações",
      },
      criadoEm: new Date().toISOString(),
    };

    const resMaterial = await processarItemSync(dbRaw, itemMaterial, email);
    expect(resMaterial.conflito).toBe(false);

    // Verifica que metadados no banco contêm nota e materiais
    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select({ metadados: schema.ordemServico.metadados })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId));

    const meta = os.metadados as any;
    expect(meta.notaServico).toBe("Minha nota offline de teste real");
    expect(meta.materiais).toHaveLength(1);
    expect(meta.materiais[0].item).toBe("Cabo Flexível 2.5mm");
    expect(meta.materiais[0].quantidade).toBe(10);
    expect(meta.materiais[0].observacao).toBe("ligações");
  });

  it("processa CHECKLIST gravando os_checklist_resultado por item no banco", async () => {
    const email = `tec-chk-${Math.random().toString(36).slice(2, 6)}@dbg.test`;
    const tecId = await seedMembro("Técnico Checklist", email);
    const osId = await seedOs("EM_EXECUCAO", tecId);

    const fakeUpload = {
      enviar: async ({ itemId }: { itemId: string }) => ({
        url: `os/${osId}/checklist/${itemId}/foto.jpg`,
      }),
    };

    const item = {
      tipo: "CHECKLIST",
      payload: {
        osId,
        resultados: [
          {
            itemId: "11111111-1111-1111-1111-111111111111",
            descricaoSnapshot: "Verificar disjuntores",
            status: "OK",
            observacao: "ok",
            temFoto: false,
          },
          {
            itemId: "22222222-2222-2222-2222-222222222222",
            descricaoSnapshot: "Testar tomadas",
            status: "PROBLEMA",
            observacao: "tomada queimada",
            temFoto: true,
            dataUrl: "data:image/jpeg;base64,YWJj",
          },
        ],
      },
      criadoEm: new Date().toISOString(),
    };

    const res = await processarItemSync(dbRaw, item, email, {
      uploadFotoChecklist: fakeUpload,
    });
    expect(res.conflito).toBe(false);

    const { eq, asc } = await import("drizzle-orm");
    const linhas = await dbRaw
      .select()
      .from(schema.osChecklistResultado)
      .where(eq(schema.osChecklistResultado.osId, osId))
      .orderBy(asc(schema.osChecklistResultado.descricaoSnapshot));

    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({
      descricaoSnapshot: "Testar tomadas",
      status: "PROBLEMA",
      observacao: "tomada queimada",
      fotoUrl: `os/${osId}/checklist/22222222-2222-2222-2222-222222222222/foto.jpg`,
    });
    expect(linhas[1]).toMatchObject({
      descricaoSnapshot: "Verificar disjuntores",
      status: "OK",
      fotoUrl: null,
    });
  });

  it("processa item sync PAGAMENTO_MANUAL e transita OS para PAGA", async () => {
    const email = "tecnico-sync-pg@dbg.test";
    const tecId = await seedMembro("Técnico Sync PG", email);
    const osId = await seedOs("CONCLUIDA" as any, tecId);

    const itemPg = {
      tipo: "PAGAMENTO_MANUAL",
      payload: {
        osId,
        valor: "150.00",
        metodo: "DINHEIRO",
        observacao: "Offline obs",
      },
      criadoEm: new Date().toISOString(),
    };

    const res = await processarItemSync(dbRaw, itemPg, email);
    expect(res.conflito).toBe(false);

    // Verifica que OS virou PAGA
    const { eq } = await import("drizzle-orm");
    const [os] = await dbRaw
      .select({ estado: schema.ordemServico.estado })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId));
    expect(os.estado).toBe("PAGA");

    // Verifica que o pagamento foi gravado
    const [pag] = await dbRaw
      .select()
      .from(schema.pagamento)
      .where(eq(schema.pagamento.osId, osId));
    expect(pag).toBeDefined();
    expect(pag.metodo).toBe("DINHEIRO");
    expect(pag.observacao).toBe("Offline obs");
  });
});
