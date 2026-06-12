import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  transicionarOs,
  type TransicionarResultado,
} from "@/operacao/transicionar-os";
import { TransicaoInvalidaError } from "@/operacao/maquina-estado";
import { OsInexistenteError } from "@/operacao/transicao-repo";
import type { EmailService, EnviarEmailInput } from "@/notificacao/email-service";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);
const AGORA = new Date("2026-06-12T15:00:00-03:00");

function fakeEmail(): EmailService & { enviados: EnviarEmailInput[] } {
  const enviados: EnviarEmailInput[] = [];
  return {
    enviados,
    async enviar(input) {
      enviados.push(input);
      return { id: `mock-trans-${enviados.length}` };
    },
  };
}

/** Adapters de saída inertes: despacho real sem tocar Resend/R2/Meta. */
function depsInertes(email = fakeEmail()) {
  return {
    email,
    whatsapp: { enviarTemplate: async () => ({ messageId: "wamid.X" }) },
    documentos: async () => ({ email: "skipped" as const }),
    agora: AGORA,
  };
}

describe.skipIf(!hasDb)("transicionarOs — validar, persistir, despachar (#163)", () => {
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
    if (osIds.length) {
      await db
        .delete(schema.notificacaoMarco)
        .where(inArray(schema.notificacaoMarco.refId, osIds));
      await db
        .delete(schema.transicaoOs)
        .where(inArray(schema.transicaoOs.osId, osIds));
      await db
        .delete(schema.ordemServico)
        .where(inArray(schema.ordemServico.id, osIds));
      osIds.length = 0;
    }
    if (solIds.length) {
      await db.delete(schema.solicitacao).where(inArray(schema.solicitacao.id, solIds));
      solIds.length = 0;
    }
    if (cliIds.length) {
      await db.delete(schema.cliente).where(inArray(schema.cliente.id, cliIds));
      cliIds.length = 0;
    }
  });

  async function seedOs(opts: {
    tipo: "NORMAL" | "EXPRESS" | "PREVENTIVA";
    estado: string;
  }) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await db
      .insert(schema.cliente)
      .values({
        nome: `Cli Trans ${r}`,
        whatsapp: `55117${r.replace(/\D/g, "2").slice(0, 8)}`,
        email: `trans-${r}@dbg.test`,
        endereco: { logradouro: "Rua T", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    cliIds.push(cli.id);

    const [sol] = await db
      .insert(schema.solicitacao)
      .values({
        token: `tok-trans-${r}`,
        clienteId: cli.id,
        categorias: ["ELETRICA"],
        descricao: "teste transicionarOs",
        endereco: { logradouro: "Rua T", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    solIds.push(sol.id);

    const [os] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId: sol.id,
        categoria: "ELETRICA",
        tipo: opts.tipo,
        estado: opts.estado as never,
      })
      .returning();
    osIds.push(os.id);

    return { os, sol, cli };
  }

  async function estadoDe(osId: string) {
    const [row] = await db
      .select({ estado: schema.ordemServico.estado })
      .from(schema.ordemServico)
      .where(eq(schema.ordemServico.id, osId));
    return row.estado;
  }

  it("valida, persiste (estado + histórico) e despacha o Evento de Notificação", async () => {
    const { os } = await seedOs({ tipo: "NORMAL", estado: "EM_EXECUCAO" });
    const email = fakeEmail();

    const resultado: TransicionarResultado = await transicionarOs(
      os.id,
      "CONCLUIDA",
      "tec@dbg.test",
      null,
      { agora: AGORA, notificarDeps: depsInertes(email) },
    );

    expect(resultado.registro.estadoNovo).toBe("CONCLUIDA");
    expect(await estadoDe(os.id)).toBe("CONCLUIDA");

    const historico = await db
      .select()
      .from(schema.transicaoOs)
      .where(eq(schema.transicaoOs.osId, os.id));
    expect(historico.map((h) => h.estadoNovo)).toContain("CONCLUIDA");

    // Despacho exposto: teste aguarda e vê o e-mail de conclusão pelo fake.
    await resultado.despacho;
    expect(email.enviados.some((e) => e.assunto.includes("Serviço Concluído"))).toBe(true);
  });

  it("falha de notificação não falha a transição (despacho nunca rejeita)", async () => {
    const { os } = await seedOs({ tipo: "NORMAL", estado: "EM_EXECUCAO" });

    const resultado = await transicionarOs(os.id, "CONCLUIDA", "tec@dbg.test", null, {
      agora: AGORA,
      notificarDeps: {
        email: {
          enviar: async () => {
            throw new Error("Resend fora do ar");
          },
        },
        documentos: async () => {
          throw new Error("R2 fora do ar");
        },
        agora: AGORA,
      },
    });

    // Transição persistida apesar do canal quebrado; despacho resolve sem lançar.
    expect(await estadoDe(os.id)).toBe("CONCLUIDA");
    await expect(resultado.despacho).resolves.toBeDefined();
  });

  it("execução imediata: EXPRESS APROVADA → EM_EXECUCAO passa pela máquina", async () => {
    const { os } = await seedOs({ tipo: "EXPRESS", estado: "APROVADA" });

    const resultado = await transicionarOs(os.id, "EM_EXECUCAO", "tec@dbg.test", null, {
      agora: AGORA,
      notificarDeps: depsInertes(),
    });

    expect(resultado.registro.estadoNovo).toBe("EM_EXECUCAO");
    expect(await estadoDe(os.id)).toBe("EM_EXECUCAO");
    await resultado.despacho;
  });

  it("abertura de garantia: NORMAL PAGA → GARANTIA_ABERTA", async () => {
    const { os } = await seedOs({ tipo: "NORMAL", estado: "PAGA" });

    const resultado = await transicionarOs(
      os.id,
      "GARANTIA_ABERTA",
      "admin@dbg.test",
      "chamado de garantia",
      { agora: AGORA, notificarDeps: depsInertes() },
    );

    expect(resultado.registro.estadoNovo).toBe("GARANTIA_ABERTA");
    expect(await estadoDe(os.id)).toBe("GARANTIA_ABERTA");
    await resultado.despacho;
  });

  it("bloqueio de PAGA para PREVENTIVA → TransicaoInvalidaError (409)", async () => {
    const { os } = await seedOs({ tipo: "PREVENTIVA", estado: "CONCLUIDA" });

    await expect(
      transicionarOs(os.id, "PAGA", "admin@dbg.test", null, {
        agora: AGORA,
        notificarDeps: depsInertes(),
      }),
    ).rejects.toBeInstanceOf(TransicaoInvalidaError);
    expect(await estadoDe(os.id)).toBe("CONCLUIDA");
  });

  it("OS inexistente → OsInexistenteError (404)", async () => {
    await expect(
      transicionarOs(
        "00000000-0000-4000-8000-000000000000",
        "CONCLUIDA",
        "tec@dbg.test",
        null,
        { agora: AGORA, notificarDeps: depsInertes() },
      ),
    ).rejects.toBeInstanceOf(OsInexistenteError);
  });
});
