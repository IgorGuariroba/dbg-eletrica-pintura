"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, CloudUpload, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCampoDb } from "@/features/campo/db";
import { sincronizarFilaOffline } from "@/features/campo/sync-runner";
import { toast } from "sonner";

export function SyncBadge() {
  const [pendingCount, setPendingCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Função para atualizar as contagens a partir do IndexedDB
  async function atualizarContagens() {
    try {
      const db = getCampoDb();
      const todos = await db.fila_sync.toArray();
      const pending = todos.filter((t) => t.tentativas < 3).length;
      const errors = todos.filter((t) => t.tentativas >= 3).length;
      setPendingCount(pending);
      setErrorCount(errors);
    } catch (e) {
      console.error("Erro ao ler contagens do IndexedDB:", e);
    }
  }

  // Registra Background Sync
  async function registrarBackgroundSync() {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "SyncManager" in window
    ) {
      try {
        const registration = await navigator.serviceWorker.ready;
        // @ts-ignore
        await registration.sync.register("sync-fila-campo");
      } catch (err) {
        console.warn("Background sync falhou ao registrar:", err);
      }
    }
  }

  // Executa o sincronismo
  async function dispararSincronismo(manual = false) {
    if (isSyncing) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (manual) {
        toast.warning("Você está sem internet no momento.");
      }
      return;
    }

    setIsSyncing(true);
    try {
      await registrarBackgroundSync();
      await sincronizarFilaOffline();
      await atualizarContagens();
      setLastSyncedAt(new Date());
      if (manual) {
        toast.success("Sincronização concluída!");
      }
    } catch (err: any) {
      console.error("Erro na sincronização:", err);
      await atualizarContagens();
      if (manual) {
        toast.error("Falha ao sincronizar: " + (err.message || "Erro de rede"));
      }
    } finally {
      setIsSyncing(false);
    }
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    // Carrega contagens iniciais
    // eslint-disable-next-line react-hooks/set-state-in-effect
    atualizarContagens();

    // Sincroniza se houver itens ao iniciar online
    if (navigator.onLine) {
      dispararSincronismo();
    }

    // Monitora transição para online
    const handleOnline = () => {
      dispararSincronismo();
    };

    window.addEventListener("online", handleOnline);

    // Polling leve a cada 4 segundos para atualizar o badge se houver novas ações offline
    const interval = setInterval(async () => {
      await atualizarContagens();
      const db = getCampoDb();
      const count = await db.fila_sync.count();
      if (count > 0 && navigator.onLine && !isSyncing) {
        dispararSincronismo();
      }
    }, 4000);

    return () => {
      window.removeEventListener("online", handleOnline);
      clearInterval(interval);
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  const total = pendingCount + errorCount;

  // Estado: Sincronizando
  if (isSyncing) {
    return (
      <Badge variant="secondary" className="gap-1 animate-pulse border-accent bg-accent/10 text-accent">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        Sincronizando...
      </Badge>
    );
  }

  // Estado: Erro crítico / Máximo de tentativas atingido
  if (errorCount > 0) {
    return (
      <Button
        variant="ghost"
        className="h-auto p-0 hover:bg-transparent"
        onClick={() => dispararSincronismo(true)}
        title="Clique para tentar sincronizar novamente"
        aria-label="Erro na sincronização. Clique para tentar novamente."
      >
        <Badge variant="destructive" className="gap-1 hover:brightness-110 transition-all cursor-pointer">
          <AlertCircle className="size-3" aria-hidden />
          Erro Sync ({errorCount})
        </Badge>
      </Button>
    );
  }

  // Estado: Itens pendentes aguardando conexão/sincronização
  if (pendingCount > 0) {
    return (
      <Button
        variant="ghost"
        className="h-auto p-0 hover:bg-transparent"
        onClick={() => dispararSincronismo(true)}
        title="Sincronizar agora"
        aria-label={`${pendingCount} itens pendentes para sincronizar. Clique para sincronizar agora.`}
      >
        <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-500 border-amber-500/20 animate-bounce cursor-pointer">
          <CloudUpload className="size-3" aria-hidden />
          {pendingCount} pendentes
        </Badge>
      </Button>
    );
  }

  // Estado: Tudo sincronizado (subtil)
  if (lastSyncedAt && total === 0) {
    return (
      <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 transition-all duration-500">
        <Check className="size-3" aria-hidden />
        Sincronizado
      </Badge>
    );
  }

  return null;
}
