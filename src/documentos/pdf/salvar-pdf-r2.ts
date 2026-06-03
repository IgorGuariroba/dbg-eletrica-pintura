import {
  enviarPdfDocumento,
  obterUrlLeituraAssinada,
} from "@/operacao/r2-privado";

/** Porta de armazenamento de PDFs — permite injetar um fake nos testes. */
export interface ArmazenamentoPdf {
  enviar(chave: string, corpo: Buffer): Promise<void>;
  urlAssinada(chave: string, expiraEmSegundos: number): Promise<string>;
}

/** R2 privado como armazenamento padrão (upload + URL de leitura assinada). */
export function r2PrivadoPdf(): ArmazenamentoPdf {
  return {
    enviar: (chave, corpo) => enviarPdfDocumento(chave, corpo),
    urlAssinada: (chave, expiraEmSegundos) =>
      obterUrlLeituraAssinada(chave, expiraEmSegundos),
  };
}

/**
 * Teto do AWS SigV4: presigned URLs não podem expirar a mais de 7 dias.
 * Tentar 30 dias falha já na assinatura. A persistência de 30 dias é do
 * objeto no R2 (que não expira) — quem precisa de acesso prolongado
 * re-assina sob demanda (ex.: a rota de visualização da fatura).
 */
const SETE_DIAS_SEGUNDOS = 7 * 24 * 60 * 60;

/**
 * Salva um PDF no R2 privado e devolve uma URL de leitura assinada, válida
 * pelo máximo permitido pelo SigV4 (7 dias). O objeto persiste no bucket;
 * acesso após 7 dias requer re-assinatura da mesma chave.
 */
export async function salvarPDFR2(
  buffer: Buffer,
  chave: string,
  armazenamento: ArmazenamentoPdf = r2PrivadoPdf(),
): Promise<string> {
  await armazenamento.enviar(chave, buffer);
  return armazenamento.urlAssinada(chave, SETE_DIAS_SEGUNDOS);
}
