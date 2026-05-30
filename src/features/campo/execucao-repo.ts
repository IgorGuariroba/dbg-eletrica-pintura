import type { CampoDB, MaterialConsumido } from "./db";

type TipoFoto = "ANTES" | "DEPOIS";

export interface NovaFoto {
  osId: string;
  tipo: TipoFoto;
  blob: Blob;
  lat?: number;
  lon?: number;
}

/**
 * Persiste a foto comprimida no IndexedDB e a enfileira para sync. Tudo numa
 * transação: ou a foto e o item de fila gravam juntos, ou nada grava.
 */
export async function salvarFotoPendente(
  db: CampoDB,
  foto: NovaFoto,
): Promise<void> {
  const criadoEm = new Date().toISOString();
  await db.transaction("rw", db.fotos_pendentes, db.fila_sync, async () => {
    const id = await db.fotos_pendentes.add({
      osId: foto.osId,
      tipo: foto.tipo,
      blob: foto.blob,
      lat: foto.lat,
      lon: foto.lon,
      criadoEm,
    });
    await db.fila_sync.add({
      tipo: "FOTO",
      payload: { fotoId: id, osId: foto.osId, tipo: foto.tipo },
      criadoEm,
      tentativas: 0,
    });
  });
}

/** Conta fotos de uma OS por tipo (antes/depois). */
export function contarFotos(
  db: CampoDB,
  osId: string,
  tipo: TipoFoto,
): Promise<number> {
  return db.fotos_pendentes.where({ osId, tipo }).count();
}

/** Salva (ou substitui) a nota de serviço da OS e a enfileira para sync. */
export async function salvarNota(
  db: CampoDB,
  osId: string,
  texto: string,
): Promise<void> {
  const atualizadoEm = new Date().toISOString();
  await db.transaction("rw", db.notas_servico, db.fila_sync, async () => {
    await db.notas_servico.put({ osId, texto, atualizadoEm });
    await db.fila_sync.add({
      tipo: "NOTA",
      payload: { osId, texto },
      criadoEm: atualizadoEm,
      tentativas: 0,
    });
  });
}

/** Lê a nota da OS; string vazia se não houver. */
export async function lerNota(db: CampoDB, osId: string): Promise<string> {
  const nota = await db.notas_servico.get(osId);
  return nota?.texto ?? "";
}

/** Adiciona um material consumido e o enfileira para sync. */
export async function adicionarMaterial(
  db: CampoDB,
  osId: string,
  material: { item: string; quantidade: number; observacao?: string },
): Promise<void> {
  const criadoEm = new Date().toISOString();
  await db.transaction("rw", db.materiais, db.fila_sync, async () => {
    const id = await db.materiais.add({ osId, ...material, criadoEm });
    await db.fila_sync.add({
      tipo: "MATERIAL",
      payload: { materialId: id, osId, ...material },
      criadoEm,
      tentativas: 0,
    });
  });
}

/** Lista os materiais da OS na ordem de inclusão. */
export function listarMateriais(
  db: CampoDB,
  osId: string,
): Promise<MaterialConsumido[]> {
  return db.materiais.where("osId").equals(osId).sortBy("criadoEm");
}

/**
 * Enfileira uma transição de estado feita offline (A Caminho/Cheguei), com geo,
 * para o técnico não ficar bloqueado sem sinal. O sync efetivo é do slice 9.
 */
export async function enfileirarTransicao(
  db: CampoDB,
  transicao: { osId: string; alvo: string; lat?: number; lon?: number },
): Promise<void> {
  await db.fila_sync.add({
    tipo: "TRANSICAO",
    payload: transicao,
    criadoEm: new Date().toISOString(),
    tentativas: 0,
  });
}

/** Total de ações pendentes de sincronização (fotos, notas, materiais). */
export function contarPendentesSync(db: CampoDB): Promise<number> {
  return db.fila_sync.count();
}
