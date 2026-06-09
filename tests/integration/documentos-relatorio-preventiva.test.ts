import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { gerarDocumentosOs } from "@/documentos/gerar-documentos-os";
import { chaveRelatorio } from "@/documentos/chaves";
import type { ArmazenamentoPdf } from "@/documentos/pdf/salvar-pdf-r2";
import type { EmailService, EnviarEmailInput } from "@/notificacao/email-service";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

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

describe.skipIf(!hasDb)("gerarDocumentosOs — relatório de preventiva (#60)", () => {
  let db: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  const osIds: string[] = [];
  const solIds: string[] = [];
  const cliIds: string[] = [];

  beforeAll(async () => {
    db = (await import("@/db/client")).db;
    schema = await import("@/db/schema");
  });

  afterEach(async () => {
    const { inArray } = await import("drizzle-orm");
    if (osIds.length) {
      await db
        .delete(schema.osChecklistResultado)
        .where(inArray(schema.osChecklistResultado.osId, osIds));
      await db
        .delete(schema.ordemServico)
        .where(inArray(schema.ordemServico.id, osIds));
      osIds.length = 0;
    }
    if (solIds.length) {
      await db
        .delete(schema.solicitacao)
        .where(inArray(schema.solicitacao.id, solIds));
      solIds.length = 0;
    }
    if (cliIds.length) {
      await db.delete(schema.cliente).where(inArray(schema.cliente.id, cliIds));
      cliIds.length = 0;
    }
  });

  async function seedPreventivaConcluida(opts: { email?: string | null } = {}) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await db
      .insert(schema.cliente)
      .values({
        nome: `Cli ${r}`,
        whatsapp: `1199${r}`,
        email: opts.email === undefined ? `cli-${r}@dbg.test` : opts.email,
        endereco: { logradouro: "Rua A", numero: "1", cidade: "SP", uf: "SP" },
      })
      .returning();
    cliIds.push(cli.id);

    const [sol] = await db
      .insert(schema.solicitacao)
      .values({
        token: r,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        endereco: { logradouro: "Rua A", numero: "1", cidade: "SP", uf: "SP" },
        origem: "PREVENTIVA",
      })
      .returning();
    solIds.push(sol.id);

    const [os] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        tipo: "PREVENTIVA",
        estado: "CONCLUIDA",
        categoria: "ELETRICA",
        agendadoPara: new Date("2026-06-08T00:00:00Z"),
        metadados: { notaServico: "Tudo inspecionado." },
      })
      .returning();
    osIds.push(os.id);

    await db.insert(schema.osChecklistResultado).values([
      {
        osId: os.id,
        itemId: randomUUID(),
        descricaoSnapshot: "Quadro de disjuntores",
        status: "OK",
        fotoUrl: "https://r2/quadro.jpg",
      },
      {
        osId: os.id,
        itemId: randomUUID(),
        descricaoSnapshot: "Tomada da cozinha",
        status: "PROBLEMA",
        observacao: "Sem aterramento",
        fotoUrl: "https://r2/tomada.jpg",
      },
    ]);

    return os.id;
  }

  it("gera o relatório no R2 e envia por e-mail ao concluir a preventiva", async () => {
    const osId = await seedPreventivaConcluida();
    const armazenamento = fakeArmazenamento();
    const email = fakeEmail();

    const res = await gerarDocumentosOs(osId, "CONCLUIDA", {
      armazenamento,
      email,
    });

    expect(res.relatorio?.chave).toBe(chaveRelatorio(osId));
    expect(armazenamento.objetos.has(chaveRelatorio(osId))).toBe(true);
    expect(res.email).toBe("sent");
    expect(email.chamadas).toHaveLength(1);
    expect(email.chamadas[0].anexos?.[0].filename).toContain("relatorio");
  });

  it("cliente sem e-mail: salva o relatório mesmo assim, só pula o envio", async () => {
    const osId = await seedPreventivaConcluida({ email: null });
    const armazenamento = fakeArmazenamento();
    const email = fakeEmail();

    const res = await gerarDocumentosOs(osId, "CONCLUIDA", {
      armazenamento,
      email,
    });

    expect(armazenamento.objetos.has(chaveRelatorio(osId))).toBe(true);
    expect(res.email).toBe("skipped");
    expect(email.chamadas).toHaveLength(0);
  });
});
