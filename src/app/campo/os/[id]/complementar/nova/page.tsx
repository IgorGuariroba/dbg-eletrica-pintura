import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { listarServicos } from "@/catalogo/listar-servicos";
import { criarServicoRepoDrizzle } from "@/catalogo/servico-repo-drizzle";
import { db } from "@/db/client";
import { cliente, ordemServico, solicitacao } from "@/db/schema";
import { criarOperacaoConfigRepoDrizzle } from "@/operacao/config-repo-drizzle";
import { exigirTecnico } from "@/app/campo/guard";
import { ComplementarForm } from "@/features/campo/components/complementar-form";

export default async function NovaComplementarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tecnico = await exigirTecnico();
  const { id } = await params;

  const [pai] = await db
    .select({
      estado: ordemServico.estado,
      categoria: ordemServico.categoria,
      tecnicoId: ordemServico.tecnicoId,
      solToken: solicitacao.token,
      clienteNome: cliente.nome,
      whatsapp: cliente.whatsapp,
    })
    .from(ordemServico)
    .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
    .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
    .where(eq(ordemServico.id, id))
    .limit(1);

  // Complementar só faz sentido com a OS pai EM_EXECUÇÃO e atribuída a você.
  if (!pai || pai.estado !== "EM_EXECUCAO" || pai.tecnicoId !== tecnico.membroId) {
    redirect(`/campo/os/${id}`);
  }

  const [{ itens: servicos }, config] = await Promise.all([
    listarServicos(
      { categoria: pai.categoria, ativo: true, perPage: 100 },
      criarServicoRepoDrizzle(db),
    ),
    criarOperacaoConfigRepoDrizzle(db).obter(),
  ]);

  return (
    <ComplementarForm
      osPaiId={id}
      categoria={pai.categoria}
      servicos={servicos.map((s) => ({
        id: s.id,
        nome: s.nome,
        precoBase: s.precoBase,
      }))}
      config={{ precoLitro: config.precoLitro, kmPorLitro: config.kmPorLitro }}
      clienteNome={pai.clienteNome}
      whatsapp={pai.whatsapp}
      solToken={pai.solToken}
      tecnicoNome={tecnico.nome ?? "DBG"}
    />
  );
}
