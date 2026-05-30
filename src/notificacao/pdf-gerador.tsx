/* eslint-disable jsx-a11y/alt-text */
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Image,
} from "@react-pdf/renderer";
import { CORES } from "./cores";

// Estilos baseados em Helvetica e nos tokens semânticos do projeto (ver ./cores)
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    color: CORES.texto,
    fontSize: 10,
    lineHeight: 1.5,
    backgroundColor: CORES.fundo,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: CORES.borda,
    paddingBottom: 15,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandName: {
    fontSize: 18,
    fontWeight: "bold",
    color: CORES.primaria,
  },
  docTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: CORES.mutedTexto,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: CORES.primaria,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: CORES.borda,
    paddingBottom: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  gridCol: {
    flex: 1,
    minWidth: 120,
    marginBottom: 5,
  },
  label: {
    fontWeight: "bold",
    color: CORES.mutedTexto,
    fontSize: 9,
  },
  value: {
    fontSize: 10,
    marginTop: 2,
  },
  table: {
    marginTop: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: CORES.borda,
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: CORES.mutedBg,
    borderBottomWidth: 1,
    borderBottomColor: CORES.borda,
    padding: 6,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: CORES.borda,
    padding: 6,
  },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1, textAlign: "right" },
  colSub: { flex: 1, textAlign: "right" },
  totalSection: {
    alignSelf: "flex-end",
    width: 200,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: CORES.borda,
    paddingTop: 6,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalGeral: {
    fontSize: 12,
    fontWeight: "bold",
    color: CORES.primaria,
    borderTopWidth: 1,
    borderTopColor: CORES.primaria,
    paddingTop: 4,
    marginTop: 4,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: CORES.borda,
    paddingTop: 10,
    textAlign: "center",
    fontSize: 8,
    color: CORES.mutedTexto,
  },
  photosSection: {
    marginTop: 15,
  },
  photoContainer: {
    width: "48%",
    marginRight: "2%",
    marginBottom: 10,
  },
  photoLabel: {
    fontSize: 8,
    color: CORES.mutedTexto,
    marginBottom: 2,
  },
  photoImage: {
    width: "100%",
    height: 120,
    objectFit: "cover",
    borderRadius: 4,
    backgroundColor: CORES.mutedBg,
  },
  signatureContainer: {
    marginTop: 20,
    alignSelf: "flex-end",
    alignItems: "center",
    width: 150,
  },
  signatureImage: {
    width: 120,
    height: 50,
    objectFit: "contain",
  },
  signatureLine: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: CORES.mutedTexto,
    marginTop: 5,
  },
});

// Tipagem dos dados de entrada
export interface DadosOrcamentoPdf {
  numeroOS: string;
  clienteNome: string;
  clienteWhatsapp: string;
  endereco: string;
  tecnicoNome: string;
  validade: string;
  itens: {
    descricao: string;
    quantidade: string;
    precoUnitario: string;
    subtotal: string;
  }[];
  totalMaoDeObra: string;
  totalDeslocamento: string;
  total: string;
}

export interface DadosConclusaoPdf {
  numeroOS: string;
  clienteNome: string;
  clienteWhatsapp: string;
  endereco: string;
  tecnicoNome: string;
  concluidoEm: string;
  observacoes: string | null;
  materiais: {
    item: string;
    quantidade: number;
  }[];
  assinaturaUrl?: string | null;
  fotosAntes?: string[];
  fotosDepois?: string[];
}

// Componente React PDF - Orçamento
const OrcamentoDocument: React.FC<{ dados: DadosOrcamentoPdf }> = ({ dados }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.brandName}>DBG Elétrica e Pintura</Text>
        <Text style={styles.docTitle}>ORÇAMENTO - OS {dados.numeroOS}</Text>
      </View>

      {/* Dados do Cliente e Técnico */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informações Gerais</Text>
        <View style={styles.grid}>
          <View style={styles.gridCol}>
            <Text style={styles.label}>Cliente</Text>
            <Text style={styles.value}>{dados.clienteNome}</Text>
          </View>
          <View style={styles.gridCol}>
            <Text style={styles.label}>WhatsApp</Text>
            <Text style={styles.value}>{dados.clienteWhatsapp}</Text>
          </View>
          <View style={styles.gridCol}>
            <Text style={styles.label}>Validade do Orçamento</Text>
            <Text style={styles.value}>{dados.validade}</Text>
          </View>
        </View>
        <View style={styles.grid}>
          <View style={styles.gridCol}>
            <Text style={styles.label}>Endereço do Serviço</Text>
            <Text style={styles.value}>{dados.endereco}</Text>
          </View>
          <View style={styles.gridCol}>
            <Text style={styles.label}>Técnico Responsável</Text>
            <Text style={styles.value}>{dados.tecnicoNome}</Text>
          </View>
        </View>
      </View>

      {/* Itens do Orçamento */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Serviços Orçados</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colDesc, { fontWeight: "bold" }]}>Descrição do Serviço</Text>
            <Text style={[styles.colQty, { fontWeight: "bold" }]}>Qtd</Text>
            <Text style={[styles.colPrice, { fontWeight: "bold" }]}>Unitário</Text>
            <Text style={[styles.colSub, { fontWeight: "bold" }]}>Subtotal</Text>
          </View>
          {dados.itens.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.descricao}</Text>
              <Text style={styles.colQty}>{Number(item.quantidade).toFixed(1)}</Text>
              <Text style={styles.colPrice}>R$ {Number(item.precoUnitario).toFixed(2)}</Text>
              <Text style={styles.colSub}>R$ {Number(item.subtotal).toFixed(2)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Valores Finais */}
      <View style={styles.totalSection}>
        <View style={styles.totalRow}>
          <Text style={styles.label}>Mão de Obra + Material:</Text>
          <Text style={styles.value}>R$ {Number(dados.totalMaoDeObra).toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.label}>Deslocamento:</Text>
          <Text style={styles.value}>R$ {Number(dados.totalDeslocamento).toFixed(2)}</Text>
        </View>
        <View style={[styles.totalRow, styles.totalGeral]}>
          <Text style={{ fontWeight: "bold", color: CORES.primaria }}>Total Geral:</Text>
          <Text style={{ fontWeight: "bold", color: CORES.primaria }}>R$ {Number(dados.total).toFixed(2)}</Text>
        </View>
      </View>

      {/* Rodapé */}
      <Text style={styles.footer}>
        DBG Elétrica e Pintura — CNPJ XX.XXX.XXX/XXXX-XX — Obrigado pela preferência!
      </Text>
    </Page>
  </Document>
);

