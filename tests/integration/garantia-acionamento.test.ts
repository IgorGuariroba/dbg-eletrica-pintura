import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db as dbRaw } from "@/db/client";
import * as schema from "@/db/schema";
import { criarGarantiaRepoDrizzle } from "@/operacao/garantia/garantia-repo-drizzle";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Garantia Acionamento Repo Drizzle Integration", () => {
  let repo: ReturnType<typeof criarGarantiaRepoDrizzle>;

  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let membroIds: string[] = [];
  let servicoIds: string[] = [];
  let osIds: string[] = [];
  let orcamentoIds: string[] = [];
  let pagamentoIds: { paymentId: string; osId: string }[] = [];

  async function seedClienteESolicitacao() {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await dbRaw
      .insert(schema.cliente)
      .values({ nome: `Cli ${r}`, whatsapp: String(Math.floor(1e12 + Math.random() * 9e12)) })
      .returning();
    const [sol] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: `tok-${r}`,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        endereco: { logradouro: "Rua X", cidade: "SP", uf: "SP" },
        origem: "FORMULARIO",
        lgpdAceito: true,
      })
      .returning();
    clienteIds.push(cli.id);
    solicitacaoIds.push(sol.id);
    return { cli, sol, r };
  }

  beforeAll(() => {
    repo = criarGarantiaRepoDrizzle(dbRaw);
  });

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
    membroIds = [];
    servicoIds = [];
    osIds = [];
    orcamentoIds = [];
    pagamentoIds = [];
  });

  afterAll(async () => {
    const { inArray, and, eq } = await import("drizzle-orm");

    if (pagamentoIds.length) {
      for (const p of pagamentoIds) {
        await dbRaw
          .delete(schema.pagamento)
          .where(and(eq(schema.pagamento.paymentId, p.paymentId), eq(schema.pagamento.osId, p.osId)));
      }
    }
    if (orcamentoIds.length) {
      await dbRaw.delete(schema.orcamentoItem).where(inArray(schema.orcamentoItem.orcamentoId, orcamentoIds));
      await dbRaw.delete(schema.orcamento).where(inArray(schema.orcamento.id, orcamentoIds));
    }
    if (osIds.length) {
      // Deletar filhas (GARANTIA / COMPLEMENTAR) primeiro
      const childOs = await dbRaw
        .select({ id: schema.ordemServico.id })
        .from(schema.ordemServico)
        .where(inArray(schema.ordemServico.osPaiId, osIds));
      const childOsIds = childOs.map((o) => o.id);
      if (childOsIds.length) {
        await dbRaw.delete(schema.ordemServico).where(inArray(schema.ordemServico.id, childOsIds));
      }
      await dbRaw.delete(schema.ordemServico).where(inArray(schema.ordemServico.id, osIds));
    }
    if (solicitacaoIds.length) {
      await dbRaw.delete(schema.solicitacao).where(inArray(schema.solicitacao.id, solicitacaoIds));
    }
    if (clienteIds.length) {
      await dbRaw.delete(schema.cliente).where(inArray(schema.cliente.id, clienteIds));
    }
  });

  it("carrega âncora de uma OS Normal paga", async () => {
    const { sol, r } = await seedClienteESolicitacao();
    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        tipo: "NORMAL",
        estado: "PAGA",
        categoria: "ELETRICA",
        prazoGarantiaMeses: 3,
      })
      .returning();
    osIds.push(os.id);

    const dataPagamento = new Date("2026-06-03T12:00:00Z");
    await dbRaw.insert(schema.pagamento).values({
      paymentId: `pay-${r}`,
      osId: os.id,
      valor: "100.00",
      metodo: "PIX",
      status: "approved",
      criadoEm: dataPagamento,
    });
    pagamentoIds.push({ paymentId: `pay-${r}`, osId: os.id });

    const ancora = await repo.carregarAncora(os.id);
    expect(ancora).not.toBeNull();
    expect(ancora!.ancoraId).toBe(os.id);
    expect(ancora!.prazoMeses).toBe(3);
    expect(ancora!.pagamentoEm.toISOString()).toBe(dataPagamento.toISOString());
    expect(ancora!.tipo).toBe("NORMAL");
  });

  it("carrega âncora de uma OS do tipo GARANTIA apontando para a OS pai paga", async () => {
    const { sol, r } = await seedClienteESolicitacao();
    const [pai] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        tipo: "NORMAL",
        estado: "PAGA",
        categoria: "ELETRICA",
        prazoGarantiaMeses: 6,
      })
      .returning();
    osIds.push(pai.id);

    const dataPagamento = new Date("2026-05-01T10:00:00Z");
    await dbRaw.insert(schema.pagamento).values({
      paymentId: `pay-pai-${r}`,
      osId: pai.id,
      valor: "150.00",
      metodo: "PIX",
      status: "approved",
      criadoEm: dataPagamento,
    });
    pagamentoIds.push({ paymentId: `pay-pai-${r}`, osId: pai.id });

    const [filha] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        osPaiId: pai.id,
        tipo: "GARANTIA",
        estado: "CONCLUIDA",
        categoria: "ELETRICA",
        prazoGarantiaMeses: 0,
      })
      .returning();
    osIds.push(filha.id);

    const ancora = await repo.carregarAncora(filha.id);
    expect(ancora).not.toBeNull();
    expect(ancora!.ancoraId).toBe(pai.id);
    expect(ancora!.prazoMeses).toBe(6);
    expect(ancora!.pagamentoEm.toISOString()).toBe(dataPagamento.toISOString());
    expect(ancora!.tipo).toBe("NORMAL");
  });

  it("detecta temComplementarRejeitado corretamemente", async () => {
    const { sol, r } = await seedClienteESolicitacao();
    const [pai] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        tipo: "NORMAL",
        estado: "PAGA",
        categoria: "ELETRICA",
        prazoGarantiaMeses: 3,
      })
      .returning();
    osIds.push(pai.id);

    // Sem complementar deve retornar false
    const inicial = await repo.temComplementarRejeitado(pai.id);
    expect(inicial).toBe(false);

    // Adiciona uma complementar
    const [comp] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        osPaiId: pai.id,
        tipo: "COMPLEMENTAR",
        estado: "REJEITADA",
        categoria: "ELETRICA",
      })
      .returning();
    osIds.push(comp.id);

    // Com complementar REJEITADA deve retornar true
    const comRejeitada = await repo.temComplementarRejeitado(pai.id);
    expect(comRejeitada).toBe(true);
  });

  it("criarChamado persiste os dados corretos no banco", async () => {
    const { sol } = await seedClienteESolicitacao();
    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        tipo: "NORMAL",
        estado: "PAGA",
        categoria: "ELETRICA",
        prazoGarantiaMeses: 3,
      })
      .returning();
    osIds.push(os.id);

    const chamadoInput = {
      osOrigemId: os.id,
      descricao: "Problema elétrico na fiação do chuveiro após reparo",
      fotoUrl: "chamados/os-123/foto.jpg",
      criadoPor: "cliente@email.com",
      canal: "PORTAL" as const,
      temComplementarRejeitado: true,
      acionamentoInvalido: false,
    };

    const out = await repo.criarChamado(chamadoInput);
    expect(out.id).toBeDefined();

    const { eq } = await import("drizzle-orm");
    const [row] = await dbRaw
      .select()
      .from(schema.garantiaChamado)
      .where(eq(schema.garantiaChamado.id, out.id))
      .limit(1);

    expect(row).toBeDefined();
    expect(row.osOrigemId).toBe(os.id);
    expect(row.descricao).toBe(chamadoInput.descricao);
    expect(row.fotoUrl).toBe(chamadoInput.fotoUrl);
    expect(row.criadoPor).toBe(chamadoInput.criadoPor);
    expect(row.canal).toBe("PORTAL");
    expect(row.status).toBe("pendente");
    expect(row.temComplementarRejeitado).toBe(true);
    expect(row.acionamentoInvalido).toBe(false);

    // Cleanup do chamado criado
    await dbRaw.delete(schema.garantiaChamado).where(eq(schema.garantiaChamado.id, out.id));
  });

  describe("acionarGarantia usecase end-to-end integration", () => {
    let acionarGarantiaUseCase: typeof import("@/operacao/garantia/acionar-garantia").acionarGarantia;
    let ForaDoPrazoErrorClass: typeof import("@/operacao/garantia/acionar-garantia").ForaDoPrazoError;

    beforeAll(async () => {
      const mod = await import("@/operacao/garantia/acionar-garantia");
      acionarGarantiaUseCase = mod.acionarGarantia;
      ForaDoPrazoErrorClass = mod.ForaDoPrazoError;
    });

    it("fluxo portal lança ForaDoPrazoError se OS fora do prazo", async () => {
      const { sol, r } = await seedClienteESolicitacao();
      const [os] = await dbRaw
        .insert(schema.ordemServico)
        .values({
          solicitacaoId: sol.id,
          tipo: "NORMAL",
          estado: "PAGA",
          categoria: "ELETRICA",
          prazoGarantiaMeses: 3,
        })
        .returning();
      osIds.push(os.id);

      const dataPagamento = new Date("2026-01-01T12:00:00Z"); // Fora do prazo agora em junho de 2026
      await dbRaw.insert(schema.pagamento).values({
        paymentId: `pay-${r}`,
        osId: os.id,
        valor: "100.00",
        metodo: "PIX",
        status: "approved",
        criadoEm: dataPagamento,
      });
      pagamentoIds.push({ paymentId: `pay-${r}`, osId: os.id });

      const fakeUpload = vi.fn().mockResolvedValue("fotos/chamados/foto.jpg");
      const agora = new Date("2026-06-03T12:00:00Z");

      await expect(
        acionarGarantiaUseCase(
          {
            osId: os.id,
            descricao: "Problema elétrico na fiação com mais de 20 caracteres",
            fotoDataUrl: "data:image/png;base64,...",
            criadoPor: "cliente@dbg.test",
            canal: "PORTAL",
          },
          { repo, uploadFoto: fakeUpload, agora },
        ),
      ).rejects.toThrow(ForaDoPrazoErrorClass);
    });

    it("fluxo whatsapp permite fora do prazo mas marca acionamentoInvalido=true", async () => {
      const { sol, r } = await seedClienteESolicitacao();
      const [os] = await dbRaw
        .insert(schema.ordemServico)
        .values({
          solicitacaoId: sol.id,
          tipo: "NORMAL",
          estado: "PAGA",
          categoria: "ELETRICA",
          prazoGarantiaMeses: 3,
        })
        .returning();
      osIds.push(os.id);

      const dataPagamento = new Date("2026-01-01T12:00:00Z"); // Fora do prazo
      await dbRaw.insert(schema.pagamento).values({
        paymentId: `pay-${r}`,
        osId: os.id,
        valor: "100.00",
        metodo: "PIX",
        status: "approved",
        criadoEm: dataPagamento,
      });
      pagamentoIds.push({ paymentId: `pay-${r}`, osId: os.id });

      const fakeUpload = vi.fn().mockResolvedValue("fotos/chamados/foto.jpg");
      const agora = new Date("2026-06-03T12:00:00Z");

      const out = await acionarGarantiaUseCase(
        {
          osId: os.id,
          descricao: "Problema elétrico na fiação com mais de 20 caracteres",
          fotoDataUrl: "data:image/png;base64,...",
          criadoPor: "membro@dbg.test",
          canal: "WHATSAPP",
        },
        { repo, uploadFoto: fakeUpload, agora },
      );

      expect(out.chamadoId).toBeDefined();

      const { eq } = await import("drizzle-orm");
      const [chamado] = await dbRaw
        .select()
        .from(schema.garantiaChamado)
        .where(eq(schema.garantiaChamado.id, out.chamadoId))
        .limit(1);

      expect(chamado.acionamentoInvalido).toBe(true);
      expect(chamado.canal).toBe("WHATSAPP");

      // Cleanup
      await dbRaw.delete(schema.garantiaChamado).where(eq(schema.garantiaChamado.id, out.chamadoId));
    });

    it("regarantia dentro do prazo original é aceito", async () => {
      const { sol, r } = await seedClienteESolicitacao();
      const [pai] = await dbRaw
        .insert(schema.ordemServico)
        .values({
          solicitacaoId: sol.id,
          tipo: "NORMAL",
          estado: "PAGA",
          categoria: "ELETRICA",
          prazoGarantiaMeses: 6,
        })
        .returning();
      osIds.push(pai.id);

      const dataPagamento = new Date("2026-03-01T10:00:00Z"); // Prazo expira 2026-09-01
      await dbRaw.insert(schema.pagamento).values({
        paymentId: `pay-pai-${r}`,
        osId: pai.id,
        valor: "150.00",
        metodo: "PIX",
        status: "approved",
        criadoEm: dataPagamento,
      });
      pagamentoIds.push({ paymentId: `pay-pai-${r}`, osId: pai.id });

      const [filha] = await dbRaw
        .insert(schema.ordemServico)
        .values({
          solicitacaoId: sol.id,
          osPaiId: pai.id,
          tipo: "GARANTIA",
          estado: "CONCLUIDA",
          categoria: "ELETRICA",
          prazoGarantiaMeses: 0,
        })
        .returning();
      osIds.push(filha.id);

      const fakeUpload = vi.fn().mockResolvedValue("fotos/chamados/foto.jpg");
      const agora = new Date("2026-06-03T12:00:00Z"); // Dentro do prazo original

      const out = await acionarGarantiaUseCase(
        {
          osId: filha.id,
          descricao: "Problema recorrente no chuveiro com mais de 20 caracteres",
          fotoDataUrl: "data:image/png;base64,...",
          criadoPor: "cliente@dbg.test",
          canal: "PORTAL",
        },
        { repo, uploadFoto: fakeUpload, agora },
      );

      expect(out.chamadoId).toBeDefined();

      const { eq } = await import("drizzle-orm");
      const [chamado] = await dbRaw
        .select()
        .from(schema.garantiaChamado)
        .where(eq(schema.garantiaChamado.id, out.chamadoId))
        .limit(1);

      expect(chamado.acionamentoInvalido).toBe(false);
      expect(chamado.temComplementarRejeitado).toBe(false);

      // Cleanup
      await dbRaw.delete(schema.garantiaChamado).where(eq(schema.garantiaChamado.id, out.chamadoId));
    });
  });

  describe("carregarGarantiasParaOsIds", () => {
    it("carrega corretamente o mapa de garantias para múltiplos IDs de OS", async () => {
      const { sol, r } = await seedClienteESolicitacao();
      const [os1] = await dbRaw
        .insert(schema.ordemServico)
        .values({
          solicitacaoId: sol.id,
          tipo: "NORMAL",
          estado: "CONCLUIDA",
          categoria: "ELETRICA",
          prazoGarantiaMeses: 3,
        })
        .returning();
      osIds.push(os1.id);

      const [os2] = await dbRaw
        .insert(schema.ordemServico)
        .values({
          solicitacaoId: sol.id,
          tipo: "NORMAL",
          estado: "AGENDADA",
          categoria: "ELETRICA",
          prazoGarantiaMeses: 3,
        })
        .returning();
      osIds.push(os2.id);

      // os1 paga para estar dentro da garantia
      await dbRaw.insert(schema.pagamento).values({
        osId: os1.id,
        paymentId: `pay1-${r}`,
        valor: "100.00",
        metodo: "PIX",
        status: "approved",
        criadoEm: new Date(),
      });
      pagamentoIds.push({ paymentId: `pay1-${r}`, osId: os1.id });

      const res = await repo.carregarGarantiasParaOsIds([os1.id, os2.id]);

      expect(res.size).toBe(2);
      expect(res.get(os1.id)?.podeAcionar).toBe(true);
      expect(res.get(os2.id)?.podeAcionar).toBe(false);
    });

    it("carrega corretamente e resolve recursivamente para múltiplos níveis de OS tipo GARANTIA", async () => {
      const { sol, r } = await seedClienteESolicitacao();
      const [osPai] = await dbRaw
        .insert(schema.ordemServico)
        .values({
          solicitacaoId: sol.id,
          tipo: "NORMAL",
          estado: "PAGA",
          categoria: "ELETRICA",
          prazoGarantiaMeses: 6,
        })
        .returning();
      osIds.push(osPai.id);

      const [osFilha] = await dbRaw
        .insert(schema.ordemServico)
        .values({
          solicitacaoId: sol.id,
          osPaiId: osPai.id,
          tipo: "GARANTIA",
          estado: "CONCLUIDA",
          categoria: "ELETRICA",
          prazoGarantiaMeses: 0,
        })
        .returning();
      osIds.push(osFilha.id);

      const [osNeta] = await dbRaw
        .insert(schema.ordemServico)
        .values({
          solicitacaoId: sol.id,
          osPaiId: osFilha.id,
          tipo: "GARANTIA",
          estado: "CONCLUIDA",
          categoria: "ELETRICA",
          prazoGarantiaMeses: 0,
        })
        .returning();
      osIds.push(osNeta.id);

      const dataPagamento = new Date();
      await dbRaw.insert(schema.pagamento).values({
        osId: osPai.id,
        paymentId: `pay-rec-${r}`,
        valor: "120.00",
        metodo: "PIX",
        status: "approved",
        criadoEm: dataPagamento,
      });
      pagamentoIds.push({ paymentId: `pay-rec-${r}`, osId: osPai.id });

      const res = await repo.carregarGarantiasParaOsIds([osNeta.id]);

      expect(res.size).toBe(1);
      expect(res.get(osNeta.id)?.podeAcionar).toBe(true);
      expect(res.get(osNeta.id)?.fim).toBeDefined();
    });
  });
});
