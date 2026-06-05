import { Star, Share2, ExternalLink } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface RecompensasAvaliacaoProps {
  /** Link do Google Review (`g.page/...`). `null` esconde o card do Google. */
  googleReviewUrl: string | null;
}

/**
 * Cards de recompensa exibidos quando a Solicitação está qualificada pelo
 * Filtro Inteligente (todas as OS avaliadas ≥ 4★): avaliação no Google
 * (se houver URL configurada) + indicação placeholder ("em breve", Fase 5).
 * Compartilhado entre o pós-submit da avaliação e o portal por token.
 */
export function RecompensasAvaliacao({ googleReviewUrl }: RecompensasAvaliacaoProps) {
  return (
    <>
      {googleReviewUrl && (
        <Card className="w-full max-w-md border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-center gap-2 text-warning">
            <Star className="size-5 fill-current" />
            <span className="font-semibold text-foreground text-sm">Avalie-nos no Google</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Seu feedback positivo ajuda outros clientes a nos encontrarem e apoia nossa equipe!
          </p>
          <a
            href={googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ className: "w-full gap-2 text-sm font-medium" })}
          >
            Avaliar no Google <ExternalLink className="size-4" />
          </a>
        </Card>
      )}

      <Card className="w-full max-w-md border border-dashed border-border bg-muted/20 p-6 opacity-70 space-y-3">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Share2 className="size-5" />
          <span className="font-semibold text-foreground text-sm">Indique e Ganhe (Em breve)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Em breve você poderá indicar amigos e acumular créditos para descontos em seus próximos serviços!
        </p>
        <Button disabled variant="outline" className="w-full text-sm">
          Indicar Amigos (Em breve)
        </Button>
      </Card>
    </>
  );
}
