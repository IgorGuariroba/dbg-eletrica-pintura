import { readFileSync } from "node:fs";
import path from "node:path";
import type { PropsWithChildren, ReactNode } from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { dadosEmpresa } from "@/documentos/dados-empresa";

/** Carrega o logo DBG uma única vez; ausência vira placeholder textual. */
function carregarLogo(): Buffer | null {
  try {
    return readFileSync(
      path.join(process.cwd(), "assets/images/branding/01-logo-dbg.jpeg"),
    );
  } catch {
    return null;
  }
}
const LOGO = carregarLogo();

const cores = {
  texto: "#1a1a1a",
  suave: "#6b7280",
  borda: "#e5e7eb",
  fundoCabecalho: "#f3f4f6",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontSize: 10,
    color: cores.texto,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  logo: { width: 48, height: 48, objectFit: "contain" },
  logoPlaceholder: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  headerNome: { marginLeft: 12, fontSize: 14, fontFamily: "Helvetica-Bold" },
  corpo: { flexGrow: 1 },
  section: { marginBottom: 16 },
  sectionTitulo: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: cores.fundoCabecalho,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  cell: { flex: 1, padding: 6 },
  cellHeader: { flex: 1, padding: 6, fontFamily: "Helvetica-Bold" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
    fontSize: 8,
    color: cores.suave,
    textAlign: "center",
  },
});

export interface PDFLayoutProps {
  /** Metadados — injetados por `gerarPDF` no `<Document>` raiz. */
  title?: string;
  author?: string;
  subject?: string;
}

/** Cabeçalho com logo DBG (ou placeholder textual) e nome da empresa. */
function PDFHeader() {
  const empresa = dadosEmpresa();
  return (
    <View style={styles.header}>
      {LOGO ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- Image do @react-pdf, não é <img> do DOM
        <Image style={styles.logo} src={LOGO} />
      ) : (
        <Text style={styles.logoPlaceholder}>DBG</Text>
      )}
      <Text style={styles.headerNome}>{empresa.razaoSocial}</Text>
    </View>
  );
}

/** Rodapé fixo com os dados da empresa (CNPJ, endereço, contato). */
export function PDFFooter() {
  const e = dadosEmpresa();
  return (
    <View style={styles.footer} fixed>
      <Text>
        {e.razaoSocial} · CNPJ {e.cnpj} · {e.endereco} · {e.contato}
      </Text>
    </View>
  );
}

/**
 * Raiz reutilizável de documentos: `<Document>` com cabeçalho (logo),
 * corpo e rodapé com dados da empresa. Os metadados chegam via `gerarPDF`.
 */
export function PDFLayout({
  children,
  title,
  author,
  subject,
}: PropsWithChildren<PDFLayoutProps>) {
  return (
    <Document title={title} author={author} subject={subject}>
      <Page size="A4" style={styles.page}>
        <PDFHeader />
        <View style={styles.corpo}>{children}</View>
        <PDFFooter />
      </Page>
    </Document>
  );
}

/** Bloco de seção com título e conteúdo. */
export function PDFSection({
  titulo,
  children,
}: PropsWithChildren<{ titulo: string }>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitulo}>{titulo}</Text>
      {children}
    </View>
  );
}

export interface PDFTableProps {
  colunas: string[];
  linhas: ReactNode[][];
}

/** Tabela simples com cabeçalho e linhas de células de larguras iguais. */
export function PDFTable({ colunas, linhas }: PDFTableProps) {
  for (const linha of linhas) {
    if (linha.length !== colunas.length) {
      throw new Error(
        `PDFTable: linha com ${linha.length} células, esperado ${colunas.length}`,
      );
    }
  }
  return (
    <View>
      <View style={styles.tableHeaderRow}>
        {colunas.map((col, i) => (
          <Text key={i} style={styles.cellHeader}>
            {col}
          </Text>
        ))}
      </View>
      {linhas.map((linha, r) => (
        <View key={r} style={styles.tableRow}>
          {linha.map((celula, c) => (
            <Text key={c} style={styles.cell}>
              {celula}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
