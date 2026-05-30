"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { lerOsCache, salvarOsCache } from "@/features/campo/cache-os";
import { getCampoDb, type OsLocal } from "@/features/campo/db";

const CATEGORIA_LABEL: Record<string, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

const ESTADO_LABEL: Record<string, string> = {
  NOVA: "Nova",
  ORCADA: "Orçada",
  APROVADA: "Aprovada",
  AGENDADA: "Agendada",
  A_CAMINHO: "A caminho",
  NO_LOCAL: "No local",
  EM_EXECUCAO: "Em execução",
  CONCLUIDA: "Concluída",
  PAGA: "Paga",
};

type Estado = "carregando" | "rede" | "cache" | "vazio";

function mapearOs(bruta: Record<string, unknown>): Omit<OsLocal, "cacheEm"> {
  return {
    id: String(bruta.id),
    categoria: String(bruta.categoria),
    estado: String(bruta.estado),
    clienteNome: String(bruta.clienteNome),
    cidade: String(bruta.cidade),
    uf: String(bruta.uf),
    criadoEm: String(bruta.criadoEm),
  };
}

export function OsAtribuidasList() {
  const [itens, setItens] = useState<OsLocal[]>([]);
  const [estado, setEstado] = useState<Estado>("carregando");

  useEffect(() => {
    const db = getCampoDb();
    let ativo = true;

    async function carregar() {
      const cache = await lerOsCache(db);
      if (ativo && cache.length) {
        setItens(cache);
        setEstado("cache");
      }

      try {
        const res = await fetch("/api/campo/os");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { itens: frescas } = (await res.json()) as {
          itens: Record<string, unknown>[];
        };
        await salvarOsCache(db, frescas.map(mapearOs));
        const atual = await lerOsCache(db);
        if (!ativo) return;
        setItens(atual);
        setEstado(atual.length ? "rede" : "vazio");
      } catch {
        if (ativo && !cache.length) setEstado("vazio");
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, []);

  if (estado === "carregando") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (estado === "vazio") {
    return (
      <p className="py-12 text-center text-base text-muted-foreground">
        Nenhuma OS atribuída a você no momento.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {itens.map((os) => (
        <li key={os.id}>
          <Card>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold">{os.clienteNome}</span>
                <Badge variant="secondary">
                  {ESTADO_LABEL[os.estado] ?? os.estado}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">
                  {CATEGORIA_LABEL[os.categoria] ?? os.categoria}
                </Badge>
                <span>
                  {os.cidade} · {os.uf}
                </span>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
