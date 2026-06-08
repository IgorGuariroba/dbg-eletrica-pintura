import { describe, expect, it, vi } from "vitest";
import { processarItemSync } from "@/features/campo/sync";

describe("processarItemSync — Detecção de Conflitos", () => {
  it("detecta conflito se o técnico atual no banco for diferente do remetente offline", async () => {
    // Mock do banco de dados Drizzle
    const dbMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        // Retorna uma OS atribuída a "outro@dbg.com"
        return {
          limit: vi.fn().mockResolvedValue([
            {
              tecnicoEmail: "outro@dbg.com",
              estado: "A_CAMINHO",
            },
          ]),
        };
      }),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    } as any;

    const item = {
      id: 1,
      tipo: "TRANSICAO",
      payload: {
        osId: "os-abc",
        alvo: "NO_LOCAL",
      },
      criadoEm: new Date().toISOString(),
    };

    const res = await processarItemSync(dbMock, item, "original@dbg.com");

    expect(res.conflito).toBe(true);
    // Deve inserir o item conflitante no histórico de conflitos
    expect(dbMock.insert).toHaveBeenCalled();
  });

  it("sem conflito, processa transição com sucesso chamando aplicarTransicao", async () => {
    const queryResult = {
      limit: vi.fn().mockImplementation(async () => [
        {
          tecnicoEmail: "original@dbg.com",
          estado: "A_CAMINHO",
          tipo: "NORMAL",
        },
      ]),
      orderBy: vi.fn().mockResolvedValue([]),
    };

    const dbMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue(queryResult),
      batch: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    } as any;


    const item = {
      id: 1,
      tipo: "TRANSICAO",
      payload: {
        osId: "os-abc",
        alvo: "NO_LOCAL",
        lat: -23.5,
        lon: -46.6,
      },
      criadoEm: new Date().toISOString(),
    };

    const res = await processarItemSync(dbMock, item, "original@dbg.com");

    expect(res.conflito).toBe(false);
    // Deve rodar a transição via batch (que é usado pelo TransicaoRepoDrizzle)
    expect(dbMock.batch).toHaveBeenCalled();
  });

  it("sem conflito, processa FOTO com sucesso realizando upload para R2", async () => {
    const queryResult = {
      limit: vi.fn().mockImplementation(async () => [
        {
          tecnicoEmail: "original@dbg.com",
          estado: "EM_EXECUCAO",
          tipo: "NORMAL",
        },
      ]),
    };

    const dbMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue(queryResult),
    } as any;

    const mockUpload = {
      enviarFoto: vi.fn().mockResolvedValue({ url: "os/os-abc/antes/foto123.jpg" }),
    };

    const item = {
      id: 2,
      tipo: "FOTO",
      payload: {
        osId: "os-abc",
        tipo: "ANTES",
        dataUrl: "data:image/jpeg;base64,YWJj",
      },
      criadoEm: new Date().toISOString(),
    };

    const res = await processarItemSync(dbMock, item, "original@dbg.com", {
      uploadFoto: mockUpload,
    });

    expect(res.conflito).toBe(false);
    expect(mockUpload.enviarFoto).toHaveBeenCalledWith({
      osId: "os-abc",
      tipo: "ANTES",
      dataUrl: "data:image/jpeg;base64,YWJj",
    });
  });

  it("FOTO marcada para portfólio registra candidata PENDENTE com a chave do R2", async () => {
    const queryResult = {
      limit: vi.fn().mockImplementation(async () => [
        {
          tecnicoEmail: "original@dbg.com",
          tecnicoId: "tec-1",
          estado: "EM_EXECUCAO",
          tipo: "NORMAL",
          categoria: "ELETRICA",
        },
      ]),
    };
    const dbMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue(queryResult),
    } as any;

    const mockUpload = {
      enviarFoto: vi
        .fn()
        .mockResolvedValue({ url: "os/os-abc/depois/foto999.jpg" }),
    };
    const mockPortfolio = { marcar: vi.fn().mockResolvedValue({ id: "fp-1" }) };

    const item = {
      id: 9,
      tipo: "FOTO",
      payload: {
        osId: "os-abc",
        tipo: "DEPOIS",
        dataUrl: "data:image/jpeg;base64,YWJj",
        portfolio: true,
      },
      criadoEm: new Date().toISOString(),
    };

    const res = await processarItemSync(dbMock, item, "original@dbg.com", {
      uploadFoto: mockUpload,
      portfolioRepo: mockPortfolio as any,
    });

    expect(res.conflito).toBe(false);
    expect(mockPortfolio.marcar).toHaveBeenCalledWith({
      osId: "os-abc",
      tecnicoId: "tec-1",
      categoria: "ELETRICA",
      tipo: "DEPOIS",
      chavePrivada: "os/os-abc/depois/foto999.jpg",
    });
  });

  it("FOTO sem flag de portfólio NÃO registra candidata", async () => {
    const queryResult = {
      limit: vi.fn().mockImplementation(async () => [
        {
          tecnicoEmail: "original@dbg.com",
          tecnicoId: "tec-1",
          estado: "EM_EXECUCAO",
          tipo: "NORMAL",
          categoria: "ELETRICA",
        },
      ]),
    };
    const dbMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue(queryResult),
    } as any;
    const mockUpload = {
      enviarFoto: vi.fn().mockResolvedValue({ url: "os/os-abc/antes/x.jpg" }),
    };
    const mockPortfolio = { marcar: vi.fn() };

    const item = {
      id: 10,
      tipo: "FOTO",
      payload: {
        osId: "os-abc",
        tipo: "ANTES",
        dataUrl: "data:image/jpeg;base64,YWJj",
      },
      criadoEm: new Date().toISOString(),
    };

    await processarItemSync(dbMock, item, "original@dbg.com", {
      uploadFoto: mockUpload,
      portfolioRepo: mockPortfolio as any,
    });
    expect(mockPortfolio.marcar).not.toHaveBeenCalled();
  });

  it("sem conflito, processa NOTA com sucesso atualizando os metadados da OS", async () => {
    const queryResult = {
      limit: vi.fn().mockImplementation(async () => [
        {
          tecnicoEmail: "original@dbg.com",
          estado: "EM_EXECUCAO",
          tipo: "NORMAL",
          metadados: {},
        },
      ]),
    };

    const dbMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue(queryResult),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    } as any;

    const item = {
      id: 3,
      tipo: "NOTA",
      payload: {
        osId: "os-abc",
        texto: "teste de nota offline",
      },
      criadoEm: new Date().toISOString(),
    };

    const res = await processarItemSync(dbMock, item, "original@dbg.com");

    expect(res.conflito).toBe(false);
    expect(dbMock.update).toHaveBeenCalled();
    expect(dbMock.set).toHaveBeenCalledWith(
      expect.objectContaining({
        metadados: expect.objectContaining({
          notaServico: "teste de nota offline",
        }),
      })
    );
  });

  it("sem conflito, processa MATERIAL com sucesso atualizando os metadados da OS", async () => {
    const queryResult = {
      limit: vi.fn().mockImplementation(async () => [
        {
          tecnicoEmail: "original@dbg.com",
          estado: "EM_EXECUCAO",
          tipo: "NORMAL",
          metadados: { materiais: [] },
        },
      ]),
    };

    const dbMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue(queryResult),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    } as any;

    const item = {
      id: 4,
      tipo: "MATERIAL",
      payload: {
        osId: "os-abc",
        item: "Disjuntor 20A",
        quantidade: 2,
        observacao: "geral",
      },
      criadoEm: new Date().toISOString(),
    };

    const res = await processarItemSync(dbMock, item, "original@dbg.com");

    expect(res.conflito).toBe(false);
    expect(dbMock.update).toHaveBeenCalled();
    expect(dbMock.set).toHaveBeenCalledWith(
      expect.objectContaining({
        metadados: expect.objectContaining({
          materiais: [
            {
              item: "Disjuntor 20A",
              quantidade: 2,
              observacao: "geral",
            },
          ],
        }),
      })
    );
  });

  it("sem conflito, processa APROVACAO_PRESENCIAL com sucesso chamando aprovarPresencial", async () => {
    const resultBuilder: any = {
      limit: vi.fn(),
      orderBy: vi.fn(),
      returning: vi.fn(),
      then: vi.fn(),
    };
    resultBuilder.limit.mockImplementation(async () => [
      {
        tecnicoEmail: "original@dbg.com",
        estado: "ORCADA",
        tipo: "NORMAL",
        origem: "FORMULARIO",
        n: 1,
      },
    ]);
    resultBuilder.orderBy.mockReturnValue(resultBuilder);
    resultBuilder.returning.mockResolvedValue([{ id: "os-abc" }]);
    resultBuilder.then.mockImplementation((onfulfilled: any) => {
      return Promise.resolve([{ n: 1 }]).then(onfulfilled);
    });

    const queryBuilder = {
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue(resultBuilder),
    };

    const dbMock = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(queryBuilder),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue(resultBuilder),
        }),
      }),
      batch: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([{ id: "os-abc" }]),
      }),
    } as any;

    const mockUpload = {
      enviarAssinatura: vi.fn().mockResolvedValue({ url: "assinaturas/os/os-abc/sig123.png" }),
    };

    const item = {
      id: 5,
      tipo: "APROVACAO_PRESENCIAL",
      payload: {
        osId: "os-abc",
        aprovou: true,
        lgpdAceito: true,
        assinaturaDataUrl: "data:image/png;base64," + "A".repeat(1600),
      },
      criadoEm: new Date().toISOString(),
    };

    const res = await processarItemSync(dbMock, item, "original@dbg.com", {
      uploadAssinatura: mockUpload,
    });

    expect(res.conflito).toBe(false);
    expect(mockUpload.enviarAssinatura).toHaveBeenCalledWith({
      osId: "os-abc",
      dataUrl: "data:image/png;base64," + "A".repeat(1600),
    });
  });

  it("sem conflito, processa CHECKLIST salvando resultados e subindo fotos", async () => {
    const queryResult = {
      limit: vi.fn().mockImplementation(async () => [
        {
          tecnicoEmail: "original@dbg.com",
          estado: "EM_EXECUCAO",
          tipo: "PREVENTIVA",
        },
      ]),
    };
    const dbMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue(queryResult),
    } as any;

    const mockUpload = {
      enviar: vi
        .fn()
        .mockResolvedValue({ url: "os/os-abc/checklist/i2/foto.jpg" }),
    };
    const mockRepo = { salvarResultados: vi.fn(), listarPorOs: vi.fn() };

    const item = {
      id: 11,
      tipo: "CHECKLIST",
      payload: {
        osId: "os-abc",
        resultados: [
          {
            itemId: "i1",
            descricaoSnapshot: "Disjuntores",
            status: "OK",
            observacao: "ok",
            temFoto: false,
          },
          {
            itemId: "i2",
            descricaoSnapshot: "Tomadas",
            status: "PROBLEMA",
            observacao: "queimada",
            temFoto: true,
            dataUrl: "data:image/jpeg;base64,YWJj",
          },
        ],
      },
      criadoEm: new Date().toISOString(),
    };

    const res = await processarItemSync(dbMock, item, "original@dbg.com", {
      uploadFotoChecklist: mockUpload,
      checklistResultadoRepo: mockRepo as any,
    });

    expect(res.conflito).toBe(false);
    expect(mockUpload.enviar).toHaveBeenCalledWith({
      osId: "os-abc",
      itemId: "i2",
      dataUrl: "data:image/jpeg;base64,YWJj",
    });
    expect(mockRepo.salvarResultados).toHaveBeenCalledWith([
      {
        osId: "os-abc",
        itemId: "i1",
        descricaoSnapshot: "Disjuntores",
        status: "OK",
        observacao: "ok",
        fotoUrl: null,
      },
      {
        osId: "os-abc",
        itemId: "i2",
        descricaoSnapshot: "Tomadas",
        status: "PROBLEMA",
        observacao: "queimada",
        fotoUrl: "os/os-abc/checklist/i2/foto.jpg",
      },
    ]);
  });

  it("processa SOLICITACAO_EXPRESS com sucesso chamando criarComOrdens", async () => {
    // Para esta action, o servidor busca o membro Id a partir do e-mail do técnico
    const queryResult = {
      limit: vi.fn().mockImplementation(async () => [
        {
          id: "membro-tec-123",
          email: "original@dbg.com",
        },
      ]),
    };

    const valuesBuilder = {
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "temp-id-123" }]),
    };
    valuesBuilder.onConflictDoUpdate.mockReturnValue(valuesBuilder);

    const dbMock = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnValue(queryResult),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      batch: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue(valuesBuilder),
      }),
    } as any;

    const item = {
      id: 6,
      tipo: "SOLICITACAO_EXPRESS",
      payload: {
        idTemp: "temp-123",
        nome: "Cliente Teste Express",
        whatsapp: "11999999999",
        categorias: ["ELETRICA"],
        endereco: { logradouro: "Rua B", cidade: "SP", uf: "SP" },
      },
      criadoEm: new Date().toISOString(),
    };

    const res = await processarItemSync(dbMock, item, "original@dbg.com");

    expect(res.conflito).toBe(false);
    // Deve fazer a busca do técnico (select) e a inserção (insert)
    expect(dbMock.select).toHaveBeenCalled();
    expect(dbMock.insert).toHaveBeenCalled();
  });

  it("sem conflito, processa CRIACAO_COMPLEMENTAR com sucesso chamando criarComplementar", async () => {
    const dbMock = {
      select: vi.fn().mockImplementation((fields) => {
        const getResults = () => {
          if (fields && "tecnicoEmail" in fields) {
            return [
              {
                tecnicoEmail: "original@dbg.com",
                estado: "EM_EXECUCAO",
                tipo: "NORMAL",
              },
            ];
          }
          if (fields && "solicitacaoId" in fields) {
            return [
              {
                id: "os-abc",
                estado: "EM_EXECUCAO",
                tecnicoId: "membro-tec-123",
                categoria: "ELETRICA",
                solicitacaoId: "sol-abc",
              },
            ];
          }
          if (fields && "precoLitro" in fields) {
            return [
              {
                precoLitro: "6.00",
                kmPorLitro: "10.00",
              },
            ];
          }
          if (fields && "precoBase" in fields) {
            return [
              {
                id: "serv-1",
                categoria: "ELETRICA",
                precoBase: "100.00",
                ativo: true,
              },
            ];
          }
          // Default: query de membro
          return [
            {
              id: "membro-tec-123",
              email: "original@dbg.com",
            },
          ];
        };

        const resultBuilder = {
          limit: vi.fn().mockImplementation(async () => getResults()),
          then: vi.fn().mockImplementation((onfulfilled: any) => {
            return Promise.resolve(getResults()).then(onfulfilled);
          }),
        };
        return {
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnValue(resultBuilder),
          }),
        };
      }),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      batch: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((val) => {
          const insertBuilder = {
            returning: vi.fn().mockResolvedValue([{ id: "comp-1" }]),
            then: vi.fn().mockImplementation((onfulfilled: any) => {
              return Promise.resolve([{ id: "comp-1" }]).then(onfulfilled);
            }),
          };
          return insertBuilder;
        }),
      }),
    } as any;

    const item = {
      id: 7,
      tipo: "CRIACAO_COMPLEMENTAR",
      payload: {
        osPaiId: "os-abc",
        itens: [{ servicoId: "serv-1", quantidade: 1 }],
        km: 5,
      },
      criadoEm: new Date().toISOString(),
    };

    const res = await processarItemSync(dbMock, item, "original@dbg.com");

    expect(res.conflito).toBe(false);
    expect(dbMock.select).toHaveBeenCalled();
    expect(dbMock.insert).toHaveBeenCalled();
  });
});






