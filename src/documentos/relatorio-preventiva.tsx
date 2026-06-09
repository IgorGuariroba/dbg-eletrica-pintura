import { Text, View } from "@react-pdf/renderer";
import { gerarPDF } from "./pdf/gerar-pdf";
import { PDFLayout, PDFSection, PDFTable } from "./pdf/componentes";

/** Status de um item do checklist, rotulado para leitura no relatório. */
const ROTULO_STATUS: Record<string, string> = {
  OK: "OK",
  PROBLEMA: "Problema",
  NA: "N/A",
};

/** Item do checklist na view do relatório. */
export interface RelatorioItemView {
  descricao: string;
  status: "OK" | "PROBLEMA" | "NA";
  observacao?: string;
  /** Há foto anexada (o anexo em si fica no R2, listado à parte). */
  temFoto: boolean;
}

/** View-model do relatório de inspeção da preventiva (sem banco). */
export interface RelatorioPreventivaView {
  numeroOS: string;
  clienteNome: string;
  categoria: string;
  /** Data da visita, formatada pt-BR. */
  dataVisita: string;
  itens: RelatorioItemView[];
  observacoesGerais?: string;
}

/** Relatório de inspeção de uma OS Preventiva (checklist + observações). */
export function RelatorioPreventivaPDF({
  dados,
}: {
  dados: RelatorioPreventivaView;
}) {
  return (
    <PDFLayout
      title={`Relatório de Inspeção - OS ${dados.numeroOS}`}
      subject="Relatório de inspeção preventiva"
    >
      <PDFSection titulo={`Relatório de Inspeção — OS ${dados.numeroOS}`}>
        <Text>Cliente: {dados.clienteNome}</Text>
        <Text>Categoria: {dados.categoria}</Text>
        <Text>Data da visita: {dados.dataVisita}</Text>
      </PDFSection>

      <PDFSection titulo="Itens inspecionados">
        <PDFTable
          colunas={["Item", "Status", "Observação", "Foto"]}
          linhas={dados.itens.map((i) => [
            i.descricao,
            ROTULO_STATUS[i.status],
            i.observacao ?? "—",
            i.temFoto ? "Sim" : "—",
          ])}
        />
      </PDFSection>

      {dados.observacoesGerais ? (
        <PDFSection titulo="Observações gerais">
          <View>
            <Text>{dados.observacoesGerais}</Text>
          </View>
        </PDFSection>
      ) : null}
    </PDFLayout>
  );
}

/** Renderiza o relatório de inspeção para um Buffer de PDF server-side. */
export function gerarRelatorioPreventivaPdf(
  dados: RelatorioPreventivaView,
): Promise<Buffer> {
  return gerarPDF(<RelatorioPreventivaPDF dados={dados} />, {
    titulo: `Relatório de Inspeção - OS ${dados.numeroOS}`,
    autor: "DBG Eletrica e Pintura",
    assunto: "Relatório de inspeção preventiva",
  });
}
