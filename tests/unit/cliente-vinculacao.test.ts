import { describe, expect, it, vi } from "vitest";
import {
  iniciarVinculacao,
  confirmarVinculacao,
  desvincular,
  enriquecerSessaoCliente,
} from "@/cliente/vinculacao";
import {
  type VinculacaoRepo,
  ClienteNaoEncontradoError,
  WhatsappJaVinculadoError,
  CodigoInvalidoError,
  VinculacaoExpiradaError,
} from "@/cliente/vinculacao-repo";

function repoFake(over: Partial<VinculacaoRepo> = {}): VinculacaoRepo {
  return {
    buscarClientePorWhatsapp: vi.fn(async () => ({ id: "cliente-id-1", googleEmail: null })),
    buscarVinculoPorGoogleEmail: vi.fn(async () => null),
    salvarPendente: vi.fn(async () => {}),
    buscarPendente: vi.fn(async () => null),
    removerPendente: vi.fn(async () => {}),
    vincular: vi.fn(async () => {}),
    desvincular: vi.fn(async () => true),
    registrarLog: vi.fn(async () => {}),
    notificarEquipe: vi.fn(async () => {}),
    ...over,
  };
}

describe("iniciarVinculacao", () => {
  it("inicia vinculação com cliente existente e número livre", async () => {
    const repo = repoFake();
    const googleEmail = "cliente@gmail.com";
    const whatsapp = "5511999999999";

    await iniciarVinculacao({ googleEmail, whatsapp }, repo);

    expect(repo.buscarClientePorWhatsapp).toHaveBeenCalledWith("5511999999999");
    expect(repo.salvarPendente).toHaveBeenCalledWith(
      expect.objectContaining({
        googleEmail: "cliente@gmail.com",
        whatsapp: "5511999999999",
        codigo: expect.stringMatching(/^\d{6}$/),
        expiraEm: expect.any(Date),
      })
    );
    expect(repo.notificarEquipe).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsapp: "5511999999999",
        codigo: expect.stringMatching(/^\d{6}$/),
      })
    );
  });

  it("rejeita se o WhatsApp já estiver vinculado a OUTRO Google email", async () => {
    const repo = repoFake({
      buscarClientePorWhatsapp: vi.fn(async () => ({
        id: "cliente-id-1",
        googleEmail: "outro@gmail.com",
      })),
    });
    await expect(
      iniciarVinculacao({ googleEmail: "cliente@gmail.com", whatsapp: "5511999999999" }, repo)
    ).rejects.toThrow(WhatsappJaVinculadoError);
  });

  it("rejeita se o Google email já estiver vinculado a OUTRO WhatsApp", async () => {
    const repo = repoFake({
      buscarVinculoPorGoogleEmail: vi.fn(async () => ({
        whatsapp: "5511888888888",
      })),
    });
    await expect(
      iniciarVinculacao({ googleEmail: "cliente@gmail.com", whatsapp: "5511999999999" }, repo)
    ).rejects.toThrow(WhatsappJaVinculadoError);
  });

  it("rejeita se o WhatsApp não estiver cadastrado no sistema", async () => {
    const repo = repoFake({
      buscarClientePorWhatsapp: vi.fn(async () => null),
    });
    await expect(
      iniciarVinculacao({ googleEmail: "cliente@gmail.com", whatsapp: "5511999999999" }, repo)
    ).rejects.toThrow(ClienteNaoEncontradoError);
  });
});

