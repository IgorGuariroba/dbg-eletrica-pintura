import Dexie, { type Table } from "dexie";

/**
 * OS atribuída ao técnico, espelhada localmente para leitura offline.
 * `cacheEm` marca quando o registro foi gravado (para expiração/diagnóstico).
 */
export interface OsLocal {
  id: string;
  categoria: string;
  estado: string;
  clienteNome: string;
  cidade: string;
  uf: string;
  criadoEm: string;
  cacheEm: string;
}

/** Foto capturada offline aguardando upload (antes/depois). */
export interface FotoPendente {
  id?: number;
  osId: string;
  tipo: "ANTES" | "DEPOIS";
  blob: Blob;
  criadoEm: string;
}

/** Ação de negócio feita offline aguardando sincronização com o servidor. */
export interface FilaSync {
  id?: number;
  tipo: string;
  payload: unknown;
  criadoEm: string;
  tentativas: number;
}

export class CampoDB extends Dexie {
  os_local_cache!: Table<OsLocal, string>;
  fotos_pendentes!: Table<FotoPendente, number>;
  fila_sync!: Table<FilaSync, number>;

  constructor(name = "dbg-campo") {
    super(name);
    this.version(1).stores({
      os_local_cache: "id, estado, categoria, criadoEm",
      fotos_pendentes: "++id, osId, tipo",
      fila_sync: "++id, tipo",
    });
  }
}

let instancia: CampoDB | null = null;

/** Singleton do banco local. Só deve ser chamado no browser (IndexedDB). */
export function getCampoDb(): CampoDB {
  if (!instancia) instancia = new CampoDB();
  return instancia;
}
