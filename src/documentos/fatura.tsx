import { Text, View } from "@react-pdf/renderer";
import { formatBRL } from "@/lib/utils";
import { gerarPDF } from "./pdf/gerar-pdf";
import { PDFLayout, PDFSection, PDFTable } from "./pdf/componentes";

/** Item da fatura: serviço × quantidade × preço unitário = subtotal. */
export interface FaturaItemView {
  descricao: string;
  quantidade: string;
  precoUnitario: string;
  subtotal: string;
}

/** Dados prontos para renderizar a fatura (view-model, sem acesso a banco). */
export interface FaturaView {
  numeroOS: string;
  clienteNome: string;
  endereco: string;
  tecnicoNome: string;
  /** Data do pagamento, já formatada (pt-BR). */
  data: string;
  /** Forma de pagamento legível (ex.: "Pix", "Cartão de crédito"). */
  formaPagamento: string;
  /** Identificador do pagamento: payment_id do MP ou "manual". */
  identificador: string;
  itens: FaturaItemView[];
  totalDeslocamento: string;
  total: string;
}

const DISCLAIMER_FISCAL =
  "Este documento é um demonstrativo de serviço e pagamento, sem valor fiscal. " +
  "A nota fiscal eletrônica, quando aplicável, é emitida separadamente.";

/** Documento de fatura: dados do serviço, breakdown do orçamento e pagamento. */
export function FaturaPDF({ dados }: { dados: FaturaView }) {
  const linhas = dados.itens.map((it) => [
    it.descricao,
    it.quantidade,
    formatBRL(it.precoUnitario),
    formatBRL(it.subtotal),
  ]);

  return (
    <PDFLayout title={`Fatura - OS ${dados.numeroOS}`} subject="Fatura de servico">
      <PDFSection titulo={`Fatura — OS ${dados.numeroOS}`}>
        <Text>Cliente: {dados.clienteNome}</Text>
        <Text>Endereço: {dados.endereco}</Text>
        <Text>Técnico responsável: {dados.tecnicoNome}</Text>
      </PDFSection>

      <PDFSection titulo="Itens">
        <PDFTable
          colunas={["Serviço", "Qtd.", "Preço unit.", "Subtotal"]}
          linhas={linhas}
        />
      </PDFSection>

      <PDFSection titulo="Totais">
        <View>
          <Text>Deslocamento: {formatBRL(dados.totalDeslocamento)}</Text>
          <Text>Total: {formatBRL(dados.total)}</Text>
        </View>
      </PDFSection>

      <PDFSection titulo="Pagamento">
        <Text>Data: {dados.data}</Text>
        <Text>Forma de pagamento: {dados.formaPagamento}</Text>
        <Text>Identificador: {dados.identificador}</Text>
      </PDFSection>

      <PDFSection titulo="Observações">
        <Text>{DISCLAIMER_FISCAL}</Text>
      </PDFSection>
    </PDFLayout>
  );
}

/** Renderiza a fatura para um Buffer de PDF server-side. */
export function gerarFaturaPdf(dados: FaturaView): Promise<Buffer> {
  return gerarPDF(<FaturaPDF dados={dados} />, {
    titulo: `Fatura - OS ${dados.numeroOS}`,
    autor: "DBG Eletrica e Pintura",
    assunto: "Fatura de servico",
  });
}
