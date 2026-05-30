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
  /** Geolocalização da captura (quando autorizada). */
  lat?: number;
  lon?: number;
  criadoEm: string;
}

/** Nota de serviço da OS (texto livre, uma por OS). */
export interface NotaServico {
  osId: string;
  texto: string;
  atualizadoEm: string;
}

/** Material consumido na execução, registrado offline. */
export interface MaterialConsumido {
  id?: number;
  osId: string;
  item: string;
  quantidade: number;
  observacao?: string;
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
  notas_servico!: Table<NotaServico, string>;
  materiais!: Table<MaterialConsumido, number>;
  fila_sync!: Table<FilaSync, number>;

  constructor(name = "dbg-campo") {
    super(name);
    this.version(1).stores({
      os_local_cache: "id, estado, categoria, criadoEm",
      fotos_pendentes: "++id, osId, tipo",
      fila_sync: "++id, tipo",
    });
    this.version(2).stores({
      // Índice composto [osId+tipo] acelera a contagem por OS e tipo de foto.
      fotos_pendentes: "++id, osId, tipo, [osId+tipo]",
      notas_servico: "osId",
      materiais: "++id, osId",
    });
  }
}

let instancia: CampoDB | null = null;

/** Singleton do banco local. Só deve ser chamado no browser (IndexedDB). */
export function getCampoDb(): CampoDB {
  if (!instancia) instancia = new CampoDB();
  return instancia;
}
