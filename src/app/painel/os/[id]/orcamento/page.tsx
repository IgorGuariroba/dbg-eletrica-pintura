import { redirect } from "next/navigation";
import { listarServicos } from "@/catalogo/listar-servicos";
import { criarServicoRepoDrizzle } from "@/catalogo/servico-repo-drizzle";
import { db } from "@/db/client";
import { criarOperacaoConfigRepoDrizzle } from "@/operacao/config-repo-drizzle";
import { criarOrcamentoRepoDrizzle } from "@/operacao/orcamento-repo-drizzle";
import { exigirFila } from "../../../guard";
import { OrcamentoForm } from "./orcamento-form";

export default async function OrcamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { usuario } = await exigirFila();

  const os = await criarOrcamentoRepoDrizzle(db).carregarOsParaOrcamento(id);
  // Só o técnico atribuído monta orçamento de uma OS ainda NOVA.
  if (
    !os ||
    os.estado !== "NOVA" ||
    !usuario.membroId ||
    os.tecnicoId !== usuario.membroId
  ) {
    redirect("/painel/fila");
  }

  const [{ itens: servicos }, config] = await Promise.all([
    listarServicos(
      { categoria: os.categoria, ativo: true, perPage: 100 },
      criarServicoRepoDrizzle(db),
    ),
    criarOperacaoConfigRepoDrizzle(db).obter(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Montar orçamento</h1>
        <p className="text-sm text-muted-foreground">
          Categoria {os.categoria} · serviços do catálogo
        </p>
      </div>
      <OrcamentoForm
        osId={os.id}
        servicos={servicos.map((s) => ({
          id: s.id,
          nome: s.nome,
          precoBase: s.precoBase,
        }))}
        config={{ precoLitro: config.precoLitro, kmPorLitro: config.kmPorLitro }}
      />
    </div>
  );
}