// Componente React PDF - Conclusão
const ConclusaoDocument: React.FC<{ dados: DadosConclusaoPdf }> = ({ dados }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.brandName}>DBG Elétrica e Pintura</Text>
        <Text style={styles.docTitle}>RELATÓRIO DE CONCLUSÃO - OS {dados.numeroOS}</Text>
      </View>

      {/* Dados Gerais */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informações Gerais</Text>
        <View style={styles.grid}>
          <View style={styles.gridCol}>
            <Text style={styles.label}>Cliente</Text>
            <Text style={styles.value}>{dados.clienteNome}</Text>
          </View>
          <View style={styles.gridCol}>
            <Text style={styles.label}>WhatsApp</Text>
            <Text style={styles.value}>{dados.clienteWhatsapp}</Text>
          </View>
          <View style={styles.gridCol}>
            <Text style={styles.label}>Concluído Em</Text>
            <Text style={styles.value}>{dados.concluidoEm}</Text>
          </View>
        </View>
        <View style={styles.grid}>
          <View style={styles.gridCol}>
            <Text style={styles.label}>Endereço</Text>
            <Text style={styles.value}>{dados.endereco}</Text>
          </View>
          <View style={styles.gridCol}>
            <Text style={styles.label}>Técnico Responsável</Text>
            <Text style={styles.value}>{dados.tecnicoNome}</Text>
          </View>
        </View>
      </View>

      {/* Notas / Resolução */}
      {dados.observacoes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notas do Técnico / Resolução</Text>
          <Text style={{ fontSize: 9.5, lineHeight: 1.4 }}>{dados.observacoes}</Text>
        </View>
      )}

      {/* Materiais Utilizados */}
      {dados.materiais.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Materiais Utilizados</Text>
          <View style={[styles.table, { width: "70%" }]}>
            <View style={styles.tableHeader}>
              <Text style={{ flex: 3, fontWeight: "bold" }}>Item/Material</Text>
              <Text style={{ flex: 1, textAlign: "right", fontWeight: "bold" }}>Qtd</Text>
            </View>
            {dados.materiais.map((mat, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={{ flex: 3 }}>{mat.item}</Text>
                <Text style={{ flex: 1, textAlign: "right" }}>{mat.quantidade}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Fotos de Execução (Antes e Depois) */}
      {((dados.fotosAntes && dados.fotosAntes.length > 0) ||
        (dados.fotosDepois && dados.fotosDepois.length > 0)) && (
        <View style={[styles.section, styles.photosSection]}>
          <Text style={styles.sectionTitle}>Registro Fotográfico</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
            {dados.fotosAntes?.slice(0, 4).map((url, i) => (
              <View key={`antes-${i}`} style={styles.photoContainer} wrap={false}>
                <Text style={styles.photoLabel}>Antes (Foto {i + 1})</Text>
                <Image src={url} style={styles.photoImage} />
              </View>
            ))}
            {dados.fotosDepois?.slice(0, 4).map((url, i) => (
              <View key={`depois-${i}`} style={styles.photoContainer} wrap={false}>
                <Text style={styles.photoLabel}>Depois (Foto {i + 1})</Text>
                <Image src={url} style={styles.photoImage} />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Assinatura Presencial */}
      {dados.assinaturaUrl && (
        <View style={styles.signatureContainer}>
          <Image src={dados.assinaturaUrl} style={styles.signatureImage} />
          <View style={styles.signatureLine} />
          <Text style={{ fontSize: 7, color: CORES.mutedTexto, marginTop: 2 }}>
            Assinatura Digital do Cliente
          </Text>
        </View>
      )}

      {/* Rodapé */}
      <Text style={styles.footer}>
        DBG Elétrica e Pintura — CNPJ XX.XXX.XXX/XXXX-XX — Serviços Residenciais e Comerciais
      </Text>
    </Page>
  </Document>
);

// Funções de compilação expostas
export async function gerarPdfOrcamento(dados: DadosOrcamentoPdf): Promise<Buffer> {
  const doc = React.createElement(OrcamentoDocument, { dados }) as any;
  return await renderToBuffer(doc);
}

export async function gerarPdfConclusao(dados: DadosConclusaoPdf): Promise<Buffer> {
  const doc = React.createElement(ConclusaoDocument, { dados }) as any;
  return await renderToBuffer(doc);
}
