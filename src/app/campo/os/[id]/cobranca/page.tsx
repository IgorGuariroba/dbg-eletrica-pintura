import { notFound } from "next/navigation";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { ordemServico, orcamento, cliente, solicitacao } from "@/db/schema";
import { exigirTecnico } from "@/app/campo/guard";
import { criarUpsellRepoDrizzle } from "@/financeiro/upsell/upsell-repo-drizzle";
import { CobrancaView } from "@/features/campo/components/cobranca-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CobrancaPage({ params }: PageProps) {
  await exigirTecnico();

  const { id } = await params;

  const [row] = await db
    .select({
      id: ordemServico.id,
      estado: ordemServico.estado,
      categoria: ordemServico.categoria,
      clienteId: cliente.id,
      clienteNome: cliente.nome,
    })
    .from(ordemServico)
    .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
    .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
    .where(eq(ordemServico.id, id))
    .limit(1);

  if (!row) {
    notFound();
  }

  const [orc] = await db
    .select({ total: orcamento.total })
    .from(orcamento)
    .where(and(eq(orcamento.osId, id), isNotNull(orcamento.aprovadoEm)))
    .orderBy(desc(orcamento.criadoEm))
    .limit(1);

  const valorTotal = orc?.total ?? "0.00";

  // Upsell pós-conclusão (#65): só pra cliente sem assinatura ativa.
  const oferecerAssinatura = !(await criarUpsellRepoDrizzle(
    db,
  ).temAssinaturaAtiva(row.clienteId));

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <CobrancaView
        osId={row.id}
        estadoInicial={row.estado}
        valorTotal={valorTotal}
        categoria={row.categoria}
        clienteNome={row.clienteNome}
        oferecerAssinatura={oferecerAssinatura}
      />
    </div>
  );
}
