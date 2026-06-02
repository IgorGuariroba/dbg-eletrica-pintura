import { describe, expect, it } from "vitest";

describe("Financeiro Pure Functions", () => {
  describe("Fatia 8: classificarIdadePendencia", () => {
    it("deve classificar corretamente a idade da pendencia", async () => {
      const { classificarIdadePendencia } = await import("@/features/financeiro/idade-pendencia");
      expect(classificarIdadePendencia(0)).toBe("novo");
      expect(classificarIdadePendencia(1)).toBe("1dia");
      expect(classificarIdadePendencia(2)).toBe("1dia");
      expect(classificarIdadePendencia(3)).toBe("3dias");
      expect(classificarIdadePendencia(4)).toBe("3dias");
      expect(classificarIdadePendencia(100)).toBe("3dias");
    });

    it("deve renderizar o rótulo do badge, com '3+ dias' a partir de 3 dias", async () => {
      const { rotuloIdadePendencia } = await import("@/features/financeiro/idade-pendencia");
      expect(rotuloIdadePendencia(0)).toBe("Novo");
      expect(rotuloIdadePendencia(1)).toBe("1 dia");
      expect(rotuloIdadePendencia(2)).toBe("2 dias");
      expect(rotuloIdadePendencia(3)).toBe("3+ dias");
      // Spec: pendente de 4 dias mostra badge "3+ dias"
      expect(rotuloIdadePendencia(4)).toBe("3+ dias");
    });
  });

  describe("Fatia 9: intervaloPeriodo", () => {
    it("deve calcular corretamente os intervalos para dia, semana e mes", async () => {
      const { intervaloPeriodo } = await import("@/features/financeiro/periodo");
      // Quarta-feira, 03 de Junho de 2026, 15:00:00 UTC
      const agora = new Date("2026-06-03T15:00:00.000Z");

      // 1. Dia
      const dia = intervaloPeriodo("dia", agora);
      expect(dia.inicio.toISOString()).toBe("2026-06-03T03:00:00.000Z");
      expect(dia.fim.toISOString()).toBe("2026-06-03T15:00:00.000Z");

      // 2. Semana
      const semana = intervaloPeriodo("semana", agora);
      expect(semana.inicio.toISOString()).toBe("2026-06-01T03:00:00.000Z"); // Segunda-feira
      expect(semana.fim.toISOString()).toBe("2026-06-03T15:00:00.000Z");

      // 3. Mes
      const mes = intervaloPeriodo("mes", agora);
      expect(mes.inicio.toISOString()).toBe("2026-06-01T03:00:00.000Z"); // 1º do mês
      expect(mes.fim.toISOString()).toBe("2026-06-03T15:00:00.000Z");
    });
  });

  describe("Fatia 10: mensagemLembretePagamento e montarLinkWhatsApp", () => {
    it("deve gerar a mensagem com os parametros corretos e link wa.me válido", async () => {
      const { mensagemLembretePagamento, montarLinkWhatsApp } = await import("@/lib/whatsapp");

      const msg = mensagemLembretePagamento({
        clienteNome: "Maria",
        protocolo: "OS-1234",
        valor: "150.00",
        link: "http://localhost:3000/s/tok-123/pagar",
      });

      expect(msg).toContain("Maria");
      expect(msg).toContain("OS-1234");
      expect(msg).toContain("150.00");
      expect(msg).toContain("http://localhost:3000/s/tok-123/pagar");

      const link = montarLinkWhatsApp({
        whatsapp: "(11) 98765-4321",
        texto: msg,
      });

      expect(link).toBe(`https://wa.me/11987654321?text=${encodeURIComponent(msg)}`);
    });
  });
});
