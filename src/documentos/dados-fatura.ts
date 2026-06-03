import type { FaturaItemView, FaturaView } from "./fatura";

/** Endereço estruturado (subset do jsonb da Solicitação). */
export interface EnderecoView {
  logradouro: string;
  numero?: string | null;
  bairro?: string | null;
  cidade: string;
  uf: string;
}

/** Dados crus (já carregados do banco) para montar a view da fatura. */
export interface FaturaInput {
  osId: string;
  clienteNome: string;
  endereco: EnderecoView;
  tecnicoNome: string;
  itens: FaturaItemView[];
  totalDeslocamento: string;
  total: string;
  pagamento: {
    criadoEm: Date;
    /** Código do método (MP: pix/credit_card; manual: DINHEIRO/PIX_DIRETO/...). */
    metodo: string;
    /** payment_id do MP, ou `manual-<uuid>` para pagamento manual. */
    paymentId: string;
  };
}

/** Número curto da OS exibido nos documentos (8 primeiros chars, maiúsculo). */
export function numeroCurtoOs(osId: string): string {
  return osId.slice(0, 8).toUpperCase();
}

/** Endereço em linha única para cabeçalho de documentos. */
export function formatarEndereco(e: EnderecoView): string {
  return `${e.logradouro}, ${e.numero || "S/N"} - ${e.bairro || ""}, ${e.cidade} - ${e.uf}`;
}

/** Rótulos legíveis por método de pagamento (MP e manual). */
const ROTULO_METODO: Record<string, string> = {
  pix: "Pix",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  DINHEIRO: "Dinheiro",
  PIX_DIRETO: "Pix",
  TRANSFERENCIA: "Transferência",
  OUTRO: "Outro",
};

function rotuloFormaPagamento(metodo: string): string {
  return ROTULO_METODO[metodo] ?? metodo;
}

/**
 * Identificador exibido na fatura: o payment_id real do Mercado Pago, ou
 * "manual" quando o pagamento foi registrado manualmente (id sintético).
 */
function identificadorPagamento(paymentId: string): string {
  return paymentId.startsWith("manual-") ? "manual" : paymentId;
}

/** Constrói a view-model da fatura a partir dos dados crus carregados. */
export function montarDadosFatura(input: FaturaInput): FaturaView {
  return {
    numeroOS: numeroCurtoOs(input.osId),
    clienteNome: input.clienteNome,
    endereco: formatarEndereco(input.endereco),
    tecnicoNome: input.tecnicoNome,
    data: input.pagamento.criadoEm.toLocaleDateString("pt-BR"),
    formaPagamento: rotuloFormaPagamento(input.pagamento.metodo),
    identificador: identificadorPagamento(input.pagamento.paymentId),
    itens: input.itens,
    totalDeslocamento: input.totalDeslocamento,
    total: input.total,
  };
}
