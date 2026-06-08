import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { CampoDB } from "@/features/campo/db";
import {
  ChecklistIncompletoError,
  finalizarChecklist,
  lerRespostas,
  salvarFotoItem,
  salvarRespostaItem,
} from "@/features/campo/checklist-repo";

function novoDb() {
  return new CampoDB(`teste-${Math.random().toString(36).slice(2)}`);
}

const blobFake = () => new Blob(["x"], { type: "image/jpeg" });

describe("checklist-repo offline — respostas", () => {
  let db: CampoDB;
  beforeEach(() => {
    db = novoDb();
  });

  it("salva resposta de item e relê por OS", async () => {
    await salvarRespostaItem(db, "os-1", "i1", {
      status: "OK",
      observacao: "tudo certo",
    });

    const respostas = await lerRespostas(db, "os-1");
    expect(respostas.i1).toMatchObject({
      status: "OK",
      observacao: "tudo certo",
      temFoto: false,
    });
  });

  it("anexa foto sem apagar status/observação já salvos", async () => {
    await salvarRespostaItem(db, "os-1", "i1", {
      status: "PROBLEMA",
      observacao: "fio exposto",
    });
    await salvarFotoItem(db, "os-1", "i1", blobFake());

    const respostas = await lerRespostas(db, "os-1");
    expect(respostas.i1).toMatchObject({
      status: "PROBLEMA",
      observacao: "fio exposto",
      temFoto: true,
    });
  });

  it("respostas sobrevivem a reabrir o banco (offline persist)", async () => {
    await salvarRespostaItem(db, "os-1", "i1", { status: "NA" });
    const nome = db.name;
    db.close();

    const reaberto = new CampoDB(nome);
    const respostas = await lerRespostas(reaberto, "os-1");
    expect(respostas.i1.status).toBe("NA");
  });
});

describe("checklist-repo offline — finalizar", () => {
  let db: CampoDB;
  const itens = [
    { id: "i1", descricao: "Disjuntores", exigeFoto: false },
    { id: "i2", descricao: "Tomadas", exigeFoto: true },
  ];
  beforeEach(() => {
    db = novoDb();
  });

  it("bloqueia conclusão com item exigeFoto sem foto", async () => {
    await salvarRespostaItem(db, "os-1", "i1", { status: "OK" });
    await salvarRespostaItem(db, "os-1", "i2", { status: "OK" });

    await expect(finalizarChecklist(db, "os-1", itens)).rejects.toThrow(
      ChecklistIncompletoError,
    );
    expect(await db.fila_sync.count()).toBe(0);
  });

  it("enfileira UM item CHECKLIST com todos os resultados quando completo", async () => {
    await salvarRespostaItem(db, "os-1", "i1", {
      status: "OK",
      observacao: "ok",
    });
    await salvarRespostaItem(db, "os-1", "i2", { status: "OK" });
    await salvarFotoItem(db, "os-1", "i2", blobFake());

    await finalizarChecklist(db, "os-1", itens);

    expect(await db.fila_sync.count()).toBe(1);
    const [item] = await db.fila_sync.toArray();
    expect(item.tipo).toBe("CHECKLIST");
    const payload = item.payload as {
      osId: string;
      resultados: Array<{ itemId: string; descricaoSnapshot: string; temFoto: boolean }>;
    };
    expect(payload.osId).toBe("os-1");
    expect(payload.resultados).toHaveLength(2);
    expect(payload.resultados[1]).toMatchObject({
      itemId: "i2",
      descricaoSnapshot: "Tomadas",
      temFoto: true,
    });
  });
});
