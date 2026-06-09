"use client";

import React, { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button, buttonVariants } from "@/components/ui/button";
import { EstrelasInput } from "@/components/shared/estrelas-input";
import { RecompensasAvaliacao } from "@/components/shared/recompensas-avaliacao";
import { registrarAvaliacaoAction } from "../actions";
import { toast } from "sonner";
import { CheckCircle2, MessageSquare, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface OSInfo {
  id: string;
  tipo: string;
  estado: string;
  categoria: string;
  tecnicoId: string | null;
  tecnicoNome: string | null;
  avaliacao: {
    nota: number;
    comentarioOs: string | null;
  } | null;
}

interface SolicitacaoView {
  token: string;
  clienteNome: string;
  clienteId: string;
  solicitacaoId: string;
  comentarioGeral: string | null;
  ordens: OSInfo[];
}

interface FormAvaliacaoProps {
  token: string;
  view: SolicitacaoView;
  /** Valor (R$) do prêmio/desconto da campanha de indicação, vindo da config. */
  valorPremio?: string;
}

const LABEL_CATEGORIA: Record<string, string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

export function FormAvaliacao({ token, view, valorPremio }: FormAvaliacaoProps) {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [resultado, setResultado] = useState<{ qualificada: boolean; googleReviewUrl: string | null } | null>(null);

  const [avaliacoes, setAvaliacoes] = useState<Record<string, { nota: number; comentarioOs: string }>>(() => {
    const initial: Record<string, { nota: number; comentarioOs: string }> = {};
    for (const os of view.ordens) {
      initial[os.id] = {
        nota: os.avaliacao?.nota ?? 0,
        comentarioOs: os.avaliacao?.comentarioOs ?? "",
      };
    }
    return initial;
  });

  const [comentarioGeral, setComentarioGeral] = useState(view.comentarioGeral ?? "");

  const handleNotaChange = (osId: string, nota: number) => {
    setAvaliacoes((prev) => ({
      ...prev,
      [osId]: {
        ...prev[osId],
        nota,
      },
    }));
  };

  const handleComentarioChange = (osId: string, text: string) => {
    setAvaliacoes((prev) => ({
      ...prev,
      [osId]: {
        ...prev[osId],
        comentarioOs: text,
      },
    }));
  };

  const isFormValid = () => {
    return view.ordens.every((os) => {
      const rating = avaliacoes[os.id]?.nota;
      return rating >= 1 && rating <= 5;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) {
      toast.error("Por favor, atribua uma nota (estrelas) para todas as ordens de serviço.");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          avaliacoes: view.ordens.map((os) => ({
            osId: os.id,
            nota: avaliacoes[os.id].nota,
            comentarioOs: avaliacoes[os.id].comentarioOs.trim() || null,
          })),
          comentarioGeral: comentarioGeral.trim() || null,
        };

        const res = await registrarAvaliacaoAction(token, payload);
        toast.success("Avaliação enviada com sucesso!");
        setResultado(res);
        setSubmitted(true);
      } catch (err) {
        console.error(err);
        toast.error("Ocorreu um erro ao enviar sua avaliação. Tente novamente.");
      }
    });
  };

  if (submitted && resultado) {
    if (resultado.qualificada) {
      return (
        <Card className="mt-8 p-8 flex flex-col items-center text-center space-y-6 bg-success/5 border-success/20">
          <CheckCircle2 className="size-16 text-success" />
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Muito obrigado por sua avaliação!</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Sua opinião nos ajuda a manter a excelência nos serviços e a reconhecer os melhores profissionais.
            </p>
          </div>

          <RecompensasAvaliacao googleReviewUrl={resultado.googleReviewUrl} clienteId={view.clienteId} valorPremio={valorPremio} />

          <div className="flex gap-4 pt-2">
            <Link href={`/s/${token}`} className={buttonVariants({ variant: "outline" })}>
              Voltar para o Portal
            </Link>
          </div>
        </Card>
      );
    }

    return (
      <Card className="mt-8 p-8 flex flex-col items-center text-center space-y-6 bg-muted/10 border-border">
        <CheckCircle2 className="size-16 text-muted-foreground" />
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">Obrigado pelo seu feedback!</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Obrigado pelo feedback, vamos te procurar pra entender melhor como podemos melhorar a sua experiência.
          </p>
        </div>
        <div className="flex gap-4 pt-2">
          <Link href={`/s/${token}`} className={buttonVariants()}>
            Voltar para o Portal
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-8">
      <div className="space-y-6">
        {view.ordens.map((os) => (
          <Card key={os.id} className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3">
              <div>
                <h3 className="font-semibold text-foreground">
                  {LABEL_CATEGORIA[os.categoria] ?? os.categoria}
                </h3>
                {os.tecnicoNome && (
                  <p className="text-xs text-muted-foreground">
                    Técnico: <strong className="text-foreground">{os.tecnicoNome}</strong>
                  </p>
                )}
              </div>
              <div className="text-xs text-muted-foreground capitalize bg-muted/50 px-2 py-1 rounded">
                Status: {os.estado.toLowerCase()}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1">
                Nota da Ordem de Serviço <span className="text-destructive">*</span>
              </Label>
              <EstrelasInput
                value={avaliacoes[os.id]?.nota ?? 0}
                onChange={(star) => handleNotaChange(os.id, star)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`comentario-${os.id}`} className="text-sm font-medium text-muted-foreground">
                Comentários sobre esta OS (opcional)
              </Label>
              <Textarea
                id={`comentario-${os.id}`}
                placeholder="Como foi a execução do serviço deste técnico?"
                value={avaliacoes[os.id]?.comentarioOs ?? ""}
                onChange={(e) => handleComentarioChange(os.id, e.target.value)}
                disabled={isPending}
                className="min-h-20"
              />
            </div>
          </Card>
        ))}

        <Card className="p-6 space-y-4 border-dashed bg-muted/10">
          <div className="flex items-center gap-2 border-b pb-3">
            <MessageSquare className="size-5 text-primary" />
            <h3 className="font-semibold text-foreground">Avaliação Geral do Atendimento</h3>
          </div>
          <div className="space-y-2">
            <Label htmlFor="comentario-geral" className="text-sm font-medium text-muted-foreground">
              Comentário Geral sobre a Solicitação (opcional)
            </Label>
            <Textarea
              id="comentario-geral"
              placeholder="O que achou da pontualidade, atendimento no WhatsApp, etc?"
              value={comentarioGeral}
              onChange={(e) => setComentarioGeral(e.target.value)}
              disabled={isPending}
              className="min-h-24"
            />
          </div>
        </Card>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-4">
        <Link href={`/s/${token}`} className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft className="size-4 mr-2" /> Voltar sem avaliar
        </Link>
        <Button
          type="submit"
          disabled={isPending || !isFormValid()}
          className="w-full sm:w-auto h-10 px-8"
        >
          {isPending ? "Enviando..." : "Enviar Avaliação"}
        </Button>
      </div>
    </form>
  );
}
