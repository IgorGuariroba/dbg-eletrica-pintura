import { describe, expect, it } from "vitest";
import type {
  AssinaturaRepo,
  PatchAssinatura,
} from "@/assinatura/assinatura-repo";
import { pausarAssinatura } from "@/assinatura/pausar-assinatura";

function fakeRepo() {
  const patches: { id: string; patch: PatchAssinatura }[] = [];
  const repo = {
    async atualizarStatus(id: string, patch: PatchAssinatura) {
      patches.push({ id, patch });
    },
  } as AssinaturaRepo;
  return { repo, patches };
}

describe("pausarAssinatura", () => {
  it("pausa no MP e reflete PAUSADA no banco", async () => {
    const { repo, patches } = fakeRepo();
    const pausados: string[] = [];

    await pausarAssinatura("pre-1", {
      gateway: { async pausarAssinatura(id) { pausados.push(id); } },
      repo,
    });

    expect(pausados).toEqual(["pre-1"]);
    expect(patches).toEqual([{ id: "pre-1", patch: { status: "PAUSADA" } }]);
  });
});
