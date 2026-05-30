"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Mostra um selo "Offline" quando o dispositivo perde conexão. */
export function OfflineBadge() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  if (online) return null;

  return (
    <Badge variant="secondary" className="gap-1">
      <WifiOff className="size-3" aria-hidden />
      Offline
    </Badge>
  );
}
