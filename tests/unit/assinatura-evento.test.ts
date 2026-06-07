import { describe, expect, it } from "vitest";
import type {
  AssinaturaRepo,
  PatchAssinatura,
} from "@/assinatura/assinatura-repo";
import { processarEventoAssinatura } from "@/assinatura/processar-evento";

/**
 * Fake em memória do repositório: observa o último patch aplicado por
 * preapproval_id e registra event_ids vistos (idempotência).
 */
function fakeRepo() {
  const patches = new Map<string, PatchAssinatura>();
  const eventos = new Set<string>();
  const repo: AssinaturaRepo = {
    async criar() {
      return { id: "ass-fake" };
    },
    async registrarEvento(e) {
      if (eventos.has(e.eventId)) return false;
      eventos.add(e.eventId);
      return true;
    },
    async atualizarStatus(preapprovalId, patch) {
      patches.set(preapprovalId, patch);
    },
  };
  const status = {
    get: (id: string) => patches.get(id)?.status,
  };
  return { repo, status, patches, eventos };
}

describe("processarEventoAssinatura", () => {
  it("evento authorized deixa a assinatura ATIVA", async () => {
    const { repo, status } = fakeRepo();

    const out = await processarEventoAssinatura(
      { eventId: "evt-1", preapprovalIdMp: "pre-1", tipo: "authorized" },
      { repo },
    );

    expect(out.aplicado).toBe(true);
    expect(status.get("pre-1")).toBe("ATIVA");
  });

  it("evento paused deixa a assinatura PAUSADA", async () => {
    const { repo, status } = fakeRepo();

    await processarEventoAssinatura(
      { eventId: "evt-2", preapprovalIdMp: "pre-1", tipo: "paused" },
      { repo },
    );

    expect(status.get("pre-1")).toBe("PAUSADA");
  });

  it("evento cancelled deixa CANCELADA e carimba cancelado_em", async () => {
    const { repo, status, patches } = fakeRepo();
    const agora = new Date("2026-06-07T12:00:00Z");

    await processarEventoAssinatura(
      {
        eventId: "evt-3",
        preapprovalIdMp: "pre-1",
        tipo: "cancelled",
        motivo: "cliente pediu",
      },
      { repo },
      agora,
    );

    expect(status.get("pre-1")).toBe("CANCELADA");
    expect(patches.get("pre-1")?.canceladoEm).toEqual(agora);
    expect(patches.get("pre-1")?.motivoCancelamento).toBe("cliente pediu");
  });

  it("payment_failed deixa INADIMPLENTE e dispara notificarFalha", async () => {
    const { repo, status } = fakeRepo();
    const falhas: string[] = [];

    await processarEventoAssinatura(
      { eventId: "evt-4", preapprovalIdMp: "pre-1", tipo: "payment_failed" },
      { repo, notificarFalha: (id) => falhas.push(id) },
    );

    expect(status.get("pre-1")).toBe("INADIMPLENTE");
    expect(falhas).toEqual(["pre-1"]);
  });

  it("payment_recovered volta a assinatura para ATIVA", async () => {
    const { repo, status } = fakeRepo();

    await processarEventoAssinatura(
      { eventId: "evt-5", preapprovalIdMp: "pre-1", tipo: "payment_recovered" },
      { repo },
    );

    expect(status.get("pre-1")).toBe("ATIVA");
  });

  it("evento created deixa a assinatura PENDENTE", async () => {
    const { repo, status } = fakeRepo();

    await processarEventoAssinatura(
      { eventId: "evt-6", preapprovalIdMp: "pre-1", tipo: "created" },
      { repo },
    );

    expect(status.get("pre-1")).toBe("PENDENTE");
  });

  it("evento duplicado (mesmo event_id) não reaplica", async () => {
    const { repo, status } = fakeRepo();
    const evt = {
      eventId: "evt-dup",
      preapprovalIdMp: "pre-1",
      tipo: "authorized" as const,
    };

    const primeira = await processarEventoAssinatura(evt, { repo });
    // 2ª chamada: troca o tipo para provar que o efeito NÃO é reaplicado.
    const segunda = await processarEventoAssinatura(
      { ...evt, tipo: "cancelled" },
      { repo },
    );

    expect(primeira.aplicado).toBe(true);
    expect(segunda.aplicado).toBe(false);
    expect(status.get("pre-1")).toBe("ATIVA");
  });
});
