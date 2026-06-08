import { CreditCard } from "lucide-react";
import type { AssinaturaCliente } from "@/assinatura/listar-assinaturas-cliente";
import type { StatusAssinatura } from "@/assinatura/assinatura-repo";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBRL } from "@/lib/utils";

const VARIANTE_STATUS: Record<
  StatusAssinatura,
  "default" | "secondary" | "outline" | "destructive"
> = {
  ATIVA: "default",
  PENDENTE: "outline",
  PAUSADA: "secondary",
  INADIMPLENTE: "destructive",
  CANCELADA: "destructive",
};

const LABEL_STATUS: Record<StatusAssinatura, string> = {
  ATIVA: "Ativa",
  PENDENTE: "Aguardando pagamento",
  PAUSADA: "Pausada",
  INADIMPLENTE: "Pagamento pendente",
  CANCELADA: "Cancelada",
};

interface Props {
  assinaturas: AssinaturaCliente[];
}

/** Seção "Minhas assinaturas" do portal do cliente. */
export function MinhasAssinaturas({ assinaturas }: Props) {
  if (assinaturas.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="size-5 text-muted-foreground" />
          Minhas assinaturas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {assinaturas.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-border p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{a.planoNome}</p>
              <p className="text-sm text-muted-foreground">
                {formatBRL(a.preco)} / mês
              </p>
            </div>
            <Badge variant={VARIANTE_STATUS[a.status]}>
              {LABEL_STATUS[a.status]}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
