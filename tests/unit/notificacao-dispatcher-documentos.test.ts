import { describe, expect, it, vi } from "vitest";
import { despacharEventoOs } from "@/notificacao/dispatcher";

describe("despacharEventoOs — geração de documentos (#48)", () => {
  it("PAGA dispara a geração de documentos", async () => {
    const gerarDocumentos = vi.fn(async () => ({ email: "sent" as const }));
    const obterOs = async (id: string) => ({ id, tipo: "NORMAL" as const, estado: "CONCLUIDA" });
    const enviarEmail = vi.fn(async () => ({ status: "sent" as const }));

    const res = await despacharEventoOs("os-1", "PAGA", {
      gerarDocumentos,
      obterOs,
      enviarEmail,
      claimAvaliacao: async () => false,
    });

    expect(gerarDocumentos).toHaveBeenCalledWith("os-1", "PAGA");
    expect(res.documentos).toEqual({ email: "sent" });
  });

  it("CONCLUIDA também dispara documentos (certificado de regarantia)", async () => {
    const gerarDocumentos = vi.fn(async () => ({ email: "skipped" as const }));
    const enviarEmail = vi.fn(async () => ({ status: "sent" as const }));
    const obterOs = async (id: string) => ({ id, tipo: "NORMAL" as const, estado: "CONCLUIDA" });

    await despacharEventoOs("os-2", "CONCLUIDA", {
      gerarDocumentos,
      enviarEmail,
      obterOs,
    });

    expect(gerarDocumentos).toHaveBeenCalledWith("os-2", "CONCLUIDA");
  });

  it("estados sem documentos (A_CAMINHO) não geram nada", async () => {
    const gerarDocumentos = vi.fn(async () => ({ email: "skipped" as const }));
    const obterOs = async (id: string) => ({ id, tipo: "NORMAL" as const, estado: "AGENDADA" });
    const enviarEmail = vi.fn(async () => ({ status: "sent" as const }));

    await despacharEventoOs("os-3", "A_CAMINHO", { gerarDocumentos, obterOs, enviarEmail });

    expect(gerarDocumentos).not.toHaveBeenCalled();
  });
});
