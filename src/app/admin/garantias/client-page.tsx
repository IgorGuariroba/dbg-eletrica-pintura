"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wrench, ShieldAlert, CheckCircle, Search, Filter } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState } from "../_components/empty-state";
import { GarantiaCard } from "@/features/garantias/components/garantia-card";
import { AplicarGarantiaDialog } from "@/features/garantias/components/aplicar-garantia-dialog";
import { RejeitarGarantiaDialog } from "@/features/garantias/components/rejeitar-garantia-dialog";
import type { ChamadoPendenteLista } from "@/operacao/garantia/aplicar-garantia";

interface GarantiasClientPageProps {
  chamados: ChamadoPendenteLista[];
}

export default function GarantiasClientPage({ chamados }: GarantiasClientPageProps) {
  const router = useRouter();
  const [filtroCliente, setFiltroCliente] = React.useState("");
  const [soForaPrazo, setSoForaPrazo] = React.useState(false);
  const [soCompRejeitado, setSoCompRejeitado] = React.useState(false);

  const [chamadoParaAplicar, setChamadoParaAplicar] = React.useState<ChamadoPendenteLista | null>(null);
  const [chamadoParaRejeitar, setChamadoParaRejeitar] = React.useState<ChamadoPendenteLista | null>(null);

  const chamadosFiltrados = chamados.filter((c) => {
    const bateCliente =
      c.cliente.nome.toLowerCase().includes(filtroCliente.toLowerCase()) ||
      c.osOrigem.id.toLowerCase().includes(filtroCliente.toLowerCase()) ||
      c.id.toLowerCase().includes(filtroCliente.toLowerCase());
    const bateForaPrazo = !soForaPrazo || c.prazo.dentroDoPrazo === false;
    const bateCompRejeitado = !soCompRejeitado || c.temComplementarRejeitado === true;

    return bateCliente && bateForaPrazo && bateCompRejeitado;
  });

  const handleRefresh = () => {
    router.refresh();
  };

  const temFiltrosAtivos = filtroCliente !== "" || soForaPrazo || soCompRejeitado;

  return (
    <div className="max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Decisões de Garantia</h1>
          <p className="text-sm text-muted-foreground">
            {chamados.length} chamado{chamados.length === 1 ? "" : "s"} pendente{chamados.length === 1 ? "" : "s"} para análise.
          </p>
        </div>
        <Link
          href="/admin/garantias/registrar"
          className={buttonVariants({ variant: "outline" })}
        >
          Registrar acionamento manual
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-muted/40 p-4 rounded-lg border border-border">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, OS de origem ou ID do chamado..."
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            className="pl-9 bg-background border-input"
          />
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              id="fora-prazo"
              checked={soForaPrazo}
              onCheckedChange={setSoForaPrazo}
            />
            <Label htmlFor="fora-prazo" className="text-sm font-medium cursor-pointer">
              Só fora do prazo
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="comp-rejeitado"
              checked={soCompRejeitado}
              onCheckedChange={setSoCompRejeitado}
            />
            <Label htmlFor="comp-rejeitado" className="text-sm font-medium cursor-pointer">
              Só com complementar rejeitado
            </Label>
          </div>
        </div>
      </div>

      {/* Claims List */}
      {chamadosFiltrados.length === 0 ? (
        temFiltrosAtivos ? (
          <EmptyState
            icon={Filter}
            titulo="Nenhum chamado corresponde aos filtros"
            descricao="Tente limpar os filtros de busca ou os toggles para visualizar todos os chamados pendentes."
          />
        ) : (
          <EmptyState
            icon={CheckCircle}
            titulo="Tudo em dia!"
            descricao="Não existem chamados de garantia pendentes de julgamento neste momento."
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {chamadosFiltrados.map((c) => (
            <GarantiaCard
              key={c.id}
              chamado={c}
              onAplicar={setChamadoParaAplicar}
              onRejeitar={setChamadoParaRejeitar}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <AplicarGarantiaDialog
        key={chamadoParaAplicar ? `aplicar-${chamadoParaAplicar.id}` : "aplicar-none"}
        chamado={chamadoParaAplicar}
        isOpen={chamadoParaAplicar !== null}
        onClose={() => setChamadoParaAplicar(null)}
        onSuccess={handleRefresh}
      />

      <RejeitarGarantiaDialog
        key={chamadoParaRejeitar ? `rejeitar-${chamadoParaRejeitar.id}` : "rejeitar-none"}
        chamado={chamadoParaRejeitar}
        isOpen={chamadoParaRejeitar !== null}
        onClose={() => setChamadoParaRejeitar(null)}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
