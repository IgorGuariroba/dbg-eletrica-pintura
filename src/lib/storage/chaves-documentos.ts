/**
 * Chaves determinísticas dos documentos de uma OS no R2 privado — convenção
 * de chave é decisão do módulo Storage. Determinísticas (sem uuid) para que a
 * re-geração sobrescreva e a re-assinatura sob demanda ache o mesmo objeto.
 */

/** Chave da fatura de uma OS. */
export function chaveFatura(osId: string): string {
  return `fatura/os/${osId}.pdf`;
}

/** Chave do certificado de garantia de uma OS. */
export function chaveCertificado(osId: string): string {
  return `garantia/os/${osId}.pdf`;
}

/** Chave do relatório de inspeção de uma OS Preventiva. */
export function chaveRelatorio(osId: string): string {
  return `relatorio/os/${osId}.pdf`;
}
