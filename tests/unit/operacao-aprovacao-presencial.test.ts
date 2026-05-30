import { describe, expect, it, vi } from "vitest";
import {
  validarAprovacaoPresencial,
  assinaturaPreenchida,
  aprovarPresencial,
  AssinaturaVaziaError,
  AprovacaoNaoConfirmadaError,
  LgpdNaoAceitaError,
  type AprovacaoPresencialRepo,
  type UploadAssinatura,
} from "@/operacao/aprovacao-presencial";
import { OsNaoOrcadaError } from "@/operacao/aprovacao-repo";

const base = {
  aprovou: true,
  lgpdAceito: true,
  assinaturaPreenchida: true,
  origem: "FORMULARIO" as const,
};

describe("validarAprovacaoPresencial", () => {
  it("rejeita aprovação sem assinatura", () => {
    expect(() =>
      validarAprovacaoPresencial({ ...base, assinaturaPreenchida: false }),
    ).toThrow(AssinaturaVaziaError);
  });

  it("rejeita quando o cliente não confirmou a aprovação", () => {
    expect(() =>
      validarAprovacaoPresencial({ ...base, aprovou: false }),
    ).toThrow(AprovacaoNaoConfirmadaError);
  });

  it("exige LGPD quando a origem não é Express", () => {
    expect(() =>
      validarAprovacaoPresencial({
        ...base,
        origem: "FORMULARIO",
        lgpdAceito: false,
      }),
    ).toThrow(LgpdNaoAceitaError);
  });

  it("dispensa LGPD em OS Express (já coletada na criação)", () => {
    expect(() =>
      validarAprovacaoPresencial({
        ...base,
        origem: "EXPRESS_TECNICO",
        lgpdAceito: false,
      }),
    ).not.toThrow();
  });
});

describe("assinaturaPreenchida", () => {
  // PNG mínimo (1x1 transparente) — proxy de um canvas em branco.
  const pngVazio = "data:image/png;base64,iVBORw0KGgo=";

  it("trata PNG minúsculo (canvas em branco) como vazio", () => {
    expect(assinaturaPreenchida(pngVazio)).toBe(false);
  });

  it("considera preenchido um PNG com payload acima do piso", () => {
    // ~3KB de payload base64 — proxy de um canvas com traços.
    const pngComTraco = "data:image/png;base64," + "A".repeat(4096);
    expect(assinaturaPreenchida(pngComTraco)).toBe(true);
  });

  it("rejeita string que não é data URL", () => {
    expect(assinaturaPreenchida("nao-eh-data-url")).toBe(false);
  });
});

describe("aprovarPresencial", () => {
  const assinaturaOk = "data:image/png;base64," + "A".repeat(4096);

  function fakeUpload(): UploadAssinatura {
    return {
      enviarAssinatura: vi.fn(async ({ osId }) => ({
        url: `assinaturas/os/${osId}/uuid.png`,
      })),
    };
  }

  function fakeRepo(over: Partial<AprovacaoPresencialRepo> = {}): AprovacaoPresencialRepo {
    return {
      aprovarPresencial: vi.fn(async () => true),
      podeIniciarExecucao: vi.fn(async () => false),
      ...over,
    };
  }

  const dadosBase = {
    osId: "os-1",
    aprovou: true,
    lgpdAceito: true,
    origem: "FORMULARIO" as const,
    assinaturaDataUrl: assinaturaOk,
    tecnicoEmail: "tec@dbg.com",
  };

  it("envia a assinatura e grava a aprovação presencial com a URL retornada", async () => {
    const repo = fakeRepo();
    const upload = fakeUpload();

    const out = await aprovarPresencial(dadosBase, { repo, upload });

    expect(upload.enviarAssinatura).toHaveBeenCalledWith({
      osId: "os-1",
      dataUrl: assinaturaOk,
    });
    expect(repo.aprovarPresencial).toHaveBeenCalledWith(
      expect.objectContaining({
        osId: "os-1",
        assinaturaUrl: "assinaturas/os/os-1/uuid.png",
        aprovadoPor: "tec@dbg.com",
        lgpdAceito: true,
      }),
    );
    expect(out.assinaturaUrl).toBe("assinaturas/os/os-1/uuid.png");
  });

  it("falha sem assinatura antes de enviar ou gravar (sem efeitos colaterais)", async () => {
    const repo = fakeRepo();
    const upload = fakeUpload();

    await expect(
      aprovarPresencial(
        { ...dadosBase, assinaturaDataUrl: "data:image/png;base64,iVBORw0KGgo=" },
        { repo, upload },
      ),
    ).rejects.toBeInstanceOf(AssinaturaVaziaError);

    expect(upload.enviarAssinatura).not.toHaveBeenCalled();
    expect(repo.aprovarPresencial).not.toHaveBeenCalled();
  });

  it("propaga OsNaoOrcadaError quando o gate atômico não transita", async () => {
    const repo = fakeRepo({ aprovarPresencial: vi.fn(async () => false) });
    await expect(
      aprovarPresencial(dadosBase, { repo, upload: fakeUpload() }),
    ).rejects.toBeInstanceOf(OsNaoOrcadaError);
  });

  it("oferece início imediato quando o repo indica execução possível", async () => {
    const repo = fakeRepo({ podeIniciarExecucao: vi.fn(async () => true) });
    const out = await aprovarPresencial(dadosBase, { repo, upload: fakeUpload() });
    expect(out.podeIniciarExecucao).toBe(true);
  });
});
