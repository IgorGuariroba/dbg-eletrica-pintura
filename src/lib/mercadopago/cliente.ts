import { MercadoPagoConfig } from "mercadopago";

/**
 * Erro próprio do adapter Mercado Pago: todo erro do SDK (e de configuração)
 * sai normalizado daqui — caller nunca vê o formato cru do SDK, que varia por
 * API (Payment, PreApproval, PreApprovalPlan).
 */
export class MercadoPagoError extends Error {
  /** Status HTTP devolvido pelo MP, quando houver. */
  readonly status?: number;
  /** Erro original do SDK, para diagnóstico. */
  readonly causa?: unknown;

  constructor(mensagem: string, opts: { status?: number; causa?: unknown } = {}) {
    super(mensagem);
    this.name = "MercadoPagoError";
    this.status = opts.status;
    this.causa = opts.causa;
  }
}

/**
 * Setup privado compartilhado pelas três fábricas (Pagamento, Assinatura,
 * Plano): lê a credencial e instancia o cliente do SDK. `MP_ACCESS_TOKEN`
 * separa sandbox (token `TEST-`) de produção (`APP_USR-`) — mesma conta MP,
 * rotacionar credencial = trocar a env e reimplantar.
 */
export function criarClienteMp(): MercadoPagoConfig {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new MercadoPagoError("MP_ACCESS_TOKEN não configurada");
  }
  return new MercadoPagoConfig({ accessToken });
}

/**
 * Executa uma chamada ao SDK normalizando a falha: qualquer rejeição vira
 * MercadoPagoError com a operação no texto e o erro cru em `causa`.
 */
export async function chamarMp<T>(
  operacao: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const status =
      typeof (e as { status?: unknown })?.status === "number"
        ? (e as { status: number }).status
        : undefined;
    const detalhe = e instanceof Error ? e.message : String(e);
    throw new MercadoPagoError(
      `Mercado Pago: falha em ${operacao}: ${detalhe}`,
      { status, causa: e },
    );
  }
}
