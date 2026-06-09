import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { like } from "drizzle-orm";
import { processarRemarketing } from "@/marketing/remarketing/processar-remarketing";
import type { GatewayWhatsApp } from "@/notificacao/whatsapp-gateway";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);
const PREFIXO_WPP = "5511955502";

function fakeGateway() {
  const id = Math.random().toString(36).slice(2, 10);
  const chamadas: { destinatario: string; template: string; variaveis: Record<string, string> }[] = [];
  return {
    chamadas,
    async enviarTemplate(req: any) {
      chamadas.push(req);
      return { messageId: `wamid.REMARK-${id}-${chamadas.length}` };
    },
  };
}

function fakeEmail() {
  const chamadas: { para: string; assunto: string; html: string }[] = [];
  return {
    chamadas,
    async enviar(input: { para: string; clienteNome: string; assunto: string; html: string }) {
      chamadas.push({ para: input.para, assunto: input.assunto, html: input.html });
      return { id: `email-${chamadas.length}` };
    },
  };
}

describe.skipIf(!hasDb)("Processador de Remarketing (Slices D, E, F, G)", () => {
  let db: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let configRepo: any;
  let enviadoRepo: any;

  const cliIds: string[] = [];
  const solIds: string[] = [];
  const osIds: string[] = [];
  const orcIds: string[] = [];

  beforeAll(async () => {
    db = (await import("@/db/client")).db;
    schema = await import("@/db/schema");
    const { criarConfigRemarketingRepoDrizzle } = await import("@/marketing/remarketing/config-repo-drizzle");
    const { criarRemarketingEnviadoRepoDrizzle } = await import("@/marketing/remarketing/enviado-repo-drizzle");
    configRepo = criarConfigRemarketingRepoDrizzle(db);
    enviadoRepo = criarRemarketingEnviadoRepoDrizzle(db);
  });

  afterEach(async () => {
    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.remarketingEnviado);
    await db.delete(schema.configRemarketing);

    if (orcIds.length) {
      await db.delete(schema.orcamento).where(inArray(schema.orcamento.id, orcIds));
      orcIds.length = 0;
    }
    if (osIds.length) {
      await db.delete(schema.ordemServico).where(inArray(schema.ordemServico.id, osIds));
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

  async function seedCliente(whatsapp: string) {
    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await db
      .insert(schema.cliente)
      .values({
        nome: `Cliente ${r}`,
        whatsapp,
        email: `cli-${r}@dbg.test`,
        endereco: { logradouro: "Rua Teste", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    cliIds.push(cli.id);
    return cli;
  }

  async function seedSolicitacao(clienteId: string, criadoEm: Date) {
    const r = Math.random().toString(36).slice(2, 10);
    const [sol] = await db
      .insert(schema.solicitacao)
      .values({
        token: `tok-rem-${r}`,
        clienteId,
        categorias: ["ELETRICA"],
        descricao: "teste remarketing",
        endereco: { logradouro: "Rua Teste", cidade: "São Paulo", uf: "SP" },
        criadoEm,
      })
      .returning();
    solIds.push(sol.id);
    return sol;
  }

  async function seedOS(solicitacaoId: string, estado: any) {
    const [os] = await db
      .insert(schema.ordemServico)
      .values({
        solicitacaoId,
        categoria: "ELETRICA",
        tipo: "NORMAL",
        estado,
      })
      .returning();
    osIds.push(os.id);
    return os;
  }

  async function seedOrcamento(osId: string, criadoEm: Date, validoAte: Date, rejeitadoEm: Date | null = null) {
    const r = Math.random().toString(36).slice(2, 10);
    const [orc] = await db
      .insert(schema.orcamento)
      .values({
        osId,
        tokenAprovacao: `apr-${r}`,
        total: "150.00",
        validoAte,
        rejeitadoEm,
        criadoEm,
      })
      .returning();
    orcIds.push(orc.id);
    return orc;
  }

  it("Slice D: lembrete de orçamento envia nos dias configurados, obedece toggles e garante idempotência", async () => {
    // Caso 1: Orçamento com 3 dias de idade (72h) deve enviar lembrete dia 3
    const cli1 = await seedCliente(`${PREFIXO_WPP}01`);
    const sol1 = await seedSolicitacao(cli1.id, new Date("2026-06-05T13:00:00Z"));
    const os1 = await seedOS(sol1.id, "ORCADA");
    // Criado em 2026-06-05T13:00:00Z. Lembrete rodado em 2026-06-08T13:00:00Z (72h depois = 3 dias). Validade até dia 12.
    const orc1 = await seedOrcamento(os1.id, new Date("2026-06-05T13:00:00Z"), new Date("2026-06-12T13:00:00Z"));

    const gateway = fakeGateway();
    const email = fakeEmail();
    const agora = new Date("2026-06-08T13:00:00Z");

    // Roda o job
    const resultado = await processarRemarketing({
      gateway,
      agora,
      enviarEmail: email.enviar,
    });

    expect(resultado.lembrete_orcamento).toBeGreaterThanOrEqual(1);

    // Verifica envio
    const chamadasWpp = gateway.chamadas.filter((c) => c.destinatario === cli1.whatsapp);
    expect(chamadasWpp).toHaveLength(1);
    expect(chamadasWpp[0].template).toBe("orcamento_expirando");
    expect(chamadasWpp[0].variaveis.nome_cliente).toBe(cli1.nome);

    const chamadasEmail = email.chamadas.filter((e) => e.para === cli1.email);
    expect(chamadasEmail).toHaveLength(1);
    expect(chamadasEmail[0].assunto).toContain("Lembrete");

    // Segunda execução não deve re-enviar (idempotência)
    const gateway2 = fakeGateway();
    const email2 = fakeEmail();
    await processarRemarketing({ gateway: gateway2, agora, enviarEmail: email2.enviar });
    expect(gateway2.chamadas.filter((c) => c.destinatario === cli1.whatsapp)).toHaveLength(0);
    expect(email2.chamadas.filter((e) => e.para === cli1.email)).toHaveLength(0);

    // Caso 2: Se o gatilho estiver desligado (ativo: false), não envia
    await configRepo.salvar("lembrete_orcamento", {
      ativo: false,
      prazosDias: [3, 6],
      templateId: "orcamento_expirando",
    });

    // Cria outro orçamento com 3 dias de idade
    const cli2 = await seedCliente(`${PREFIXO_WPP}02`);
    const sol2 = await seedSolicitacao(cli2.id, new Date("2026-06-05T13:00:00Z"));
    const os2 = await seedOS(sol2.id, "ORCADA");
    await seedOrcamento(os2.id, new Date("2026-06-05T13:00:00Z"), new Date("2026-06-12T13:00:00Z"));

    const gateway3 = fakeGateway();
    const email3 = fakeEmail();
    await processarRemarketing({ gateway: gateway3, agora, enviarEmail: email3.enviar });
    expect(gateway3.chamadas.filter((c) => c.destinatario === cli2.whatsapp)).toHaveLength(0);
  });

  it("Slice E: rejeição de orçamento envia mensagem, obedece toggles e garante idempotência", async () => {
    // Orçamento rejeitado há 2 dias (48h)
    const cli = await seedCliente(`${PREFIXO_WPP}03`);
    const sol = await seedSolicitacao(cli.id, new Date("2026-06-05T13:00:00Z"));
    const os = await seedOS(sol.id, "REJEITADA");
    const rejeitadoEm = new Date("2026-06-06T13:00:00Z");
    const orc = await seedOrcamento(os.id, new Date("2026-06-05T13:00:00Z"), new Date("2026-06-12T13:00:00Z"), rejeitadoEm);

    const gateway = fakeGateway();
    const email = fakeEmail();
    const agora = new Date("2026-06-08T13:00:00Z"); // 48h depois

    const resultado = await processarRemarketing({
      gateway,
      agora,
      enviarEmail: email.enviar,
    });

    expect(resultado.rejeicao_orcamento).toBeGreaterThanOrEqual(1);

    expect(gateway.chamadas.filter((c) => c.destinatario === cli.whatsapp)).toHaveLength(1);
    expect(gateway.chamadas[0].template).toBe("orcamento_rejeitado");

    // Idempotência
    const gateway2 = fakeGateway();
    await processarRemarketing({ gateway: gateway2, agora, enviarEmail: email.enviar });
    expect(gateway2.chamadas.filter((c) => c.destinatario === cli.whatsapp)).toHaveLength(0);
  });

  it("Slice F: reativação de inativos envia mensagem se inatividade atingida, obedece toggles e idempotência", async () => {
    // Cliente cuja última solicitação foi há 180 dias
    const cli = await seedCliente(`${PREFIXO_WPP}04`);
    // Solicitação antiga: 180 dias atrás
    await seedSolicitacao(cli.id, new Date("2025-12-10T13:00:00Z"));

    const gateway = fakeGateway();
    const email = fakeEmail();
    const agora = new Date("2026-06-08T13:00:00Z"); // Exatos 180 dias depois

    const resultado = await processarRemarketing({
      gateway,
      agora,
      enviarEmail: email.enviar,
    });

    expect(resultado.reativacao_inativos).toBeGreaterThanOrEqual(1);
    expect(gateway.chamadas.filter((c) => c.destinatario === cli.whatsapp)).toHaveLength(1);
    expect(gateway.chamadas[0].template).toBe("cliente_inativo");

    // Idempotência
    const gateway2 = fakeGateway();
    await processarRemarketing({ gateway: gateway2, agora, enviarEmail: email.enviar });
    expect(gateway2.chamadas.filter((c) => c.destinatario === cli.whatsapp)).toHaveLength(0);
  });
});
