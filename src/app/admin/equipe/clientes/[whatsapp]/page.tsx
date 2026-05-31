import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, User, Smartphone, Mail, ShieldAlert } from "lucide-react";
import { exigirEquipe } from "../../guard";
import { db } from "@/db/client";
import { cliente } from "@/db/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { BotaoDesvincular } from "./botao-desvincular";

export const metadata = {
  title: "Detalhes do Cliente — DBG Elétrica e Pintura",
};

interface PageProps {
  params: Promise<{
    whatsapp: string;
  }>;
}

export default async function DetalhesClientePage({ params }: PageProps) {
  await exigirEquipe();
  const { whatsapp } = await params;

  // Busca o cliente pelo WhatsApp
  const [cli] = await db
    .select()
    .from(cliente)
    .where(eq(cliente.whatsapp, whatsapp))
    .limit(1);

  if (!cli) {
    notFound();
  }

  const isVinculado = Boolean(cli.googleEmail);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/equipe" className={buttonVariants({ variant: "outline", size: "icon" }) + " size-8"}>
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Detalhes do Cliente</h1>
          <p className="text-xs text-muted-foreground">
            Gerencie o vínculo do cliente com o login Google
          </p>
        </div>
      </div>

      <Card className="border-border bg-card text-card-foreground shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-foreground">
                {cli.nome}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Cadastrado em {new Date(cli.criadoEm).toLocaleDateString("pt-BR")}
              </CardDescription>
            </div>
            <Badge variant={isVinculado ? "default" : "secondary"} className="w-fit">
              {isVinculado ? "Vínculo Google Ativo" : "Sem Vínculo Google"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Smartphone className="size-5 text-muted-foreground" />
              <div>
                <div className="text-xs font-semibold text-muted-foreground">WhatsApp</div>
                <div className="text-sm font-medium text-foreground">{cli.whatsapp}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-4">
              <User className="size-5 text-muted-foreground" />
              <div>
                <div className="text-xs font-semibold text-muted-foreground">ID do Cliente</div>
                <div className="text-sm font-medium text-foreground truncate max-w-[200px]" title={cli.id}>
                  {cli.id}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              Dados de Acesso e Contato
            </h3>
            
            <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
              <div>
                <div className="text-xs text-muted-foreground">E-mail de Contato (Solicitação)</div>
                <div className="text-sm font-medium text-foreground">{cli.email ?? "—"}</div>
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground">E-mail Google Vinculado (Acesso)</div>
                <div className="text-sm font-medium text-foreground">
                  {cli.googleEmail ?? <span className="text-muted-foreground italic text-xs">Nenhum</span>}
                </div>
              </div>
            </div>
          </div>

          {isVinculado && (
            <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 flex gap-3">
              <ShieldAlert className="size-5 text-warning shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-warning-foreground">Zona de Perigo</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ao desvincular, este cliente perderá o acesso às áreas privadas do portal (como histórico de ordens de serviço, orçamentos e faturas) até realizar uma nova vinculação com este ou outro número.
                </p>
                <div className="pt-3">
                  <BotaoDesvincular whatsapp={cli.whatsapp} />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
