import { ImageIcon } from "lucide-react";
import { db } from "@/db/client";
import { criarPortfolioRepoDrizzle } from "@/marketing/portfolio-repo-drizzle";
import { obterUrlLeituraAssinada } from "@/operacao/r2-privado";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { EmptyState } from "../../_components/empty-state";
import { exigirMarketing } from "../guard";
import { FotoReview } from "./foto-review";

const CATEGORIA_LABEL: Record<string, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

function formatarData(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export default async function PortfolioQueuePage() {
  await exigirMarketing();

  const pendentes = await criarPortfolioRepoDrizzle(db).listarPendentes();
  const itens = await Promise.all(
    pendentes.map(async (p) => ({
      ...p,
      url: await obterUrlLeituraAssinada(p.chavePrivada, 60 * 30),
    })),
  );

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Portfólio</h1>
        <p className="text-sm text-muted-foreground">
          {itens.length} foto{itens.length === 1 ? "" : "s"} aguardando
          aprovação. Fotos aprovadas aparecem no site e no perfil do técnico.
        </p>
      </div>

      {itens.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          titulo="Nenhuma foto pendente"
          descricao="Quando um técnico marcar uma foto como boa pra portfólio, ela aparece aqui para aprovação."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((f) => (
            <li key={f.id}>
              <Card className="overflow-hidden p-0">
                <div className="relative aspect-square bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.url}
                    alt={`Foto ${f.tipo === "ANTES" ? "antes" : "depois"} da OS`}
                    className="size-full object-cover"
                  />
                  <Badge className="absolute left-2 top-2" variant="secondary">
                    {f.tipo === "ANTES" ? "Antes" : "Depois"}
                  </Badge>
                </div>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{CATEGORIA_LABEL[f.categoria] ?? f.categoria}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatarData(f.criadoEm)}
                    </span>
                  </div>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Técnico: </span>
                    {f.tecnicoNome ?? "—"}
                  </p>
                  {f.notaServico && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {f.notaServico}
                    </p>
                  )}
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <FotoReview id={f.id} />
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
