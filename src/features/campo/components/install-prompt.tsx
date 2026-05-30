"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Banner de instalação do PWA. Em Chrome/Android usa o evento
 * `beforeinstallprompt`; em iOS Safari (sem o evento) mostra instrução manual.
 */
function ehStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function ehIosSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|chrome/i.test(ua);
  return isIos && isSafari;
}

export function InstallPrompt() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone] = useState(ehStandalone);
  const [iosInstalavel] = useState(() => !ehStandalone() && ehIosSafari());
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    if (standalone) return;
    const aoPrompt = (e: Event) => {
      e.preventDefault();
      setEvento(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", aoPrompt);
    return () => window.removeEventListener("beforeinstallprompt", aoPrompt);
  }, [standalone]);

  if (fechado || (!evento && !iosInstalavel)) return null;

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    setEvento(null);
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
      <Download className="size-5 shrink-0 text-primary" aria-hidden />
      <p className="flex-1 text-sm">
        {evento
          ? "Instale o app para acessar suas OS offline."
          : "Para instalar: toque em Compartilhar e em “Adicionar à Tela de Início”."}
      </p>
      {evento ? (
        <Button size="sm" onClick={instalar}>
          Instalar
        </Button>
      ) : null}
      <Button
        size="icon"
        variant="ghost"
        aria-label="Dispensar"
        onClick={() => setFechado(true)}
      >
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
