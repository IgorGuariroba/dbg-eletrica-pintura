import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cliente,
  orcamento,
  orcamentoItem,
  ordemServico,
  servico,
  solicitacao,
} from "@/db/schema";
import { exigirTecnico } from "@/app/campo/guard";
import { AprovacaoPresencialView } from "@/features/campo/components/aprovacao-presencial-view";

export default async function AprovacaoPresencialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirTecnico();
  const { id } = await params;

  const [os] = await db
    .select({
      estado: ordemServico.estado,
      tipo: ordemServico.tipo,
      origem: solicitacao.origem,
      clienteNome: cliente.nome,
    })
    .from(ordemServico)
    .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
    .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
    .where(eq(ordemServico.id, id))
    .limit(1);

  if (!os) {
    return (
      <p className="py-12 text-center text-base text-muted-foreground">
        OS não encontrada.
      </p>
    );
  }

  const [orc] = await db
    .select({
      id: orcamento.id,
      totalMaoDeObra: orcamento.totalMaoDeObra,
      totalDeslocamento: orcamento.totalDeslocamento,
      total: orcamento.total,
    })
    .from(orcamento)
    .where(eq(orcamento.osId, id))
    .orderBy(desc(orcamento.criadoEm))
    .limit(1);

  const itens = orc
    ? await db
        .select({
          nome: servico.nome,
          quantidade: orcamentoItem.quantidade,
          subtotal: orcamentoItem.subtotal,
        })
        .from(orcamentoItem)
        .innerJoin(servico, eq(orcamentoItem.servicoId, servico.id))
        .where(eq(orcamentoItem.orcamentoId, orc.id))
    : [];

  return (
    <AprovacaoPresencialView
      osId={id}
      estado={os.estado}
      isExpress={os.origem === "EXPRESS_TECNICO"}
      clienteNome={os.clienteNome}
      resumo={
        orc
          ? {
              totalMaoDeObra: orc.totalMaoDeObra,
              totalDeslocamento: orc.totalDeslocamento,
              total: orc.total,
              itens,
            }
          : null
      }
    />
  );
}
