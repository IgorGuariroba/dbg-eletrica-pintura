/**
 * Chaves determinísticas dos documentos de uma OS no R2 privado. Módulo leve
 * (sem dependências de banco/e-mail) para ser importado tanto pelo gerador
 * quanto pelo portal sem arrastar o use-case inteiro para o bundle.
 */

/** Chave da fatura de uma OS. */
export function chaveFatura(osId: string): string {
  return `fatura/os/${osId}.pdf`;
}

/** Chave do certificado de garantia de uma OS. */
export function chaveCertificado(osId: string): string {
  return `garantia/os/${osId}.pdf`;
}
