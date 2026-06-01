import { describe, expect, it } from "vitest";
import { deveTransitarParaPaga } from "@/pagamento/processar-pagamento";

describe("deveTransitarParaPaga", () => {
  it("aprovado deve transitar para PAGA", () => {
    expect(deveTransitarParaPaga("approved")).toBe(true);
  });

  it("rejeitado ou cancelado não transita", () => {
    expect(deveTransitarParaPaga("rejected")).toBe(false);
    expect(deveTransitarParaPaga("cancelled")).toBe(false);
    expect(deveTransitarParaPaga("pending")).toBe(false);
  });
});
