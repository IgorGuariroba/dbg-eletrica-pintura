import { cloneElement, type ReactElement } from "react";
import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer";

/** Metadados embutidos no PDF (aparecem nas propriedades do arquivo). */
export interface PdfMetadata {
  titulo: string;
  autor?: string;
  assunto?: string;
}

/**
 * Renderiza um documento `@react-pdf/renderer` para um Buffer server-side,
 * injetando os metadados no `<Document>` raiz.
 *
 * @param documento elemento `<Document>` (ex.: `<PDFLayout>`).
 */
export async function gerarPDF(
  documento: ReactElement,
  metadata: PdfMetadata,
): Promise<Buffer> {
  // documento é um <Document> (ou wrapper que o renderiza, como PDFLayout);
  // o cast guia o cloneElement a aceitar os metadados do Document.
  const comMeta = cloneElement(documento as ReactElement<DocumentProps>, {
    title: metadata.titulo,
    author: metadata.autor,
    subject: metadata.assunto,
  });
  return renderToBuffer(comMeta);
}
