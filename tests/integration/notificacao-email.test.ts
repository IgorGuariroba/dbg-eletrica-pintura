import { config } from "dotenv";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { gerarPdfOrcamento, gerarPdfConclusao } from "@/notificacao/pdf-gerador";
import { enviarPdfDocumento, obterUrlLeituraAssinada } from "@/operacao/r2-privado";
import { renderizarEmailOrcamento, renderizarEmailConclusao, criarEmailService } from "@/notificacao/email-service";
import { notificarMudancaEstadoOs } from "@/notificacao/notificador";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);
const hasR2 = Boolean(
  process.env.R2_PRIVATE_ACCOUNT_ID &&
  process.env.R2_PRIVATE_ACCESS_KEY_ID &&
  process.env.R2_PRIVATE_SECRET_ACCESS_KEY &&
  process.env.R2_PRIVATE_BUCKET
);

describe.skipIf(!hasDb || !hasR2)("Notificação E-mail & PDF Integration (Slice 1, 2 & 3)", () => {
  let dbRaw: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let clienteIds: string[] = [];
  let solicitacaoIds: string[] = [];
  let membroIds: string[] = [];
  let servicoIds: string[] = [];
  let orcamentoIds: string[] = [];

  const dadosOrcamentoMock = {
    numeroOS: "OS-1234",
    clienteNome: "José da Silva",
    clienteWhatsapp: "11999998888",
    endereco: "Rua das Flores, 123 - Centro, São Paulo - SP",
    tecnicoNome: "Diego Técnico",
    validade: "06/06/2026",
    itens: [
      { descricao: "Instalação de Tomada", quantidade: "2.00", precoUnitario: "50.00", subtotal: "100.00" },
      { descricao: "Fiação Elétrica Chuveiro", quantidade: "1.00", precoUnitario: "150.00", subtotal: "150.00" }
    ],
    totalMaoDeObra: "250.00",
    totalDeslocamento: "30.00",
    total: "280.00"
  };

  const dadosConclusaoMock = {
    numeroOS: "OS-1234",
    clienteNome: "José da Silva",
    clienteWhatsapp: "11999998888",
    endereco: "Rua das Flores, 123 - Centro, São Paulo - SP",
    tecnicoNome: "Diego Técnico",
    concluidoEm: "30/05/2026 18:00",
    observacoes: "Instalações concluídas com sucesso. Fiação revisada e disjuntor testado.",
    materiais: [
      { item: "Tomada 20A", quantidade: 2 },
      { item: "Cabo Flexível 6mm", quantidade: 10 }
    ],
    assinaturaUrl: "assinaturas/os/test/assinatura-mock.png",
    fotosAntes: [],
    fotosDepois: []
  };

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    schema = await import("@/db/schema");
    dbRaw = dbMod.db;
  });

  beforeEach(() => {
    clienteIds = [];
    solicitacaoIds = [];
    membroIds = [];
    servicoIds = [];
    orcamentoIds = [];
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (orcamentoIds.length) {
      await dbRaw
        .delete(schema.orcamentoItem)
        .where(inArray(schema.orcamentoItem.orcamentoId, orcamentoIds));
      await dbRaw
        .delete(schema.orcamento)
        .where(inArray(schema.orcamento.id, orcamentoIds));
    }
    if (solicitacaoIds.length) {
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
    if (servicoIds.length) {
      await dbRaw
        .delete(schema.servico)
        .where(inArray(schema.servico.id, servicoIds));
    }
  });

  async function seedTecnico() {
    const r = Math.random().toString(36).slice(2, 10);
    const [m] = await dbRaw
      .insert(schema.membro)
      .values({
        nome: `Tec Teste ${r}`,
        email: `tec-${r}@dbg.test`,
        isTecnico: true,
        especialidades: ["ELETRICA"],
      })
      .returning();
    membroIds.push(m.id);
    return m;
  }

  async function seedServico() {
    const [s] = await dbRaw
      .insert(schema.servico)
      .values({
        nome: "Instalação Elétrica Teste",
        categoria: "ELETRICA",
        precoBase: "100.00",
        unidade: "HORA"
      })
      .returning();
    servicoIds.push(s.id);
    return s;
  }

  async function seedCliente(comEmail: boolean = true) {
    const r = Math.random().toString(36).slice(2, 10);
    const [c] = await dbRaw
      .insert(schema.cliente)
      .values({
        nome: `Cliente Teste ${r}`,
        whatsapp: `119${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: comEmail ? `cliente-${r}@dbg.test` : null,
        endereco: { logradouro: "Rua Teste", cidade: "São Paulo", uf: "SP" }
      })
      .returning();
    clienteIds.push(c.id);
    return c;
  }

  async function seedSolicitacaoEOs(clienteId: string, tecnicoId: string, estado: "NOVA" | "EM_EXECUCAO" = "NOVA") {
    const r = Math.random().toString(36).slice(2, 10);
    const [sol] = await dbRaw
      .insert(schema.solicitacao)
      .values({
        token: `tok-test-${r}`,
        clienteId,
        categorias: ["ELETRICA"],
        descricao: "Serviço de teste para e-mail",
        endereco: { logradouro: "Rua Teste", cidade: "São Paulo", uf: "SP" }
      })
      .returning();
    solicitacaoIds.push(sol.id);

    const [os] = await dbRaw
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "ELETRICA",
        tipo: "NORMAL",
        estado,
        tecnicoId
      })
      .returning();

    return { sol, os };
  }

  async function seedOrcamento(osId: string, servicoId: string) {
    const [orc] = await dbRaw
      .insert(schema.orcamento)
      .values({
        osId,
        tokenAprovacao: Math.random().toString(36).slice(2, 18),
        totalMaterial: "0.00",
        totalMaoDeObra: "100.00",
        totalDeslocamento: "20.00",
        total: "120.00",
        validoAte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      })
      .returning();
    orcamentoIds.push(orc.id);

    await dbRaw
      .insert(schema.orcamentoItem)
      .values({
        orcamentoId: orc.id,
        servicoId,
        quantidade: "1.00",
        precoUnitario: "100.00",
        subtotal: "100.00"
      });

    return orc;
  }

  // --- SLICE 1: PDF e R2 ---
  it("deve gerar o PDF de Orçamento em Buffer", async () => {
    const buffer = await gerarPdfOrcamento(dadosOrcamentoMock);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("deve gerar o PDF de Conclusão em Buffer", async () => {
    const buffer = await gerarPdfConclusao(dadosConclusaoMock);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("deve enviar o PDF gerado para o R2 privado e retornar uma URL assinada válida", async () => {
    const buffer = await gerarPdfOrcamento(dadosOrcamentoMock);
    const key = `test/orcamentos/test-orcamento-${Date.now()}.pdf`;

    await expect(enviarPdfDocumento(key, buffer)).resolves.not.toThrow();

    const url = await obterUrlLeituraAssinada(key);
    expect(url).toContain("https://");
    expect(url).toContain("dbg-private");
    expect(url).toContain("Expires=604800");
  });

  // --- SLICE 2: React Email & Resend ---
  it("deve renderizar o template HTML de e-mail de Orçamento Pronto", async () => {
    const html = await renderizarEmailOrcamento({
      clienteNome: "José da Silva",
      numeroOS: "OS-1234",
      total: "280.00",
      urlPortal: "http://localhost:3000/s/tok-123"
    });

    expect(html).toContain("José da Silva");
    expect(html).toContain("OS-1234");
    expect(html).toContain("280.00");
    expect(html).toContain("http://localhost:3000/s/tok-123");
    expect(html).toContain("<!DOCTYPE html");
  });

  it("deve renderizar o template HTML de e-mail de OS Concluída", async () => {
    const html = await renderizarEmailConclusao({
      clienteNome: "José da Silva",
      numeroOS: "OS-1234",
      urlPortal: "http://localhost:3000/s/tok-123"
    });

    expect(html).toContain("José da Silva");
    expect(html).toContain("OS-1234");
    expect(html).toContain("http://localhost:3000/s/tok-123");
    expect(html).toContain("<!DOCTYPE html");
  });

  it("deve enviar e-mail mockado com sucesso via EmailService", async () => {
    const emailService = criarEmailService({ forceMock: true });
    
    const res = await emailService.enviar({
      para: "cliente@exemplo.com",
      assunto: "Seu Orçamento Pronto",
      html: "<p>Olá Cliente</p>",
      anexos: [
        { filename: "orcamento.pdf", content: Buffer.from("pdf-data") }
      ]
    });

    expect(res).not.toBeNull();
    expect(res?.id).toBeDefined();
    expect(res?.id).toContain("mock-id-");
  });

  // --- SLICE 3: Notificador e Integração de Eventos ---
  it("deve pular envio (skipped) se o cliente não possuir e-mail", async () => {
    const tecnico = await seedTecnico();
    const cliente = await seedCliente(false); // Sem e-mail
    const { os } = await seedSolicitacaoEOs(cliente.id, tecnico.id, "NOVA");

    const resultado = await notificarMudancaEstadoOs(os.id, "ORCADA", { forceMock: true });
    
    expect(resultado.status).toBe("skipped");
    expect(resultado.motivo).toContain("sem e-mail");
  });

  it("deve gerar o PDF, salvar no R2 e enviar e-mail com sucesso para transição para ORCADA", async () => {
    const tecnico = await seedTecnico();
    const cliente = await seedCliente(true); // Com e-mail
    const { os } = await seedSolicitacaoEOs(cliente.id, tecnico.id, "NOVA");
    const servico = await seedServico();
    await seedOrcamento(os.id, servico.id);

    const resultado = await notificarMudancaEstadoOs(os.id, "ORCADA", { forceMock: true });

    expect(resultado.status).toBe("sent");
    expect(resultado.emailId).toBeDefined();
    expect(resultado.pdfUrl).toContain("https://");
    expect(resultado.pdfUrl).toContain("orcamentos");
  });

  it("deve gerar o PDF, salvar no R2 e enviar e-mail com sucesso para transição para CONCLUIDA", async () => {
    const tecnico = await seedTecnico();
    const cliente = await seedCliente(true); // Com e-mail
    const { os } = await seedSolicitacaoEOs(cliente.id, tecnico.id, "EM_EXECUCAO");

    const resultado = await notificarMudancaEstadoOs(os.id, "CONCLUIDA", { forceMock: true });

    expect(resultado.status).toBe("sent");
    expect(resultado.emailId).toBeDefined();
    expect(resultado.pdfUrl).toContain("https://");
    expect(resultado.pdfUrl).toContain("conclusoes");
  });

  it("deve incluir as fotos antes/depois (semeadas no R2) no PDF de conclusão", async () => {
    const { uploadFotoOsR2 } = await import("@/operacao/r2-privado");
    const tecnico = await seedTecnico();
    const cliente = await seedCliente(true);
    const { os } = await seedSolicitacaoEOs(cliente.id, tecnico.id, "EM_EXECUCAO");

    // 4 PNGs 1x1 DISTINTOS — o React PDF deduplica imagens idênticas em um único
    // XObject, então cores diferentes garantem 4 imagens embarcadas separadas.
    const pngs = [
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGM4YaMBAAL8AS3/gzpXAAAAAElFTkSuQmCC",
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPQWHAHAAKYAaUEIMPZAAAAAElFTkSuQmCC",
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOw2VIBAAKYAWnbe4IKAAAAAElFTkSuQmCC",
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPYUqEBAAM4AVUprF78AAAAAElFTkSuQmCC",
    ];
    const up = uploadFotoOsR2();
    await up.enviarFoto({ osId: os.id, tipo: "ANTES", dataUrl: pngs[0] });
    await up.enviarFoto({ osId: os.id, tipo: "ANTES", dataUrl: pngs[1] });
    await up.enviarFoto({ osId: os.id, tipo: "DEPOIS", dataUrl: pngs[2] });
    await up.enviarFoto({ osId: os.id, tipo: "DEPOIS", dataUrl: pngs[3] });

    const resultado = await notificarMudancaEstadoOs(os.id, "CONCLUIDA", { forceMock: true });
    expect(resultado.status).toBe("sent");
    expect(resultado.pdfUrl).toBeDefined();

    // Baixa o PDF persistido no R2 e confere que as 4 fotos foram embarcadas
    const resp = await fetch(resultado.pdfUrl!);
    const pdfBuf = Buffer.from(await resp.arrayBuffer());
    const imagens = (pdfBuf.toString("latin1").match(/\/Subtype\s*\/Image/g) || []).length;
    expect(imagens).toBeGreaterThanOrEqual(4);
  }, 30000); // render busca 4 imagens do R2 por rede + baixa o PDF
});
