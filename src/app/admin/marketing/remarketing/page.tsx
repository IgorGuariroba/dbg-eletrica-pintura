import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db/client";
import { criarConfigRemarketingRepoDrizzle } from "@/marketing/remarketing/config-repo-drizzle";
import { GATILHOS_REMARKETING } from "@/marketing/remarketing/gatilhos";
import { exigirMarketing } from "../guard";
import { RemarketingForm } from "./remarketing-form";

export const metadata: Metadata = {
  title: "Remarketing Configurável — DBG Admin",
};

export default async function RemarketingConfigPage() {
  await exigirMarketing();

  const repo = criarConfigRemarketingRepoDrizzle(db);
  const configs = await repo.listar();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Remarketing Configurável</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Gerencie e ative as ações automáticas de reengajamento de clientes.
          Você pode habilitar/desabilitar cada gatilho e ajustar os prazos (em dias).
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {configs.map((cfg) => {
          const meta = GATILHOS_REMARKETING[cfg.gatilho];
          return (
            <Card key={cfg.gatilho}>
              <CardHeader>
                <CardTitle>{meta.rotulo}</CardTitle>
                <CardDescription>
                  Gatilho identificador: <code>{cfg.gatilho}</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RemarketingForm
                  gatilho={cfg.gatilho}
                  ativoInicial={cfg.ativo}
                  prazosInicial={cfg.prazosDias}
                  unidade={meta.unidade}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
