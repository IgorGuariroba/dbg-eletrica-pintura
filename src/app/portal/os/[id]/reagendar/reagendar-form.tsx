"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listarSlotsOsPortalAction, reagendarOsClienteAction } from "../actions";

const TZ = "America/Sao_Paulo";

const fmtDia = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  timeZone: TZ,
});

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

interface SlotOferecido {
  inicioISO: string;
}

function agruparPorDia(slots: SlotOferecido[]) {
  const grupos = new Map<string, { rotulo: string; slots: SlotOferecido[] }>();
  for (const slot of slots) {
    const d = new Date(slot.inicioISO);
    const chave = d.toLocaleDateString("en-CA", { timeZone: TZ });
    const grupo = grupos.get(chave) ?? { rotulo: fmtDia.format(d), slots: [] };
    grupo.slots.push(slot);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()];
}

export function ReagendarOsClientForm({
  osId,
  solicitacaoId,
}: {
  osId: string;
  solicitacaoId: string;
}) {
  const router = useRouter();
  const [slots, setSlots] = useState<SlotOferecido[] | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [confirmando, startConfirmar] = useTransition();

  useEffect(() => {
    async function carregarSlots() {
      try {
        const res = await listarSlotsOsPortalAction(osId);
        setSlots(res);
      } catch (err: any) {
        toast.error(err.message ?? "Erro ao carregar horários");
        setSlots([]);
      } finally {
        setCarregando(false);
      }
    }
    void carregarSlots();
  }, [osId]);

  function confirmar() {
    if (!selecionado) return;
    startConfirmar(async () => {
      const res = await reagendarOsClienteAction(osId, selecionado);
      if (res.erro) {
        toast.error(res.erro);
      } else {
        toast.success("Visita técnica reagendada com sucesso!");
        router.push(`/portal/solicitacao/${solicitacaoId}`);
      }
    });
  }

  const grupos = slots ? agruparPorDia(slots) : [];

  return (
    <div className="space-y-6">
      <div className="max-h-[50vh] space-y-6 overflow-y-auto pr-1">
        {carregando && (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-40 rounded" />
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3].map((j) => (
                    <Skeleton key={j} className="h-10 w-20 rounded-md" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!carregando && grupos.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
            Nenhum horário disponível nos próximos 14 dias.<br />
            Por favor, entre em contato via WhatsApp para podermos te agendar manualmente.
          </p>
        )}

        {!carregando &&
          grupos.map((grupo) => (
            <div key={grupo.rotulo} className="space-y-3">
              <p className="text-sm font-semibold capitalize text-foreground/80 flex items-center gap-2">
                <span className="inline-block size-1.5 rounded-full bg-primary" />
                {grupo.rotulo}
              </p>
              <div className="flex flex-wrap gap-2 pl-3">
                {grupo.slots.map((slot) => {
                  const dataSlot = new Date(slot.inicioISO);
                  const selecionadoAtualmente = selecionado === slot.inicioISO;
                  return (
                    <Button
                      key={slot.inicioISO}
                      type="button"
                      size="sm"
                      variant={selecionadoAtualmente ? "default" : "outline"}
                      className={`h-9 min-w-[70px] font-medium transition-all cursor-pointer ${
                        selecionadoAtualmente
                          ? "shadow-md scale-105"
                          : "hover:border-primary/50 hover:bg-primary/5"
                      }`}
                      onClick={() => setSelecionado(slot.inicioISO)}
                    >
                      {fmtHora.format(dataSlot)}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/60">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-1/2 cursor-pointer min-h-[44px]"
          onClick={() => router.push(`/portal/solicitacao/${solicitacaoId}`)}
          disabled={confirmando}
        >
          Voltar
        </Button>
        <Button
          type="button"
          className="w-full sm:w-1/2 font-bold cursor-pointer min-h-[44px] shadow-sm"
          disabled={!selecionado || confirmando}
          onClick={confirmar}
        >
          {confirmando ? "Reagendando…" : "Confirmar Novo Horário"}
        </Button>
      </div>
    </div>
  );
}
