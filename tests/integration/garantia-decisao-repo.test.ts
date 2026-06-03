import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db as dbRaw } from "@/db/client";
import * as schema from "@/db/schema";
import { criarGarantiaDecisaoRepoDrizzle } from "@/operacao/garantia/garantia-decisao-repo-drizzle";
import { eq, inArray, and } from "drizzle-orm";

loadEnv({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Garantia Decisao Repo Drizzle Integration", () => {
  let repo: ReturnType<typeof criarGarantiaDecisaoRepoDrizzle>;

  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let osIds: string[] = [];
  let pagamentoIds: { paymentId: string; osId: string }[] = [];
  let membroIds: string[] = [];
  let chamadosCriados: string[] = [];

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

  async function seedMembro(ativo: boolean, isTecnico: boolean, especialidades: string[]) {
    const r = Math.random().toString(36).slice(2, 10);
    const [m] = await dbRaw
      .insert(schema.membro)
      .values({
        nome: `Tecnico ${r}`,
        email: `tec-${r}@dbg.test`,
        modulos: ["GARANTIAS"],
        isTecnico,
        especialidades: especialidades as any,
        ativo,
      })
      .returning();
    membroIds.push(m.id);
    return m;
  }

  beforeAll(() => {
    repo = criarGarantiaDecisaoRepoDrizzle(dbRaw);
  });

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
    osIds = [];
    pagamentoIds = [];
    membroIds = [];
    chamadosCriados = [];
  });

  afterAll(async () => {
    if (chamadosCriados.length) {
      await dbRaw.delete(schema.garantiaChamado).where(inArray(schema.garantiaChamado.id, chamadosCriados));
    }
    if (pagamentoIds.length) {
      for (const p of pagamentoIds) {
        await dbRaw
          .delete(schema.pagamento)
          .where(and(eq(schema.pagamento.paymentId, p.paymentId), eq(schema.pagamento.osId, p.osId)));
      }
    }
    if (osIds.length) {
      // Deletar transições das OSs envolvidas
      await dbRaw.delete(schema.transicaoOs).where(inArray(schema.transicaoOs.osId, osIds));
      
      // Deletar OSs
      // Deletar filhas com osPaiId apontando para alguma OS monitorada primeiro
      const childOs = await dbRaw
        .select({ id: schema.ordemServico.id })
        .from(schema.ordemServico)
        .where(inArray(schema.ordemServico.osPaiId, osIds));
      const childOsIds = childOs.map((o) => o.id);
      if (childOsIds.length) {
        await dbRaw.delete(schema.transicaoOs).where(inArray(schema.transicaoOs.osId, childOsIds));
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
    if (membroIds.length) {
      await dbRaw.delete(schema.membro).where(inArray(schema.membro.id, membroIds));
    }
  });

  it("carregarChamado resolve a âncora correta e disponibilidade do técnico original", async () => {
    const tec = await seedMembro(true, true, ["ELETRICA"]);
    const { sol, r } = await seedClienteESolicitacao();
    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        tipo: "NORMAL",
        estado: "PAGA",
        categoria: "ELETRICA",
        tecnicoId: tec.id,
        prazoGarantiaMeses: 3,
      })
      .returning();
    osIds.push(os.id);

    await dbRaw.insert(schema.pagamento).values({
      osId: os.id,
      paymentId: `pay-${r}`,
      valor: "150.00",
      metodo: "PIX",
      status: "approved",
      criadoEm: new Date(),
    });
    pagamentoIds.push({ paymentId: `pay-${r}`, osId: os.id });

    const [chamado] = await dbRaw
      .insert(schema.garantiaChamado)
      .values({
        osOrigemId: os.id,
        descricao: "Chamado longo com mais de 20 caracteres para teste",
        fotoUrl: "http://r2/foto.jpg",
        criadoPor: "cliente@dbg.com",
        canal: "PORTAL",
        status: "pendente",
      })
      .returning();
    chamadosCriados.push(chamado.id);

    const det = await repo.carregarChamado(chamado.id);
    expect(det).not.toBeNull();
    expect(det!.osOrigemId).toBe(os.id);
    expect(det!.ancora.ancoraId).toBe(os.id);
    expect(det!.ancora.prazoMeses).toBe(3);
    expect(det!.tecnicoOriginalId).toBe(tec.id);
    expect(det!.tecnicoOriginalDisponivel).toBe(true);
  });

  it("aplicar cria OS Garantia agendada, transiciona origem para GARANTIA_ABERTA e marca chamado como aplicada", async () => {
    const tec = await seedMembro(true, true, ["ELETRICA"]);
    const { sol, r } = await seedClienteESolicitacao();
    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        tipo: "NORMAL",
        estado: "PAGA",
        categoria: "ELETRICA",
        tecnicoId: tec.id,
        prazoGarantiaMeses: 3,
      })
      .returning();
    osIds.push(os.id);

    await dbRaw.insert(schema.pagamento).values({
      osId: os.id,
      paymentId: `pay-${r}`,
      valor: "250.00",
      metodo: "PIX",
      status: "approved",
      criadoEm: new Date(),
    });
    pagamentoIds.push({ paymentId: `pay-${r}`, osId: os.id });

    const [chamado] = await dbRaw
      .insert(schema.garantiaChamado)
      .values({
        osOrigemId: os.id,
        descricao: "Chamado longo com mais de 20 caracteres para teste",
        fotoUrl: "http://r2/foto.jpg",
        criadoPor: "cliente@dbg.com",
        canal: "PORTAL",
        status: "pendente",
      })
      .returning();
    chamadosCriados.push(chamado.id);

    const { osGarantiaId } = await repo.aplicar({
      chamadoId: chamado.id,
      osOrigemId: os.id,
      categoria: "ELETRICA",
      prazoMeses: 3,
      tecnicoId: tec.id,
      decididoPor: "admin@dbg.com",
      override: null,
    });

    expect(osGarantiaId).toBeDefined();

    // Verifica que OS origem transitou para GARANTIA_ABERTA
    const [osOrigemAtualizada] = await dbRaw
      .select()
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, os.id))
      .limit(1);
    expect(osOrigemAtualizada.estado).toBe("GARANTIA_ABERTA");

    // Verifica que existe registro de transição
    const trans = await dbRaw
      .select()
      .from(schema.transicaoOs)
      .where(and(eq(schema.transicaoOs.osId, os.id), eq(schema.transicaoOs.estadoNovo, "GARANTIA_ABERTA")));
    expect(trans.length).toBe(1);
    expect(trans[0].atorEmail).toBe("admin@dbg.com");

    // Verifica que a OS Garantia foi criada em AGENDADA
    const [osGarantia] = await dbRaw
      .select()
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osGarantiaId))
      .limit(1);
    expect(osGarantia).toBeDefined();
    expect(osGarantia.tipo).toBe("GARANTIA");
    expect(osGarantia.estado).toBe("AGENDADA");
    expect(osGarantia.osPaiId).toBe(os.id);
    expect(osGarantia.tecnicoId).toBe(tec.id);

    // Verifica que o chamado foi atualizado
    const [chamadoAtualizado] = await dbRaw
      .select()
      .from(schema.garantiaChamado)
      .where(eq(schema.garantiaChamado.id, chamado.id))
      .limit(1);
    expect(chamadoAtualizado.status).toBe("aplicada");
    expect(chamadoAtualizado.osGarantiaId).toBe(osGarantiaId);
    expect(chamadoAtualizado.decididoPor).toBe("admin@dbg.com");
    expect(chamadoAtualizado.overridePrazo).toBe(false);
  });

  it("rejeitar marca chamado como rejeitada com motivo e não afeta OS", async () => {
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

    const [chamado] = await dbRaw
      .insert(schema.garantiaChamado)
      .values({
        osOrigemId: os.id,
        descricao: "Chamado longo com mais de 20 caracteres para teste",
        fotoUrl: "http://r2/foto.jpg",
        criadoPor: "cliente@dbg.com",
        canal: "PORTAL",
        status: "pendente",
      })
      .returning();
    chamadosCriados.push(chamado.id);

    await repo.rejeitar(chamado.id, "Defeito de material comprado pelo cliente", "admin@dbg.com");

    const [chamadoAtualizado] = await dbRaw
      .select()
      .from(schema.garantiaChamado)
      .where(eq(schema.garantiaChamado.id, chamado.id))
      .limit(1);
    expect(chamadoAtualizado.status).toBe("rejeitada");
    expect(chamadoAtualizado.motivoRejeicao).toBe("Defeito de material comprado pelo cliente");
    expect(chamadoAtualizado.decididoPor).toBe("admin@dbg.com");

    const [osAtualizada] = await dbRaw
      .select()
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, os.id))
      .limit(1);
    expect(osAtualizada.estado).toBe("PAGA");
  });
});
