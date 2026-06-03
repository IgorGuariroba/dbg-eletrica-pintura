import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db/client";
import { criarTemplateRepo } from "@/notificacao/templates";
import { exigirOperacao } from "../guard";
import { TemplateForm } from "./template-form";

export const metadata: Metadata = {
  title: "Notificações — DBG Admin",
};

export default async function OperacaoNotificacoesPage() {
  await exigirOperacao();

  const templates = await criarTemplateRepo(db).listar();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Templates de Notificação</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Variáveis padrão de cada template proativo da Cloud API. Você edita
          apenas os valores dinâmicos (saudação, assinatura, link curto base) — o
          corpo do template é aprovado pela Meta e não é alterado aqui.
        </p>
      </div>

      {templates.map((tpl) => (
        <Card key={tpl.nome}>
          <CardHeader>
            <CardTitle>{tpl.rotulo}</CardTitle>
            <CardDescription>
              <code>{tpl.nome}</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TemplateForm nome={tpl.nome} variaveis={tpl.variaveis} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
