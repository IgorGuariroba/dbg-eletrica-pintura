import { describe, expect, it } from "vitest";
import {
  notificarFalhaPagamento,
  type DadosFalhaPagamento,
} from "@/assinatura/notificar-falha-pagamento";

function setup(over: Partial<DadosFalhaPagamento> = {}) {
  const dados: DadosFalhaPagamento = {
    clienteNome: "Maria",
    whatsapp: "5511999990000",
    email: "maria@x.com",
    planoNome: "Premium",
    linkAtualizacao: "https://mp/atualizar/pre-1",
    ...over,
  };
  const whats: { destinatario: string; link: string }[] = [];
  const mails: { para: string; html: string }[] = [];
  const config = {
    carregar: async () => dados,
    enviarWhatsapp: async (i: {
      destinatario: string;
      clienteNome: string;
      link: string;
    }) => {
      whats.push({ destinatario: i.destinatario, link: i.link });
    },
    enviarEmail: async (i: { para: string; assunto: string; html: string }) => {
      mails.push({ para: i.para, html: i.html });
    },
  };
  return { config, whats, mails };
}

describe("notificarFalhaPagamento", () => {
  it("dispara WhatsApp e e-mail com o link de atualização de pagamento", async () => {
    const { config, whats, mails } = setup();

    const out = await notificarFalhaPagamento("pre-1", config);

    expect(whats).toEqual([
      { destinatario: "5511999990000", link: "https://mp/atualizar/pre-1" },
    ]);
    expect(mails).toHaveLength(1);
    expect(mails[0].para).toBe("maria@x.com");
    expect(mails[0].html).toContain("https://mp/atualizar/pre-1");
    expect(out).toEqual({ whatsapp: "sent", email: "sent" });
  });

  it("pula WhatsApp quando o cliente não tem número válido", async () => {
    const { config, whats, mails } = setup({ whatsapp: null });

    const out = await notificarFalhaPagamento("pre-1", config);

    expect(whats).toEqual([]);
    expect(mails).toHaveLength(1);
    expect(out).toEqual({ whatsapp: "skipped", email: "sent" });
  });

  it("pula e-mail quando o cliente não tem e-mail", async () => {
    const { config, whats, mails } = setup({ email: null });

    const out = await notificarFalhaPagamento("pre-1", config);

    expect(whats).toHaveLength(1);
    expect(mails).toEqual([]);
    expect(out).toEqual({ whatsapp: "sent", email: "skipped" });
  });

  it("não envia nada quando a assinatura não é encontrada", async () => {
    const { config, whats, mails } = setup();
    config.carregar = async () => undefined as unknown as DadosFalhaPagamento;

    const out = await notificarFalhaPagamento("sumiu", config);

    expect(whats).toEqual([]);
    expect(mails).toEqual([]);
    expect(out).toEqual({ whatsapp: "skipped", email: "skipped" });
  });
});
