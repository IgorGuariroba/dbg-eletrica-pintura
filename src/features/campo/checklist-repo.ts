import {
  avaliarConclusao,
  type ItemChecklist,
  type RespostaChecklist,
  type StatusChecklist,
} from "@/operacao/checklist-conclusao";
import type { CampoDB } from "./db";

/** Item do template necessário para snapshot + regra de conclusão. */
export interface ItemTemplate {
  id: string;
  descricao: string;
  exigeFoto: boolean;
}

export interface RespostaLida {
  status: StatusChecklist;
  observacao?: string;
  temFoto: boolean;
}

/** Salva (ou substitui) o status/observação de um item, preservando a foto. */
export async function salvarRespostaItem(
  db: CampoDB,
  osId: string,
  itemId: string,
  resposta: { status: StatusChecklist; observacao?: string },
): Promise<void> {
  const atual = await db.checklist_local.get([osId, itemId]);
  await db.checklist_local.put({
    osId,
    itemId,
    status: resposta.status,
    observacao: resposta.observacao,
    fotoBlob: atual?.fotoBlob,
    atualizadoEm: new Date().toISOString(),
  });
}

/** Anexa (ou substitui) a foto de um item, preservando status/observação. */
export async function salvarFotoItem(
  db: CampoDB,
  osId: string,
  itemId: string,
  blob: Blob,
): Promise<void> {
  const atual = await db.checklist_local.get([osId, itemId]);
  await db.checklist_local.put({
    osId,
    itemId,
    status: atual?.status ?? "OK",
    observacao: atual?.observacao,
    fotoBlob: blob,
    atualizadoEm: new Date().toISOString(),
  });
}

/** Mapa itemId -> resposta lida (status/observação + se há foto local). */
export async function lerRespostas(
  db: CampoDB,
  osId: string,
): Promise<Record<string, RespostaLida>> {
  const linhas = await db.checklist_local.where("osId").equals(osId).toArray();
  const out: Record<string, RespostaLida> = {};
  for (const l of linhas) {
    out[l.itemId] = {
      status: l.status,
      observacao: l.observacao,
      temFoto: Boolean(l.fotoBlob),
    };
  }
  return out;
}

export class ChecklistIncompletoError extends Error {
  constructor(public readonly faltam: string[]) {
    super("Checklist incompleto: itens pendentes");
    this.name = "ChecklistIncompletoError";
  }
}

/**
 * Valida o checklist via regra de conclusão e, se completo, enfileira UM item
 * de sync (tipo CHECKLIST) com todos os resultados. As fotos ficam no
 * checklist_local; o sync-runner as hidrata em dataUrl no flush.
 */
export async function finalizarChecklist(
  db: CampoDB,
  osId: string,
  itens: ItemTemplate[],
): Promise<void> {
  const respostas = await lerRespostas(db, osId);

  const itensRegra: ItemChecklist[] = itens.map((i) => ({
    id: i.id,
    exigeFoto: i.exigeFoto,
  }));
  const respostasRegra: Record<string, RespostaChecklist> = {};
  for (const [itemId, r] of Object.entries(respostas)) {
    respostasRegra[itemId] = { status: r.status, temFoto: r.temFoto };
  }

  const { pode, faltam } = avaliarConclusao(itensRegra, respostasRegra);
  if (!pode) throw new ChecklistIncompletoError(faltam);

  const resultados = itens.map((i) => ({
    itemId: i.id,
    descricaoSnapshot: i.descricao,
    status: respostas[i.id].status,
    observacao: respostas[i.id].observacao ?? null,
    temFoto: respostas[i.id].temFoto,
  }));

  await db.fila_sync.add({
    tipo: "CHECKLIST",
    payload: { osId, resultados },
    criadoEm: new Date().toISOString(),
    tentativas: 0,
  });
}
