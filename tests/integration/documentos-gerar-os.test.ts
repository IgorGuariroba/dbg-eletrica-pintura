import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { gerarDocumentosOs } from "@/documentos/gerar-documentos-os";
import type { ArmazenamentoPdf } from "@/documentos/pdf/salvar-pdf-r2";
import type { EmailService, EnviarEmailInput } from "@/notificacao/email-service";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

/** Armazenamento em memória: registra chaves e buffers, sem tocar o R2. */
function fakeArmazenamento(): ArmazenamentoPdf & { objetos: Map<string, Buffer> } {
  const objetos = new Map<string, Buffer>();
  return {
    objetos,
    async enviar(chave, corpo) {
      objetos.set(chave, corpo);
    },
    async urlAssinada(chave) {
      return `https://fake.r2/${chave}`;
    },
  };
}

/** E-mail falso: registra os envios, sem tocar Resend. */
function fakeEmail(): EmailService & { chamadas: EnviarEmailInput[] } {
  const chamadas: EnviarEmailInput[] = [];
  return {
    chamadas,
    async enviar(input) {
      chamadas.push(input);
      return { id: `email-${chamadas.length}` };
    },
  };
}

describe.skipIf(!hasDb)("gerarDocumentosOs (#48)", () => {
  let db: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  const osIds: string[] = [];
  const solIds: string[] = [];
  const cliIds: string[] = [];
  const tecIds: string[] = [];
  const servIds: string[] = [];

  beforeAll(async () => {
    db = (await import("@/db/client")).db;
    schema = await import("@/db/schema");
  });

  afterEach(async () => {
    const { inArray } = await import("drizzle-orm");
    if (osIds.length) {
      await db.delete(schema.pagamento).where(inArray(schema.pagamento.osId, osIds));
      await db.delete(schema.orcamentoItem).where(
        inArray(
          schema.orcamentoItem.orcamentoId,
          db.select({ id: schema.orcamento.id }).from(schema.orcamento).where(inArray(schema.orcamento.osId, osIds)),
        ),
      );
      await db.delete(schema.orcamento).where(inArray(schema.orcamento.osId, osIds));
      await db.delete(schema.ordemServico).where(inArray(schema.ordemServico.id, osIds));
      osIds.length = 0;
    }
    if (solIds.length) {
      await db.delete(schema.solicitacao).where(inArray(schema.solicitacao.id, solIds));
      solIds.length = 0;
    }
    if (servIds.length) {
      await db.delete(schema.servico).where(inArray(schema.servico.id, servIds));
      servIds.length = 0;
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

  async function seedOsPaga(opts: { email?: string | null; pagamentoEm?: Date; prazo?: number | null } = {}) {
    const r = Math.random().toString(36).slice(2, 10);
    const [tec] = await db
      .insert(schema.membro)
      .values({ nome: `Tec ${r}`, email: `tec-${r}@dbg.test`, isTecnico: true })
      .returning();
    tecIds.push(tec.id);

    const [serv] = await db
      .insert(schema.servico)
      .values({ nome: "Instalação Elétrica", categoria: "ELETRICA", precoBase: "100.00", unidade: "HORA" })
      .returning();
    servIds.push(serv.id);

    const [cli] = await db
      .insert(schema.cliente)
      .values({
        nome: `Cliente ${r}`,
        whatsapp: `1199${Math.floor(1000000 + Math.random() * 8999999)}`,
        email: opts.email === undefined ? `cli-${r}@dbg.test` : opts.email,
        endereco: { logradouro: "Rua Teste", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    cliIds.push(cli.id);

    const [sol] = await db
      .insert(schema.solicitacao)
      .values({
        token: `tok-${r}`,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        endereco: { logradouro: "Rua Teste", numero: "100", bairro: "Centro", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    solIds.push(sol.id);

    const [os] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "ELETRICA",
        tipo: "NORMAL",
        estado: "CONCLUIDA",
        tecnicoId: tec.id,
        prazoGarantiaMeses: opts.prazo === undefined ? 12 : opts.prazo,
      })
      .returning();
    osIds.push(os.id);

    const [orc] = await db
      .insert(schema.orcamento)
      .values({
        osId: os.id,
        tokenAprovacao: `apr-${r}`,
        totalMaoDeObra: "100.00",
        totalDeslocamento: "20.00",
        total: "120.00",
        validoAte: new Date(),
      })
      .returning();
    await db.insert(schema.orcamentoItem).values({
      orcamentoId: orc.id,
      servicoId: serv.id,
      quantidade: "1.00",
      precoUnitario: "100.00",
      subtotal: "100.00",
    });

    await db.insert(schema.pagamento).values({
      paymentId: `manual-${r}`,
      osId: os.id,
      valor: "120.00",
      metodo: "PIX_DIRETO",
      status: "approved",
      criadoEm: opts.pagamentoEm ?? new Date(),
    });

    return { os, cli, sol, serv };
  }

  /** Cria uma OS filha (sem pagamento próprio) com orçamento/itens. */
  async function seedOsFilha(opts: {
    solId: string;
    tecnicoId: string;
    servId: string;
    tipo: "GARANTIA" | "PREVENTIVA";
    osPaiId?: string;
  }) {
    const r = Math.random().toString(36).slice(2, 10);
    const [os] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: opts.solId,
        categoria: "ELETRICA",
        tipo: opts.tipo,
        estado: "CONCLUIDA",
        tecnicoId: opts.tecnicoId,
        osPaiId: opts.osPaiId,
      })
      .returning();
    osIds.push(os.id);

    const [orc] = await db
      .insert(schema.orcamento)
      .values({
        osId: os.id,
        tokenAprovacao: `apr-${r}`,
        total: "0.00",
        validoAte: new Date(),
      })
      .returning();
    await db.insert(schema.orcamentoItem).values({
      orcamentoId: orc.id,
      servicoId: opts.servId,
      quantidade: "1.00",
      precoUnitario: "0.00",
      subtotal: "0.00",
    });

    return os;
  }

  it("no PAGA, salva fatura e certificado no R2 com chaves determinísticas e envia e-mail com 2 anexos", async () => {
    const { os, cli } = await seedOsPaga();
    const arm = fakeArmazenamento();
    const email = fakeEmail();

    const res = await gerarDocumentosOs(os.id, "PAGA", { armazenamento: arm, email });

    expect(arm.objetos.has(`fatura/os/${os.id}.pdf`)).toBe(true);
    expect(arm.objetos.has(`garantia/os/${os.id}.pdf`)).toBe(true);
    expect(arm.objetos.get(`fatura/os/${os.id}.pdf`)!.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    expect(res.fatura?.chave).toBe(`fatura/os/${os.id}.pdf`);
    expect(res.certificado?.chave).toBe(`garantia/os/${os.id}.pdf`);
    expect(res.email).toBe("sent");

    expect(email.chamadas).toHaveLength(1);
    expect(email.chamadas[0].para).toBe(cli.email);
    expect(email.chamadas[0].anexos).toHaveLength(2);
  });

  it("cliente sem e-mail: pula o envio mas mantém os PDFs no R2", async () => {
    const { os } = await seedOsPaga({ email: null });
    const arm = fakeArmazenamento();
    const email = fakeEmail();

    const res = await gerarDocumentosOs(os.id, "PAGA", { armazenamento: arm, email });

    expect(res.email).toBe("skipped");
    expect(email.chamadas).toHaveLength(0);
    expect(arm.objetos.has(`fatura/os/${os.id}.pdf`)).toBe(true);
    expect(arm.objetos.has(`garantia/os/${os.id}.pdf`)).toBe(true);
  });

  it("falha do certificado não descarta a fatura já gerada nem o e-mail", async () => {
    // OS paga sem prazo de garantia (coluna nullable): certificado não resolve,
    // mas a fatura deve ser entregue mesmo assim.
    const { os, cli } = await seedOsPaga({ prazo: null });
    const arm = fakeArmazenamento();
    const email = fakeEmail();

    const res = await gerarDocumentosOs(os.id, "PAGA", { armazenamento: arm, email });

    expect(res.fatura?.chave).toBe(`fatura/os/${os.id}.pdf`);
    expect(res.certificado).toBeUndefined();
    expect(arm.objetos.has(`fatura/os/${os.id}.pdf`)).toBe(true);
    expect(arm.objetos.has(`garantia/os/${os.id}.pdf`)).toBe(false);
    expect(res.email).toBe("sent");
    expect(email.chamadas).toHaveLength(1);
    expect(email.chamadas[0].para).toBe(cli.email);
    expect(email.chamadas[0].anexos).toHaveLength(1);
  });

  it("regarantia (GARANTIA) no CONCLUIDA gera só certificado, ancorado na OS original", async () => {
    const original = await seedOsPaga({
      pagamentoEm: new Date("2026-06-03T12:00:00Z"),
    });
    const garantia = await seedOsFilha({
      solId: original.sol.id,
      tecnicoId: original.os.tecnicoId!,
      servId: original.serv.id,
      tipo: "GARANTIA",
      osPaiId: original.os.id,
    });
    const arm = fakeArmazenamento();
    const email = fakeEmail();

    const res = await gerarDocumentosOs(garantia.id, "CONCLUIDA", {
      armazenamento: arm,
      email,
    });

    expect(res.fatura).toBeUndefined();
    expect(res.certificado?.chave).toBe(`garantia/os/${garantia.id}.pdf`);
    expect(arm.objetos.has(`fatura/os/${garantia.id}.pdf`)).toBe(false);
    expect(arm.objetos.has(`garantia/os/${garantia.id}.pdf`)).toBe(true);
    expect(email.chamadas[0].anexos).toHaveLength(1);
  });

  it("OS Preventiva não gera certificado nem fatura", async () => {
    const base = await seedOsPaga();
    const preventiva = await seedOsFilha({
      solId: base.sol.id,
      tecnicoId: base.os.tecnicoId!,
      servId: base.serv.id,
      tipo: "PREVENTIVA",
    });
    const arm = fakeArmazenamento();
    const email = fakeEmail();

    const res = await gerarDocumentosOs(preventiva.id, "CONCLUIDA", {
      armazenamento: arm,
      email,
    });

    expect(res.fatura).toBeUndefined();
    expect(res.certificado).toBeUndefined();
    expect(arm.objetos.size).toBe(0);
    expect(email.chamadas).toHaveLength(0);
  });
});
