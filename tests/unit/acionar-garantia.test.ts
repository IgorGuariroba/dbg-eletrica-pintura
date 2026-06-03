import { describe, expect, it, vi } from "vitest";
import { acionarGarantia, ForaDoPrazoError } from "@/operacao/garantia/acionar-garantia";
import type { GarantiaRepo } from "@/operacao/garantia/garantia-repo";

describe("acionarGarantia Usecase", () => {
  const dummyRepo = (): GarantiaRepo => ({
    carregarAncora: vi.fn(),
    temComplementarRejeitado: vi.fn(),
    criarChamado: vi.fn(),
    carregarGarantiasParaOsIds: vi.fn(),
  });

  const dummyUpload = vi.fn();

  it("valida que a descrição tem que ter pelo menos 20 caracteres", async () => {
    const repo = dummyRepo();
    await expect(
      acionarGarantia(
        {
          osId: "os-123",
          descricao: "Curto",
          fotoDataUrl: "data:image/png;base64,...",
          criadoPor: "cliente@dbg.test",
          canal: "PORTAL",
        },
        { repo, uploadFoto: dummyUpload },
      ),
    ).rejects.toThrow(/mínimo 20 caracteres/i);
  });

  it("valida que exige foto", async () => {
    const repo = dummyRepo();
    await expect(
      acionarGarantia(
        {
          osId: "os-123",
          descricao: "Descrição longa o suficiente com mais de 20 caracteres",
          fotoDataUrl: "",
          criadoPor: "cliente@dbg.test",
          canal: "PORTAL",
        },
        { repo, uploadFoto: dummyUpload },
      ),
    ).rejects.toThrow(/foto é obrigatória/i);
  });

  it("OS fora do prazo bloqueia portal (lança ForaDoPrazoError)", async () => {
    const repo = dummyRepo();
    const agora = new Date("2026-08-04T12:00:00Z");
    const ancora = {
      ancoraId: "os-123",
      prazoMeses: 3,
      pagamentoEm: new Date("2026-05-03T12:00:00Z"),
      tipo: "NORMAL" as const,
    };

    repo.carregarAncora = vi.fn().mockResolvedValue(ancora);
    repo.temComplementarRejeitado = vi.fn().mockResolvedValue(false);

    await expect(
      acionarGarantia(
        {
          osId: "os-123",
          descricao: "Descrição longa o suficiente com mais de 20 caracteres",
          fotoDataUrl: "data:image/png;base64,...",
          criadoPor: "cliente@dbg.test",
          canal: "PORTAL",
        },
        { repo, uploadFoto: dummyUpload, agora },
      ),
    ).rejects.toThrow(ForaDoPrazoError);

    expect(repo.criarChamado).not.toHaveBeenCalled();
    expect(dummyUpload).not.toHaveBeenCalled();
  });

  it("admin (canal=WHATSAPP) fora do prazo registra com acionamentoInvalido=true", async () => {
    const repo = dummyRepo();
    const agora = new Date("2026-08-04T12:00:00Z");
    const ancora = {
      ancoraId: "os-123",
      prazoMeses: 3,
      pagamentoEm: new Date("2026-05-03T12:00:00Z"),
      tipo: "NORMAL" as const,
    };

    repo.carregarAncora = vi.fn().mockResolvedValue(ancora);
    repo.temComplementarRejeitado = vi.fn().mockResolvedValue(false);
    repo.criarChamado = vi.fn().mockResolvedValue({ id: "chamado-123" });
    const upload = vi.fn().mockResolvedValue("fotos/chamados/foto-uuid.jpg");

    const res = await acionarGarantia(
      {
        osId: "os-123",
        descricao: "Descrição longa o suficiente com mais de 20 caracteres",
        fotoDataUrl: "data:image/png;base64,...",
        criadoPor: "admin@dbg.test",
        canal: "WHATSAPP",
      },
      { repo, uploadFoto: upload, agora },
    );

    expect(res.chamadoId).toBe("chamado-123");
    expect(upload).toHaveBeenCalled();
    expect(repo.criarChamado).toHaveBeenCalledWith(
      expect.objectContaining({
        acionamentoInvalido: true,
        temComplementarRejeitado: false,
        canal: "WHATSAPP",
      }),
    );
  });

  it("OS com complementar rejeitado seta flag temComplementarRejeitado", async () => {
    const repo = dummyRepo();
    const agora = new Date("2026-06-03T12:00:00Z");
    const ancora = {
      ancoraId: "os-123",
      prazoMeses: 3,
      pagamentoEm: new Date("2026-05-03T12:00:00Z"),
      tipo: "NORMAL" as const,
    };

    repo.carregarAncora = vi.fn().mockResolvedValue(ancora);
    repo.temComplementarRejeitado = vi.fn().mockResolvedValue(true);
    repo.criarChamado = vi.fn().mockResolvedValue({ id: "chamado-123" });
    const upload = vi.fn().mockResolvedValue("fotos/chamados/foto-uuid.jpg");

    const res = await acionarGarantia(
      {
        osId: "os-123",
        descricao: "Descrição longa o suficiente com mais de 20 caracteres",
        fotoDataUrl: "data:image/png;base64,...",
        criadoPor: "cliente@dbg.test",
        canal: "PORTAL",
      },
      { repo, uploadFoto: upload, agora },
    );

    expect(res.chamadoId).toBe("chamado-123");
    expect(repo.criarChamado).toHaveBeenCalledWith(
      expect.objectContaining({
        temComplementarRejeitado: true,
        acionamentoInvalido: false,
        canal: "PORTAL",
      }),
    );
  });
});
