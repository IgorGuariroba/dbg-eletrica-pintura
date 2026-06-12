import {
  enviarPdfDocumento,
  obterUrlLeituraAssinada,
} from "@/lib/storage";

/** Porta de armazenamento de PDFs — permite injetar um fake nos testes. */
export interface ArmazenamentoPdf {
  enviar(chave: string, corpo: Buffer): Promise<void>;
  /**
   * URL de leitura do PDF. A expiração é decisão do armazenamento (#166) —
   * no R2, o teto do SigV4 (7 dias); acesso prolongado re-assina a mesma
   * chave sob demanda (ex.: a rota de visualização da fatura).
   */
  urlAssinada(chave: string): Promise<string>;
}

/** R2 privado como armazenamento padrão (upload + URL de leitura assinada). */
export function r2PrivadoPdf(): ArmazenamentoPdf {
  return {
    enviar: (chave, corpo) => enviarPdfDocumento(chave, corpo),
    urlAssinada: (chave) => obterUrlLeituraAssinada(chave),
  };
}

/**
 * Salva um PDF no R2 privado e devolve uma URL de leitura assinada. O objeto
 * persiste no bucket; a validade da URL é do armazenamento.
 */
export async function salvarPDFR2(
  buffer: Buffer,
  chave: string,
  armazenamento: ArmazenamentoPdf = r2PrivadoPdf(),
): Promise<string> {
  await armazenamento.enviar(chave, buffer);
  return armazenamento.urlAssinada(chave);
}
