import { Text, View } from "@react-pdf/renderer";
import { gerarPDF } from "./pdf/gerar-pdf";
import { PDFLayout, PDFSection } from "./pdf/componentes";

/** Dados prontos para renderizar o certificado (view-model, sem banco). */
export interface CertificadoView {
  numeroOS: string;
  clienteNome: string;
  /** Serviços executados cobertos pela garantia. */
  servicos: string[];
  /** Prazo de garantia em meses (vem do Catálogo / snapshot da OS). */
  prazoGarantiaMeses: number;
  /** Data de início da garantia (= data do pagamento), formatada pt-BR. */
  dataInicio: string;
  /** Data de fim da garantia, formatada pt-BR. */
  dataFim: string;
}

const SELO = "Garantia DBG";

/** Certificado de garantia de mão de obra de uma OS. */
export function CertificadoGarantiaPDF({ dados }: { dados: CertificadoView }) {
  return (
    <PDFLayout
      title={`Certificado de Garantia - OS ${dados.numeroOS}`}
      subject="Certificado de garantia"
    >
      <PDFSection titulo={`Certificado de Garantia — OS ${dados.numeroOS}`}>
        <Text>Cliente: {dados.clienteNome}</Text>
        <Text>Selo: {SELO}</Text>
      </PDFSection>

      <PDFSection titulo="Serviços cobertos">
        <View>
          {dados.servicos.map((s, i) => (
            <Text key={i}>• {s}</Text>
          ))}
        </View>
      </PDFSection>

      <PDFSection titulo="Vigência da garantia">
        <Text>Prazo: {dados.prazoGarantiaMeses} meses</Text>
        <Text>Início: {dados.dataInicio}</Text>
        <Text>Fim: {dados.dataFim}</Text>
      </PDFSection>
    </PDFLayout>
  );
}

/** Renderiza o certificado de garantia para um Buffer de PDF server-side. */
export function gerarCertificadoPdf(dados: CertificadoView): Promise<Buffer> {
  return gerarPDF(<CertificadoGarantiaPDF dados={dados} />, {
    titulo: `Certificado de Garantia - OS ${dados.numeroOS}`,
    autor: "DBG Eletrica e Pintura",
    assunto: "Certificado de garantia",
  });
}
