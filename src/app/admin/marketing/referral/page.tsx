import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db/client";
import { configReferral } from "@/db/schema";
import { exigirMarketing } from "../guard";
import { ReferralForm } from "./referral-form";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Programa de Indicação Dupla — DBG Admin",
};

export default async function ReferralConfigPage() {
  await exigirMarketing();

  const [config] = await db
    .select()
    .from(configReferral)
    .where(eq(configReferral.id, "default"))
    .limit(1);

  const ativoInicial = config?.ativo ?? true;
  const valorPremioInicial = config?.valorPremio ?? "30.00";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Programa de Indicação Dupla (Referral Loop)</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Gerencie a campanha de indicações. Quando um cliente indica outro, ambos ganham prêmios: o indicado ganha desconto no primeiro orçamento, e o indicador ganha crédito após a conclusão e pagamento do serviço do indicado.
        </p>
      </div>

      <div className="max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Configurações de Recompensa</CardTitle>
            <CardDescription>
              Ajuste as regras do programa de indicação ativa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReferralForm
              ativoInicial={ativoInicial}
              valorPremioInicial={valorPremioInicial}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
