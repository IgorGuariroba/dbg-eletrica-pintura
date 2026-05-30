import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { CampoDB } from "@/features/campo/db";
import {
  salvarFotoPendente,
  contarFotos,
  listarFotos,
  togglePortfolio,
  salvarNota,
  lerNota,
  adicionarMaterial,
  listarMateriais,
  contarPendentesSync,
  enfileirarTransicao,
} from "@/features/campo/execucao-repo";

function novoDb() {
  return new CampoDB(`teste-${Math.random().toString(36).slice(2)}`);
}

const blobFake = () => new Blob(["x"], { type: "image/jpeg" });

describe("execucao-repo — fotos", () => {
  let db: CampoDB;
  beforeEach(() => {
    db = novoDb();
  });

  it("persiste foto pendente e conta por OS e tipo", async () => {
    await salvarFotoPendente(db, {
      osId: "os-1",
      tipo: "ANTES",
      blob: blobFake(),
      lat: -23.5,
      lon: -46.6,
    });

    expect(await contarFotos(db, "os-1", "ANTES")).toBe(1);
    expect(await contarFotos(db, "os-1", "DEPOIS")).toBe(0);
  });

  it("foto nasce fora do portfólio e o toggle alterna a flag", async () => {
    await salvarFotoPendente(db, {
      osId: "os-1",
      tipo: "DEPOIS",
      blob: blobFake(),
    });
    const [foto] = await listarFotos(db, "os-1", "DEPOIS");
    expect(foto.portfolio).toBe(false);

    await togglePortfolio(db, foto.id);
    const [depois] = await listarFotos(db, "os-1", "DEPOIS");
    expect(depois.portfolio).toBe(true);

    await togglePortfolio(db, foto.id);
    const [denovo] = await listarFotos(db, "os-1", "DEPOIS");
    expect(denovo.portfolio).toBe(false);
  });

  it("guarda metadata (lat/lon/timestamp) na foto", async () => {
    await salvarFotoPendente(db, {
      osId: "os-1",
      tipo: "DEPOIS",
      blob: blobFake(),
      lat: -23.5,
      lon: -46.6,
    });
    const [foto] = await db.fotos_pendentes
      .where("osId")
      .equals("os-1")
      .toArray();
    expect(foto.lat).toBe(-23.5);
    expect(foto.lon).toBe(-46.6);
    expect(foto.criadoEm).toBeTruthy();
  });

  it("enfileira a foto em fila_sync", async () => {
    await salvarFotoPendente(db, {
      osId: "os-1",
      tipo: "ANTES",
      blob: blobFake(),
    });
    expect(await contarPendentesSync(db)).toBe(1);
  });
});

describe("execucao-repo — transição offline", () => {
  let db: CampoDB;
  beforeEach(() => {
    db = novoDb();
  });

  it("enfileira a transição com alvo e geo para sync posterior", async () => {
    await enfileirarTransicao(db, {
      osId: "os-1",
      alvo: "A_CAMINHO",
      lat: -23.5,
      lon: -46.6,
    });
    expect(await contarPendentesSync(db)).toBe(1);
    const [item] = await db.fila_sync.toArray();
    expect(item.tipo).toBe("TRANSICAO");
    expect(item.payload).toMatchObject({ osId: "os-1", alvo: "A_CAMINHO" });
  });
});

describe("execucao-repo — notas", () => {
  let db: CampoDB;
  beforeEach(() => {
    db = novoDb();
  });

  it("salva e relê a nota da OS (uma por OS)", async () => {
    await salvarNota(db, "os-1", "primeiro texto");
    await salvarNota(db, "os-1", "texto atualizado");
    expect(await lerNota(db, "os-1")).toBe("texto atualizado");
  });

  it("retorna string vazia quando não há nota", async () => {
    expect(await lerNota(db, "os-x")).toBe("");
  });
});

describe("execucao-repo — materiais", () => {
  let db: CampoDB;
  beforeEach(() => {
    db = novoDb();
  });

  it("adiciona materiais e lista por OS", async () => {
    await adicionarMaterial(db, "os-1", {
      item: "Fio 2.5mm",
      quantidade: 10,
      observacao: "metros",
    });
    await adicionarMaterial(db, "os-1", { item: "Disjuntor", quantidade: 1 });

    const itens = await listarMateriais(db, "os-1");
    expect(itens).toHaveLength(2);
    expect(itens[0].item).toBe("Fio 2.5mm");
  });
});
