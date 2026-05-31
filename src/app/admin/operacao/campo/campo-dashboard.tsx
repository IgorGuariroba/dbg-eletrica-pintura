"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TecnicoEmCampo } from "@/operacao/campo-repo";
import type { Categoria, EstadoOs } from "@/operacao/fila-repo";
import type { EstadoCampo } from "@/operacao/campo-repo";
import { buscarTecnicosEmCampoAction } from "./actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ROTULO_ESTADO: Record<EstadoCampo, string> = {
  A_CAMINHO: "A caminho",
  NO_LOCAL: "No local",
  EM_EXECUCAO: "Em execução",
};

const VARIANTE_ESTADO: Record<
  EstadoCampo,
  "default" | "secondary" | "outline" | "destructive"
> = {
  A_CAMINHO: "secondary",
  NO_LOCAL: "outline",
  EM_EXECUCAO: "default",
};

function tempoDecorrido(desde: Date): string {
  const ms = Date.now() - new Date(desde).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

const ROTULO_CATEGORIA: Record<Categoria, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
interface Props {
  tecnicosIniciais: TecnicoEmCampo[];
}

export function CampoDashboard({ tecnicosIniciais }: Props) {
  const [tecnicos, setTecnicos] = useState(tecnicosIniciais);
  const [carregando, setCarregando] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(new Date());

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<EstadoCampo | "TODOS">(
    "TODOS",
  );
  const [filtroTecnico, setFiltroTecnico] = useState<string>("TODOS");
  const [filtroCategoria, setFiltroCategoria] = useState<Categoria | "TODOS">(
    "TODOS",
  );

  /**
   * Busca dados com os filtros fornecidos e atualiza o estado.
   * Não é um useCallback pois o polling usa uma ref para sempre ter
   * acesso aos filtros mais recentes sem re-criar o interval.
   */
  async function buscarComFiltro(
    estado: EstadoCampo | "TODOS",
    tecnicoId: string,
    categoria: Categoria | "TODOS",
  ) {
    setCarregando(true);
    try {
      const dados = await buscarTecnicosEmCampoAction({
        estado: estado !== "TODOS" ? (estado as EstadoCampo) : undefined,
        tecnicoId: tecnicoId !== "TODOS" ? tecnicoId : undefined,
        categoria:
          categoria !== "TODOS" ? (categoria as Categoria) : undefined,
      });
      setTecnicos(dados);
      setUltimaAtualizacao(new Date());
    } finally {
      setCarregando(false);
    }
  }

  // Ref sempre atualizada com os filtros correntes — usada pelo interval
  const filtrosRef = {
    estado: filtroEstado,
    tecnicoId: filtroTecnico,
    categoria: filtroCategoria,
  };

  const atualizar = useCallback(() => {
    void buscarComFiltro(
      filtrosRef.estado,
      filtrosRef.tecnicoId,
      filtrosRef.categoria,
    );
  }, [filtroEstado, filtroTecnico, filtroCategoria]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling a cada 30s — re-registrado quando filtros mudam
  useEffect(() => {
    const id = setInterval(atualizar, 30_000);
    return () => clearInterval(id);
  }, [atualizar]);

  // Técnicos únicos para o select de filtro
  const tecnicosUnicos = Array.from(
    new Map(
      tecnicosIniciais.map((t) => [t.tecnicoId, t.tecnicoNome]),
    ).entries(),
  );

  // ---------------------------------------------------------------------------
  // Render mobile: cards (>4 colunas → card)
  // ---------------------------------------------------------------------------
  function CardMobile({ linha }: { linha: TecnicoEmCampo }) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-foreground">{linha.tecnicoNome}</span>
          <Badge variant={VARIANTE_ESTADO[linha.estado]}>
            {ROTULO_ESTADO[linha.estado]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          OS {linha.osNumero} · {ROTULO_CATEGORIA[linha.categoria]}
        </p>
        <p className="text-sm text-foreground">{linha.clienteNome}</p>
        <p className="text-sm text-muted-foreground">{linha.endereco}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {tempoDecorrido(linha.ultimaTransicaoEm)}
          </span>
          <div className="flex items-center gap-2">
            {linha.inconsistente && (
              <Badge variant="destructive" className="gap-1 text-xs">
                <AlertTriangle className="h-3 w-3" />
                Sem foto antes
              </Badge>
            )}
            {linha.tecnicoWhatsapp && (
              <a
                href={`https://wa.me/${linha.tecnicoWhatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`WhatsApp de ${linha.tecnicoNome}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho com filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {/* Filtro Estado */}
          <Select
            value={filtroEstado}
            onValueChange={(v) => {
              const novoEstado = v as EstadoCampo | "TODOS";
              setFiltroEstado(novoEstado);
              void buscarComFiltro(novoEstado, filtroTecnico, filtroCategoria);
            }}
          >
            <SelectTrigger className="w-40" aria-label="Filtrar por estado">
              <SelectValue placeholder="Todos os estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os estados</SelectItem>
              <SelectItem value="A_CAMINHO">A caminho</SelectItem>
              <SelectItem value="NO_LOCAL">No local</SelectItem>
              <SelectItem value="EM_EXECUCAO">Em execução</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro Técnico */}
          <Select
            value={filtroTecnico}
            onValueChange={(v) => {
              const val = v ?? "TODOS";
              setFiltroTecnico(val);
              void buscarComFiltro(filtroEstado, val, filtroCategoria);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Filtrar por técnico">
              <SelectValue placeholder="Todos os técnicos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os técnicos</SelectItem>
              {tecnicosUnicos.map(([id, nome]) => (
                <SelectItem key={id} value={id}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro Categoria */}
          <Select
            value={filtroCategoria}
            onValueChange={(v) => {
              const novaCategoria = v as Categoria | "TODOS";
              setFiltroCategoria(novaCategoria);
              void buscarComFiltro(filtroEstado, filtroTecnico, novaCategoria);
            }}
          >
            <SelectTrigger className="w-36" aria-label="Filtrar por categoria">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todas as categorias</SelectItem>
              <SelectItem value="ELETRICA">Elétrica</SelectItem>
              <SelectItem value="PINTURA">Pintura</SelectItem>
              <SelectItem value="DRYWALL">Drywall</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Última atualização + botão refresh */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Atualizado às{" "}
            {ultimaAtualizacao.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              void buscarComFiltro(filtroEstado, filtroTecnico, filtroCategoria)
            }
            disabled={carregando}
            aria-label="Atualizar lista"
          >
            <RefreshCw
              className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {tecnicos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">
            Nenhum técnico em campo no momento.
          </p>
        </div>
      ) : (
        <>
          {/* Tabela — desktop */}
          <div className="hidden md:block">
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Técnico</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Tempo no estado</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tecnicos.map((linha) => (
                    <TableRow key={linha.osId}>
                      <TableCell className="font-medium">
                        {linha.tecnicoNome}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {linha.osNumero}
                      </TableCell>
                      <TableCell>
                        <Badge variant={VARIANTE_ESTADO[linha.estado]}>
                          {ROTULO_ESTADO[linha.estado]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tempoDecorrido(linha.ultimaTransicaoEm)}
                      </TableCell>
                      <TableCell>{linha.clienteNome}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {linha.endereco}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ROTULO_CATEGORIA[linha.categoria]}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {linha.inconsistente && (
                            <Badge
                              variant="destructive"
                              className="gap-1 text-xs whitespace-nowrap"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Sem foto antes
                            </Badge>
                          )}
                          {linha.tecnicoWhatsapp && (
                            <a
                              href={`https://wa.me/${linha.tecnicoWhatsapp}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`WhatsApp de ${linha.tecnicoNome}`}
                              className={buttonVariants({
                                variant: "ghost",
                                size: "sm",
                              })}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Cards — mobile */}
          <div className="md:hidden space-y-3">
            {tecnicos.map((linha) => (
              <CardMobile key={linha.osId} linha={linha} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
