import { describe, expect, it, vi } from "vitest";
import {
  aplicarGarantia,
  rejeitarGarantia,
  ChamadoInexistenteError,
  ChamadoJaDecididoError,
  JustificativaObrigatoriaError,
  MotivoRejeicaoObrigatorioError,
} from "@/operacao/garantia/aplicar-garantia";
import { ForaDoPrazoError } from "@/operacao/garantia/acionar-garantia";
import type { GarantiaDecisaoRepo, ChamadoDecisao } from "@/operacao/garantia/aplicar-garantia";

describe("aplicarGarantia & rejeitarGarantia Usecases", () => {
  const dummyRepo = (): GarantiaDecisaoRepo => ({
    carregarChamado: vi.fn(),
    listarChamadosPendentes: vi.fn(),
    aplicar: vi.fn(),
    rejeitar: vi.fn(),
  });

  const validChamado = (overrides?: Partial<ChamadoDecisao>): ChamadoDecisao => ({
    id: "chamado-1",
    status: "pendente",
    osOrigemId: "os-origem-123",
    ancora: {
      ancoraId: "os-origem-123",
      prazoMeses: 3,
      pagamentoEm: new Date("2026-05-03T12:00:00Z"),
      tipo: "NORMAL",
    },
    categoria: "ELETRIQUINHA" as any, // category type
    tecnicoOriginalId: "tecnico-1",
    tecnicoOriginalDisponivel: true,
    ...overrides,
  });

  describe("aplicarGarantia", () => {
    it("lança ChamadoInexistenteError se o chamado não for encontrado", async () => {
      const repo = dummyRepo();
      repo.carregarChamado = vi.fn().mockResolvedValue(null);

      await expect(
        aplicarGarantia(
          { chamadoId: "chamado-inexistente", decididoPor: "admin@dbg.com" },
          { repo },
        ),
      ).rejects.toThrow(ChamadoInexistenteError);
    });

    it("lança ChamadoJaDecididoError se o chamado já foi resolvido", async () => {
      const repo = dummyRepo();
      repo.carregarChamado = vi.fn().mockResolvedValue(validChamado({ status: "aplicada" }));

      await expect(
        aplicarGarantia(
          { chamadoId: "chamado-1", decididoPor: "admin@dbg.com" },
          { repo },
        ),
      ).rejects.toThrow(ChamadoJaDecididoError);
    });

    it("se dentro do prazo e técnico original está disponível, atribui para ele", async () => {
      const repo = dummyRepo();
      const chamado = validChamado({
        tecnicoOriginalId: "tecnico-1",
        tecnicoOriginalDisponivel: true,
      });
      repo.carregarChamado = vi.fn().mockResolvedValue(chamado);
      repo.aplicar = vi.fn().mockResolvedValue({ osGarantiaId: "os-garantia-999" });
      const notificar = vi.fn().mockResolvedValue(undefined);

      const agora = new Date("2026-06-03T12:00:00Z"); // inside the 3 months window (ends 2026-08-03)

      const result = await aplicarGarantia(
        { chamadoId: "chamado-1", decididoPor: "admin@dbg.com" },
        { repo, notificar, agora },
      );

      expect(repo.aplicar).toHaveBeenCalledWith({
        chamadoId: "chamado-1",
        osOrigemId: "os-origem-123",
        categoria: chamado.categoria,
        prazoMeses: 3,
        tecnicoId: "tecnico-1",
        decididoPor: "admin@dbg.com",
        override: null,
      });
      expect(notificar).toHaveBeenCalledWith("os-garantia-999");
      expect(result).toEqual({
        osGarantiaId: "os-garantia-999",
        tecnicoAtribuido: true,
      });
    });

    it("se dentro do prazo e técnico original indisponível, envia tecnicoId como null", async () => {
      const repo = dummyRepo();
      const chamado = validChamado({
        tecnicoOriginalId: "tecnico-1",
        tecnicoOriginalDisponivel: false,
      });
      repo.carregarChamado = vi.fn().mockResolvedValue(chamado);
      repo.aplicar = vi.fn().mockResolvedValue({ osGarantiaId: "os-garantia-999" });
      const notificar = vi.fn().mockResolvedValue(undefined);

      const agora = new Date("2026-06-03T12:00:00Z");

      const result = await aplicarGarantia(
        { chamadoId: "chamado-1", decididoPor: "admin@dbg.com" },
        { repo, notificar, agora },
      );

      expect(repo.aplicar).toHaveBeenCalledWith({
        chamadoId: "chamado-1",
        osOrigemId: "os-origem-123",
        categoria: chamado.categoria,
        prazoMeses: 3,
        tecnicoId: null,
        decididoPor: "admin@dbg.com",
        override: null,
      });
      expect(result).toEqual({
        osGarantiaId: "os-garantia-999",
        tecnicoAtribuido: false,
      });
    });

    it("lança ForaDoPrazoError se chamado estiver fora do prazo e não houver override", async () => {
      const repo = dummyRepo();
      const chamado = validChamado();
      repo.carregarChamado = vi.fn().mockResolvedValue(chamado);
      const agora = new Date("2026-08-04T12:00:00Z"); // past the 3 months window

      await expect(
        aplicarGarantia(
          { chamadoId: "chamado-1", decididoPor: "admin@dbg.com" },
          { repo, agora },
        ),
      ).rejects.toThrow(ForaDoPrazoError);

      expect(repo.aplicar).not.toHaveBeenCalled();
    });

    it("lança JustificativaObrigatoriaError se fora do prazo com override sem justificativa válida", async () => {
      const repo = dummyRepo();
      const chamado = validChamado();
      repo.carregarChamado = vi.fn().mockResolvedValue(chamado);
      const agora = new Date("2026-08-04T12:00:00Z");

      await expect(
        aplicarGarantia(
          {
            chamadoId: "chamado-1",
            decididoPor: "admin@dbg.com",
            override: { justificativa: "   " },
          },
          { repo, agora },
        ),
      ).rejects.toThrow(JustificativaObrigatoriaError);

      expect(repo.aplicar).not.toHaveBeenCalled();
    });

    it("permite aplicar com override fora do prazo se houver justificativa", async () => {
      const repo = dummyRepo();
      const chamado = validChamado({
        tecnicoOriginalId: "tecnico-1",
        tecnicoOriginalDisponivel: true,
      });
      repo.carregarChamado = vi.fn().mockResolvedValue(chamado);
      repo.aplicar = vi.fn().mockResolvedValue({ osGarantiaId: "os-garantia-999" });
      const notificar = vi.fn();
      const agora = new Date("2026-08-04T12:00:00Z");

      const result = await aplicarGarantia(
        {
          chamadoId: "chamado-1",
          decididoPor: "admin@dbg.com",
          override: { justificativa: "Cliente é recorrente e o atraso foi pequeno" },
        },
        { repo, notificar, agora },
      );

      expect(repo.aplicar).toHaveBeenCalledWith({
        chamadoId: "chamado-1",
        osOrigemId: "os-origem-123",
        categoria: chamado.categoria,
        prazoMeses: 3,
        tecnicoId: "tecnico-1",
        decididoPor: "admin@dbg.com",
        override: { justificativa: "Cliente é recorrente e o atraso foi pequeno" },
      });
      expect(result).toEqual({
        osGarantiaId: "os-garantia-999",
        tecnicoAtribuido: true,
      });
    });
  });

  describe("rejeitarGarantia", () => {
    it("lança MotivoRejeicaoObrigatorioError se motivo for vazio ou apenas espaços", async () => {
      const repo = dummyRepo();

      await expect(
        rejeitarGarantia(
          { chamadoId: "chamado-1", motivo: "   ", decididoPor: "admin@dbg.com" },
          { repo },
        ),
      ).rejects.toThrow(MotivoRejeicaoObrigatorioError);

      expect(repo.rejeitar).not.toHaveBeenCalled();
    });

    it("lança ChamadoInexistenteError se chamado não existe ao rejeitar", async () => {
      const repo = dummyRepo();
      repo.carregarChamado = vi.fn().mockResolvedValue(null);

      await expect(
        rejeitarGarantia(
          { chamadoId: "chamado-1", motivo: "Não há defeito na instalação", decididoPor: "admin@dbg.com" },
          { repo },
        ),
      ).rejects.toThrow(ChamadoInexistenteError);
    });

    it("lança ChamadoJaDecididoError se chamado já resolvido ao rejeitar", async () => {
      const repo = dummyRepo();
      repo.carregarChamado = vi.fn().mockResolvedValue(validChamado({ status: "rejeitada" }));

      await expect(
        rejeitarGarantia(
          { chamadoId: "chamado-1", motivo: "Não há defeito na instalação", decididoPor: "admin@dbg.com" },
          { repo },
        ),
      ).rejects.toThrow(ChamadoJaDecididoError);
    });

    it("rejeita com motivo válido chamados pendentes", async () => {
      const repo = dummyRepo();
      repo.carregarChamado = vi.fn().mockResolvedValue(validChamado());

      await rejeitarGarantia(
        { chamadoId: "chamado-1", motivo: "Problema não relacionado com mão de obra", decididoPor: "admin@dbg.com" },
        { repo },
      );

      expect(repo.rejeitar).toHaveBeenCalledWith(
        "chamado-1",
        "Problema não relacionado com mão de obra",
        "admin@dbg.com",
      );
    });
  });
});
