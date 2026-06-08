import { describe, expect, it } from "vitest";
import type {
  AssinaturaRepo,
  NovaAssinatura,
} from "@/assinatura/assinatura-repo";
import type { GatewayAssinatura } from "@/assinatura/gateway";
import type { ClienteAssinaturaRepo } from "@/assinatura/cliente-assinatura-repo";
import { iniciarAssinaturaPlano } from "@/assinatura/iniciar-assinatura-plano";
import type { Plano, PlanoRepo } from "@/financeiro/planos/plano-repo";

function planoFixo(over: Partial<Plano> = {}): Plano {
  return {
    id: "pln-1",
    nome: "Conforto",
    slug: "conforto",
    preco: "149.90",
    beneficios: null,
    percentualDesconto: "10",
    preventivasPorAno: 4,
    prioridadeAgendamento: true,
    ativo: true,
    preapprovalPlanIdMp: "plan-mp-1",
    criadoEm: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

function fakePlanoRepo(plano: Plano | null): Pick<PlanoRepo, "buscarPorSlug"> {
  return { async buscarPorSlug() {
    return plano;
  } };
}

function fakeClienteRepo(over: Partial<ClienteAssinaturaRepo> = {}) {
  const criados: { nome: string; whatsapp: string; email: string }[] = [];
  const repo: ClienteAssinaturaRepo = {
    async buscarPorWhatsapp() {
      return { id: "cli-1" };
    },
    async criar(c) {
      criados.push(c);
      return { id: "cli-novo" };
    },
    ...over,
  };
  return { repo, criados };
}

function fakeGateway(over: Partial<GatewayAssinatura> = {}) {
  const chamadas: { preapprovalPlanIdMp: string; payerEmail: string }[] = [];
  const gateway: GatewayAssinatura = {
    async criarAssinatura(req) {
      chamadas.push({
        preapprovalPlanIdMp: req.preapprovalPlanIdMp,
        payerEmail: req.payerEmail,
      });
      return {
        preapprovalIdMp: "pre-mp-1",
        initPoint: "https://mp/checkout?pre=pre-mp-1",
        status: "pending",
      };
    },
    async pausarAssinatura() {},
    async cancelarAssinatura() {},
    async atualizarAssinatura() {},
    async buscarAssinatura(id) {
      return { id, status: "pending" };
    },
    ...over,
  };
  return { gateway, chamadas };
}

function fakeAssinaturaRepo(over: Partial<AssinaturaRepo> = {}) {
  const criadas: NovaAssinatura[] = [];
  const repo: AssinaturaRepo = {
    async criar(a) {
      criadas.push(a);
      return { id: "ass-1" };
    },
    async registrarEvento() {
      return true;
    },
    async atualizarStatus() {},
    ...over,
  };
  return { repo, criadas };
}

describe("iniciarAssinaturaPlano", () => {
  it("cliente existente: cria assinatura no plano e devolve initPoint", async () => {
    const planoRepo = fakePlanoRepo(planoFixo());
    const { repo: clienteRepo } = fakeClienteRepo();
    const { gateway, chamadas } = fakeGateway();
    const { repo: assinaturaRepo, criadas } = fakeAssinaturaRepo();

    const res = await iniciarAssinaturaPlano(
      {
        slug: "conforto",
        cliente: {
          nome: "Maria",
          whatsapp: "+5511999998888",
          email: "maria@gmail.com",
        },
        backUrl: "https://dbg/portal?assinatura=ok",
      },
      { planoRepo, clienteRepo, gateway, assinaturaRepo },
    );

    expect(res).toMatchObject({
      ok: true,
      assinaturaId: "ass-1",
      initPoint: "https://mp/checkout?pre=pre-mp-1",
    });
    expect(criadas[0]).toMatchObject({ clienteId: "cli-1", planoId: "pln-1" });
    expect(chamadas[0]).toMatchObject({
      preapprovalPlanIdMp: "plan-mp-1",
      payerEmail: "maria@gmail.com",
    });
  });

  const entrada = {
    slug: "conforto",
    cliente: { nome: "Maria", whatsapp: "+5511999998888", email: "maria@gmail.com" },
    backUrl: "https://dbg/portal?assinatura=ok",
  };

  it("plano sem preapprovalPlanIdMp (não publicado no MP) → PLANO_INDISPONIVEL", async () => {
    const planoRepo = fakePlanoRepo(planoFixo({ preapprovalPlanIdMp: null }));
    const { repo: clienteRepo } = fakeClienteRepo();
    const { gateway, chamadas } = fakeGateway();
    const { repo: assinaturaRepo, criadas } = fakeAssinaturaRepo();

    const res = await iniciarAssinaturaPlano(entrada, {
      planoRepo,
      clienteRepo,
      gateway,
      assinaturaRepo,
    });

    expect(res).toEqual({ ok: false, erro: "PLANO_INDISPONIVEL" });
    expect(chamadas).toHaveLength(0);
    expect(criadas).toHaveLength(0);
  });

  it("plano inativo → PLANO_INDISPONIVEL", async () => {
    const planoRepo = fakePlanoRepo(planoFixo({ ativo: false }));
    const { repo: clienteRepo } = fakeClienteRepo();
    const { gateway, chamadas } = fakeGateway();
    const { repo: assinaturaRepo } = fakeAssinaturaRepo();

    const res = await iniciarAssinaturaPlano(entrada, {
      planoRepo,
      clienteRepo,
      gateway,
      assinaturaRepo,
    });

    expect(res).toEqual({ ok: false, erro: "PLANO_INDISPONIVEL" });
    expect(chamadas).toHaveLength(0);
  });

  it("slug inexistente → PLANO_NAO_ENCONTRADO", async () => {
    const planoRepo = fakePlanoRepo(null);
    const { repo: clienteRepo } = fakeClienteRepo();
    const { gateway } = fakeGateway();
    const { repo: assinaturaRepo } = fakeAssinaturaRepo();

    const res = await iniciarAssinaturaPlano(
      { ...entrada, slug: "nao-existe" },
      { planoRepo, clienteRepo, gateway, assinaturaRepo },
    );

    expect(res).toEqual({ ok: false, erro: "PLANO_NAO_ENCONTRADO" });
  });

  it("cliente novo (whatsapp não cadastrado): cria cliente antes da assinatura", async () => {
    const planoRepo = fakePlanoRepo(planoFixo());
    const { repo: clienteRepo, criados } = fakeClienteRepo({
      async buscarPorWhatsapp() {
        return null;
      },
    });
    const { gateway } = fakeGateway();
    const { repo: assinaturaRepo, criadas } = fakeAssinaturaRepo();

    const res = await iniciarAssinaturaPlano(entrada, {
      planoRepo,
      clienteRepo,
      gateway,
      assinaturaRepo,
    });

    expect(res).toMatchObject({ ok: true });
    expect(criados[0]).toEqual({
      nome: "Maria",
      whatsapp: "+5511999998888",
      email: "maria@gmail.com",
    });
    expect(criadas[0]).toMatchObject({ clienteId: "cli-novo", planoId: "pln-1" });
  });

  it("cliente já assinante ativo do mesmo plano → JA_ASSINANTE (não duplica)", async () => {
    const planoRepo = fakePlanoRepo(planoFixo());
    const { repo: clienteRepo } = fakeClienteRepo();
    const { gateway, chamadas } = fakeGateway();
    const { repo: assinaturaRepo, criadas } = fakeAssinaturaRepo({
      async assinaturaAtivaDe() {
        return true;
      },
    });

    const res = await iniciarAssinaturaPlano(entrada, {
      planoRepo,
      clienteRepo,
      gateway,
      assinaturaRepo,
    });

    expect(res).toEqual({ ok: false, erro: "JA_ASSINANTE" });
    expect(chamadas).toHaveLength(0);
    expect(criadas).toHaveLength(0);
  });
});