describe("confirmarVinculacao", () => {
  it("vincula com sucesso com código correto e dentro do prazo", async () => {
    const pendente = {
      googleEmail: "cliente@gmail.com",
      whatsapp: "5511999999999",
      codigo: "123456",
      expiraEm: new Date(Date.now() + 5000), // no futuro
    };
    const repo = repoFake({
      buscarClientePorWhatsapp: vi.fn(async () => ({ id: "cliente-id-1", googleEmail: null })),
      buscarPendente: vi.fn(async () => pendente),
    });

    await confirmarVinculacao(
      { googleEmail: "cliente@gmail.com", codigo: "123456" },
      repo
    );

    expect(repo.buscarPendente).toHaveBeenCalledWith("cliente@gmail.com");
    expect(repo.vincular).toHaveBeenCalledWith("5511999999999", "cliente@gmail.com");
    expect(repo.registrarLog).toHaveBeenCalledWith({
      clienteId: "cliente-id-1",
      googleEmail: "cliente@gmail.com",
      whatsapp: "5511999999999",
      evento: "VINCULADO",
      atorEmail: "cliente@gmail.com",
    });
    expect(repo.removerPendente).toHaveBeenCalledWith("cliente@gmail.com");
  });

  it("rejeita com CodigoInvalidoError se o código estiver incorreto", async () => {
    const pendente = {
      googleEmail: "cliente@gmail.com",
      whatsapp: "5511999999999",
      codigo: "123456",
      expiraEm: new Date(Date.now() + 5000),
    };
    const repo = repoFake({
      buscarPendente: vi.fn(async () => pendente),
    });

    await expect(
      confirmarVinculacao(
        { googleEmail: "cliente@gmail.com", codigo: "wrong" },
        repo
      )
    ).rejects.toThrow(CodigoInvalidoError);

    expect(repo.vincular).not.toHaveBeenCalled();
    expect(repo.removerPendente).not.toHaveBeenCalled();
  });

  it("rejeita com CodigoInvalidoError se não houver vinculação pendente", async () => {
    const repo = repoFake({
      buscarPendente: vi.fn(async () => null),
    });

    await expect(
      confirmarVinculacao(
        { googleEmail: "cliente@gmail.com", codigo: "123456" },
        repo
      )
    ).rejects.toThrow(CodigoInvalidoError);
  });

  it("rejeita com VinculacaoExpiradaError se o código estiver expirado", async () => {
    const pendente = {
      googleEmail: "cliente@gmail.com",
      whatsapp: "5511999999999",
      codigo: "123456",
      expiraEm: new Date(Date.now() - 1000), // no passado
    };
    const repo = repoFake({
      buscarPendente: vi.fn(async () => pendente),
    });

    await expect(
      confirmarVinculacao(
        { googleEmail: "cliente@gmail.com", codigo: "123456" },
        repo
      )
    ).rejects.toThrow(VinculacaoExpiradaError);

    expect(repo.vincular).not.toHaveBeenCalled();
    expect(repo.removerPendente).not.toHaveBeenCalled();
  });

  it("propaga WhatsappJaVinculadoError se o WhatsApp for vinculado concorrentemente", async () => {
    const pendente = {
      googleEmail: "cliente@gmail.com",
      whatsapp: "5511999999999",
      codigo: "123456",
      expiraEm: new Date(Date.now() + 5000),
    };
    const repo = repoFake({
      buscarClientePorWhatsapp: vi.fn(async () => ({ id: "cliente-id-1", googleEmail: null })),
      buscarPendente: vi.fn(async () => pendente),
      vincular: vi.fn(async () => {
        throw new WhatsappJaVinculadoError("5511999999999");
      }),
    });

    await expect(
      confirmarVinculacao(
        { googleEmail: "cliente@gmail.com", codigo: "123456" },
        repo
      )
    ).rejects.toThrow(WhatsappJaVinculadoError);

    expect(repo.removerPendente).not.toHaveBeenCalled();
    expect(repo.registrarLog).not.toHaveBeenCalled();
  });
});

describe("desvincular", () => {
  it("desvincula com sucesso cliente cadastrado e vinculado", async () => {
    const repo = repoFake({
      buscarClientePorWhatsapp: vi.fn(async () => ({
        id: "cliente-id-1",
        googleEmail: "cliente@gmail.com",
      })),
    });

    const res = await desvincular({ whatsapp: "5511999999999", atorEmail: "admin@dbg.com.br" }, repo);

    expect(res).toBe(true);
    expect(repo.buscarClientePorWhatsapp).toHaveBeenCalledWith("5511999999999");
    expect(repo.desvincular).toHaveBeenCalledWith("5511999999999");
    expect(repo.registrarLog).toHaveBeenCalledWith({
      clienteId: "cliente-id-1",
      googleEmail: "cliente@gmail.com",
      whatsapp: "5511999999999",
      evento: "DESVINCULADO",
      atorEmail: "admin@dbg.com.br",
    });
  });

  it("retorna false se cliente não existe ou não está vinculado", async () => {
    const repo = repoFake({
      buscarClientePorWhatsapp: vi.fn(async () => null),
    });

    const res = await desvincular({ whatsapp: "5511999999999", atorEmail: "admin@dbg.com.br" }, repo);
    expect(res).toBe(false);
    expect(repo.desvincular).not.toHaveBeenCalled();
  });
});

describe("enriquecerSessaoCliente", () => {
  it("adiciona whatsapp ao token se for cliente e não tiver whatsapp", () => {
    const token = { role: "cliente", email: "cliente@gmail.com" } as any;
    const res = enriquecerSessaoCliente(token, { whatsapp: "5511999999999" });
    expect(res.whatsapp).toBe("5511999999999");
  });

  it("define whatsapp como null se lookup retornar null", () => {
    const token = { role: "cliente", email: "cliente@gmail.com" } as any;
    const res = enriquecerSessaoCliente(token, null);
    expect(res.whatsapp).toBe(null);
  });

  it("não altera whatsapp se já estiver setado", () => {
    const token = { role: "cliente", whatsapp: "5511999999999" } as any;
    const res = enriquecerSessaoCliente(token, { whatsapp: "5511888888888" });
    expect(res.whatsapp).toBe("5511999999999");
  });

  it("não altera token se a role não for cliente", () => {
    const token = { role: "membro_interno", email: "membro@dbg.com.br" } as any;
    const res = enriquecerSessaoCliente(token, { whatsapp: "5511888888888" });
    expect(res.whatsapp).toBeUndefined();
  });
});

