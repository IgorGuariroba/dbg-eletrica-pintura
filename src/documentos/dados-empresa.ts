/** Dados fixos da empresa exibidos no rodapé dos documentos (PDF). */
export interface DadosEmpresa {
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  contato: string;
}

/**
 * Dados da empresa para o rodapé dos documentos. Usa defaults sensatos,
 * sobrescrevíveis por variáveis de ambiente `EMPRESA_*` (mesmo padrão de
 * `lib/contato.ts`). Não bloqueia builds enquanto os dados reais não chegam.
 */
export function dadosEmpresa(): DadosEmpresa {
  return {
    razaoSocial:
      process.env.EMPRESA_RAZAO_SOCIAL ?? "DBG Elétrica e Pintura",
    cnpj: process.env.EMPRESA_CNPJ ?? "00.000.000/0001-00",
    endereco:
      process.env.EMPRESA_ENDERECO ?? "São Paulo — SP",
    contato:
      process.env.EMPRESA_CONTATO ?? "contato@dbg.com.br · (11) 99999-9999",
  };
}
