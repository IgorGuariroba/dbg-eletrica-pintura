"use client";

import { Star, Share2, ExternalLink, Copy, Check } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";

interface RecompensasAvaliacaoProps {
  /** Link do Google Review (`g.page/...`). `null` esconde o card do Google. */
  googleReviewUrl: string | null;
  /** ID do cliente para gerar o link de indicação. */
  clienteId?: string;
  /** Valor (R$) do prêmio/desconto da campanha, vindo da config. Default "30.00". */
  valorPremio?: string;
}

/**
 * Cards de recompensa exibidos quando a Solicitação está qualificada pelo
 * Filtro Inteligente (todas as OS avaliadas ≥ 4★): avaliação no Google
 * (se houver URL configurada) + indicação ativa de indicação dupla.
 * Compartilhado entre o pós-submit da avaliação e o portal por token.
 */
export function RecompensasAvaliacao({ googleReviewUrl, clienteId, valorPremio = "30.00" }: RecompensasAvaliacaoProps) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const premioFmt = formatBRL(valorPremio);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setTimeout(() => {
        setOrigin(window.location.origin);
      }, 0);
    }
  }, []);

  const referralLink = clienteId && origin ? `${origin}/solicitar?ref=${clienteId}` : "";

  const handleCopy = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Link de indicação copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Erro ao copiar o link");
    }
  };

  const handleShare = async () => {
    if (!referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Indique a DBG Elétrica e Pintura",
          text: `Use meu link para solicitar um serviço na DBG e ganhe ${premioFmt} de desconto no seu primeiro orçamento!`,
          url: referralLink,
        });
      } catch (err) {
        // Silently catch share cancellation
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full items-center">
      {googleReviewUrl && (
        <Card className="w-full max-w-md border border-border bg-card p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-center gap-2 text-warning">
            <Star className="size-5 fill-current" />
            <span className="font-semibold text-foreground text-sm">Avalie-nos no Google</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Seu feedback positivo ajuda outros clientes a nos encontrarem e apoia nossa equipe!
          </p>
          <a
            href={googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ className: "w-full gap-2 text-sm font-medium cursor-pointer" })}
          >
            Avaliar no Google <ExternalLink className="size-4" />
          </a>
        </Card>
      )}

      {referralLink ? (
        <Card className="w-full max-w-md border border-border bg-card p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Share2 className="size-5" />
            <span className="font-semibold text-foreground text-sm">Indique e Ganhe {premioFmt}</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Compartilhe seu link com amigos. Eles ganham <strong className="text-foreground">{premioFmt}</strong> de desconto na primeira contratação, e você ganha <strong className="text-foreground">{premioFmt}</strong> em créditos quando o serviço deles for concluído e pago!
          </p>

          <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-md border border-border/60 w-full">
            <Input
              type="text"
              readOnly
              value={referralLink}
              className="h-auto flex-1 truncate border-0 bg-transparent px-1 text-xs text-muted-foreground shadow-none select-all focus-visible:ring-0"
            />
            <Button
              size="icon"
              variant="ghost"
              className="size-8 cursor-pointer"
              onClick={handleCopy}
              title="Copiar link"
              type="button"
            >
              {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
            </Button>
          </div>

          <Button onClick={handleShare} className="w-full gap-2 text-sm font-medium cursor-pointer">
            <Share2 className="size-4" /> Compartilhar Link
          </Button>
        </Card>
      ) : (
        <Card className="w-full max-w-md border border-dashed border-border bg-muted/20 p-6 opacity-70 space-y-3">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Share2 className="size-5" />
            <span className="font-semibold text-foreground text-sm">Indique e Ganhe (Em breve)</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Em breve você poderá indicar amigos e acumular créditos para descontos em seus próximos serviços!
          </p>
          <Button disabled variant="outline" className="w-full text-sm">
            Indicar Amigos (Em breve)
          </Button>
        </Card>
      )}
    </div>
  );
}

