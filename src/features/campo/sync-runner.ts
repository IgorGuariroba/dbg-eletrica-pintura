import { getCampoDb } from "./db";

// Helper to convert blob to base64 Data URL
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

let syncPromise: Promise<void> | null = null;

export async function sincronizarFilaOffline(): Promise<void> {
  if (syncPromise) return syncPromise;
  
  syncPromise = (async () => {
    const db = getCampoDb();
    
    // 1. Busca itens da fila com menos de 3 tentativas ordenados por ID (FIFO)
    const items = await db.fila_sync
      .filter((item) => item.tentativas < 3)
      .toArray();

    if (items.length === 0) {
      return;
    }

    // 2. Prepara os payloads (converte blobs de fotos em dataUrls)
    const itemsToSync = [];
    for (const item of items) {
      const payload: any = { ...(item.payload as any) };
      if (item.tipo === "FOTO" && payload.fotoId) {
        const fotoRecord = await db.fotos_pendentes.get(payload.fotoId);
        if (fotoRecord && fotoRecord.blob) {
          try {
            payload.dataUrl = await blobToDataUrl(fotoRecord.blob);
            payload.portfolio = fotoRecord.portfolio ?? false;
          } catch (e) {
            console.error("Erro ao converter blob de foto para dataURL:", e);
            await db.fila_sync.update(item.id!, {
              tentativas: item.tentativas + 1,
            });
            continue;
          }
        } else {
          // Se a foto não existir localmente, remove o item da fila para não travar
          await db.fila_sync.delete(item.id!);
          continue;
        }
      }
      itemsToSync.push({
        id: item.id,
        tipo: item.tipo,
        payload,
        criadoEm: item.criadoEm,
      });
    }

    if (itemsToSync.length === 0) {
      return;
    }

    // 3. Envia os itens ao servidor
    try {
      const response = await fetch("/api/campo/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(itemsToSync),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (!data || !Array.isArray(data.results)) {
        throw new Error("Formato de resposta inválido do servidor");
      }

      // 4. Processa o retorno de cada item
      for (const result of data.results) {
        const localItem = items.find((it) => it.id === result.id);
        if (!localItem) continue;

        if (result.success) {
          // Sucesso ou conflito resolvido/arquivado no servidor -> remove da fila local
          await db.transaction("rw", db.fila_sync, db.fotos_pendentes, async () => {
            await db.fila_sync.delete(localItem.id!);
            if (localItem.tipo === "FOTO") {
              const payload = localItem.payload as any;
              if (payload.fotoId) {
                await db.fotos_pendentes.delete(payload.fotoId);
              }
            }
          });
        } else {
          // Erro lógico retornado pelo servidor -> incrementa tentativa
          await db.fila_sync.update(localItem.id!, {
            tentativas: localItem.tentativas + 1,
          });
        }
      }
    } catch (error) {
      console.error("Erro durante a sincronização de rede:", error);
      // Incrementa tentativa de todos os itens em caso de erro de rede/HTTP
      for (const item of items) {
        await db.fila_sync.update(item.id!, {
          tentativas: item.tentativas + 1,
        });
      }
      throw error;
    }
  })().finally(() => {
    syncPromise = null;
  });

  return syncPromise;
}
