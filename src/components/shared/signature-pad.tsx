"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SignaturePadHandle {
  /** PNG em data URL do traço sobre fundo branco. */
  toDataURL(): string;
  /** Limpa o canvas e o estado. */
  clear(): void;
  /** True se nenhum traço foi desenhado. */
  isEmpty(): boolean;
}

/**
 * Captura de assinatura manuscrita (touch + mouse) sobre fundo branco.
 * Não é um primitivo de formulário (button/input) — o <canvas> é a única
 * forma de capturar traço livre, então o uso da tag nativa é intencional.
 */
export const SignaturePad = forwardRef<
  SignaturePadHandle,
  { onChange?: (vazio: boolean) => void; className?: string }
>(function SignaturePad({ onChange, className }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const temTraco = useRef(false);
  const [vazio, setVazio] = useState(true);

  function ctx() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  // Ajusta a resolução interna ao tamanho real e pinta o fundo branco.
  function preparar() {
    const canvas = canvasRef.current;
    const c = ctx();
    if (!canvas || !c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    c.scale(ratio, ratio);
    // Cores vêm dos tokens semânticos (globals.css), não de hex cru: papel e
    // tinta da assinatura. O canvas 2D aceita oklch() das CSS vars.
    const tokens = getComputedStyle(document.documentElement);
    c.fillStyle = tokens.getPropertyValue("--signature-paper").trim();
    c.fillRect(0, 0, rect.width, rect.height);
    c.strokeStyle = tokens.getPropertyValue("--signature-ink").trim();
    c.lineWidth = 2.5;
    c.lineCap = "round";
    c.lineJoin = "round";
  }

  useEffect(() => {
    preparar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function iniciar(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const c = ctx();
    if (!c) return;
    desenhando.current = true;
    canvasRef.current?.setPointerCapture(e.pointerId);
    const p = pos(e);
    c.beginPath();
    c.moveTo(p.x, p.y);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    e.preventDefault();
    const c = ctx();
    if (!c) return;
    const p = pos(e);
    c.lineTo(p.x, p.y);
    c.stroke();
    if (!temTraco.current) {
      temTraco.current = true;
      setVazio(false);
      onChange?.(false);
    }
  }

  function terminar() {
    desenhando.current = false;
  }

  useImperativeHandle(ref, () => ({
    toDataURL: () => canvasRef.current?.toDataURL("image/png") ?? "",
    isEmpty: () => !temTraco.current,
    clear: () => {
      temTraco.current = false;
      setVazio(true);
      preparar();
      onChange?.(true);
    },
  }));

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="h-44 w-full touch-none rounded-lg border border-input bg-background"
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerLeave={terminar}
        aria-label="Área para o cliente assinar"
        role="img"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {vazio ? "Peça ao cliente para assinar acima" : "Assinatura registrada"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const c = ctx();
            if (!c) return;
            temTraco.current = false;
            setVazio(true);
            preparar();
            onChange?.(true);
          }}
        >
          <Eraser className="size-4" aria-hidden />
          Limpar
        </Button>
      </div>
    </div>
  );
});
