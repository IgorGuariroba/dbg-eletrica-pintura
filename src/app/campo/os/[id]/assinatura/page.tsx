import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ordemServico, solicitacao, cliente } from "@/db/schema";
import { exigirTecnico } from "@/app/campo/guard";
import { criarPlanoRepoDrizzle } from "@/financeiro/planos/plano-repo-drizzle";
import {
  AssinaturaPresencialView,
  type PlanoOferta,
} from "@/features/assinatura/components/assinatura-presencial-view";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AssinaturaCampoPage({ params }: PageProps) {
  await exigirTecnico();
  const { id } = await params;

  const [row] = await db
    .select({
      estado: ordemServico.estado,
      clienteNome: cliente.nome,
    })
    .from(ordemServico)
    .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
    .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
    .where(eq(ordemServico.id, id))
    .limit(1);

  if (!row) notFound();

  if (row.estado !== "CONCLUIDA") {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Assinatura indisponível
            </CardTitle>
            <CardDescription>
              A oferta de assinatura só fica disponível quando a ordem de serviço
              está concluída.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const planos = await criarPlanoRepoDrizzle(db).listarAtivos();
  const ofertas: PlanoOferta[] = planos
    .filter((p) => p.slug)
    .map((p) => ({
      slug: p.slug!,
      nome: p.nome,
      preco: p.preco,
      percentualDesconto: p.percentualDesconto,
      preventivasPorAno: p.preventivasPorAno,
      prioridadeAgendamento: p.prioridadeAgendamento,
    }));

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <AssinaturaPresencialView
        osId={id}
        clienteNome={row.clienteNome}
        planos={ofertas}
      />
    </div>
  );
}
