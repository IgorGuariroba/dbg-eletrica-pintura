"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Servico } from "@/catalogo/servico-repo";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/utils";
import {
  ICONE_CATEGORIA,
  LABEL_UNIDADE,
  SERVICOS_POR_PAGINA,
} from "./servicos-grid.constants";

interface Props {
  categoria: Servico["categoria"];
  servicos: Servico[];
}

export function ServicosCategoria({ categoria, servicos }: Props) {
  const [pagina, setPagina] = useState(0);
  const IconeCat = ICONE_CATEGORIA[categoria];

  const totalPaginas = Math.ceil(servicos.length / SERVICOS_POR_PAGINA);
  const inicio = pagina * SERVICOS_POR_PAGINA;
  const items = servicos.slice(inicio, inicio + SERVICOS_POR_PAGINA);

  return (
    <div className="pt-2">
      {/* Grade de altura uniforme: cada card preenche a célula (h-full +
          flex-col), preço fixado na base. Sem masonry — alinhamento
          consistente mesmo com/sem foto. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => {
          const conteudo = (
            <>
              <div className="relative aspect-video bg-muted">
                {s.fotoUrl ? (
                  <Image
                    src={s.fotoUrl}
                    alt={s.nome}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground/30">
                    <IconeCat className="size-9" aria-hidden />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h4 className="font-semibold leading-snug text-balance">
                  {s.nome}
                </h4>
                <div className="mt-auto flex items-baseline justify-between pt-4">
                  <span className="text-xl font-bold font-mono">
                    {formatBRL(s.precoBase)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {LABEL_UNIDADE[s.unidade]}
                  </span>
                </div>
                {s.prazoGarantiaMeses > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Garantia de {s.prazoGarantiaMeses}{" "}
                    {s.prazoGarantiaMeses === 1 ? "mês" : "meses"}
                  </p>
                )}
              </div>
            </>
          );
          const classeCard =
            "flex h-full flex-col overflow-hidden rounded-xl border bg-card";
          // Serviço com slug tem landing própria — card vira link.
          return s.slug ? (
            <Link
              key={s.id}
              href={`/servicos/${s.slug}` as Route}
              className={`${classeCard} transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
            >
              {conteudo}
            </Link>
          ) : (
            <article key={s.id} className={classeCard}>
              {conteudo}
            </article>
          );
        })}
      </div>

      {totalPaginas > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
            disabled={pagina === 0}
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            Página {pagina + 1} de {totalPaginas}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
            disabled={pagina === totalPaginas - 1}
            aria-label="Próxima página"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
