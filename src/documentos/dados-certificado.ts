import type { CertificadoView } from "./certificado-garantia";
import { numeroCurtoOs } from "./dados-fatura";

/** Dados crus (já resolvidos) para montar a view do certificado. */
export interface CertificadoInput {
  osId: string;
  clienteNome: string;
  servicos: string[];
  prazoGarantiaMeses: number;
  /** Início da garantia (= data do pagamento âncora). */
  inicio: Date;
  /** Fim da garantia (já resolvido — preserva o original em regarantia). */
  fim: Date;
}

/** Constrói a view-model do certificado a partir dos dados resolvidos. */
export function montarDadosCertificado(input: CertificadoInput): CertificadoView {
  return {
    numeroOS: numeroCurtoOs(input.osId),
    clienteNome: input.clienteNome,
    servicos: input.servicos,
    prazoGarantiaMeses: input.prazoGarantiaMeses,
    dataInicio: input.inicio.toLocaleDateString("pt-BR"),
    dataFim: input.fim.toLocaleDateString("pt-BR"),
  };
}
