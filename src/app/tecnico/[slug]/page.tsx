import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, UserCheck } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function TecnicoPerfilPage({ params }: Props) {
  const { slug } = await params;
  const repo = criarMembroRepoDrizzle(db);
  const tecnico = await repo.buscarPorSlug(slug);

  if (!tecnico || !tecnico.isTecnico || !tecnico.ativo) {
    notFound();
  }

  const inicial = tecnico.nome.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-dvh items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md shadow-lg border border-border">
        <CardHeader className="flex flex-col items-center text-center space-y-3 pb-4">
          <Avatar className="size-24 border-2 border-primary/20 shadow-sm">
            {tecnico.fotoUrl && (
              <AvatarImage src={tecnico.fotoUrl} alt={tecnico.nome} className="object-cover" />
            )}
            <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
              {inicial}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {tecnico.nome}
            </CardTitle>
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              {tecnico.especialidades.map((esp) => (
                <Badge key={esp} variant="secondary" className="text-xs uppercase tracking-wider font-semibold">
                  {esp}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          {tecnico.bio && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Sobre</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line bg-muted/20 p-3 rounded-lg border border-border/40">
                {tecnico.bio}
              </p>
            </div>
          )}

          <div className="space-y-3 border-t pt-4 border-border">
            <div className="flex items-center gap-3 text-sm">
              <ShieldCheck className="size-5 text-emerald-500 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold text-foreground">Garantia Padrão</p>
                <p className="text-xs text-muted-foreground">90 dias de garantia em todos os serviços executados.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <UserCheck className="size-5 text-primary shrink-0" aria-hidden />
              <div>
                <p className="font-semibold text-foreground">Profissional DBG</p>
                <p className="text-xs text-muted-foreground">Técnico qualificado, avaliado e homologado.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
