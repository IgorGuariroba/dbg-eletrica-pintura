import type { TipoOs } from "@/operacao/maquina-estado";
import type { EstadoOs } from "@/operacao/orcamento-repo";

/** Quais documentos uma transição de OS deve gerar. */
export interface PlanoDocumentos {
  fatura: boolean;
  certificado: boolean;
  /** Relatório de inspeção da preventiva (checklist + fotos), gerado no CONCLUIDA. */
  relatorio: boolean;
}

/** Tipos de OS com mão de obra paga (geram fatura + certificado no PAGA). */
const TIPOS_PAGOS: ReadonlySet<TipoOs> = new Set([
  "NORMAL",
  "EXPRESS",
  "COMPLEMENTAR",
]);

const SEM_DOCUMENTOS: PlanoDocumentos = {
  fatura: false,
  certificado: false,
  relatorio: false,
};

/**
 * Decide os documentos gerados por uma transição de estado da OS:
 *
 * - PAGA + OS paga (NORMAL/EXPRESS/COMPLEMENTAR): fatura + certificado.
 * - CONCLUIDA + GARANTIA: só certificado (regarantia não tem custo, nunca PAGA).
 * - CONCLUIDA + PREVENTIVA: relatório de inspeção (sem custo, nunca certificado).
 * - Demais combinações: nada.
 */
export function planejarDocumentos(
  tipo: TipoOs,
  estado: EstadoOs,
): PlanoDocumentos {
  if (estado === "PAGA" && TIPOS_PAGOS.has(tipo)) {
    return { fatura: true, certificado: true, relatorio: false };
  }
  if (estado === "CONCLUIDA" && tipo === "GARANTIA") {
    return { fatura: false, certificado: true, relatorio: false };
  }
  if (estado === "CONCLUIDA" && tipo === "PREVENTIVA") {
    return { fatura: false, certificado: false, relatorio: true };
  }
  return SEM_DOCUMENTOS;
}
