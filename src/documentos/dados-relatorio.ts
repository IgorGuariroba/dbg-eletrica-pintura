import type { Categoria } from "@/financeiro/planos/plano-repo";
import type { RelatorioPreventivaView } from "./relatorio-preventiva";
import { numeroCurtoOs } from "./dados-fatura";

/** Linha crua de resultado do checklist (snapshot da OS). */
export interface RelatorioItemInput {
  descricaoSnapshot: string;
  status: "OK" | "PROBLEMA" | "NA";
  observacao: string | null;
  fotoUrl: string | null;
}

/** Dados resolvidos para montar a view do relatório de inspeção. */
export interface RelatorioInput {
  osId: string;
  clienteNome: string;
  categoria: Categoria;
  dataVisita: Date;
  itens: RelatorioItemInput[];
  observacoesGerais?: string | null;
}

/** Constrói a view-model do relatório a partir dos resultados do checklist. */
export function montarDadosRelatorio(
  input: RelatorioInput,
): RelatorioPreventivaView {
  return {
    numeroOS: numeroCurtoOs(input.osId),
    clienteNome: input.clienteNome,
    categoria: input.categoria,
    dataVisita: input.dataVisita.toLocaleDateString("pt-BR"),
    itens: input.itens.map((i) => ({
      descricao: i.descricaoSnapshot,
      status: i.status,
      observacao: i.observacao ?? undefined,
      temFoto: Boolean(i.fotoUrl),
    })),
    observacoesGerais: input.observacoesGerais ?? undefined,
  };
}
