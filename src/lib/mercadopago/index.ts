// Adapter Mercado Pago único (#164): setup privado compartilhado (credencial,
// MercadoPagoConfig, sandbox TEST- vs produção APP_USR-) e erro normalizado.
// As três interfaces de contexto (GatewayPagamento, GatewayAssinatura,
// GatewayPlanoMP) permanecem nos seus contextos — cada um enxerga só a sua
// capacidade; este módulo é o único que importa o SDK `mercadopago`.
export { MercadoPagoError } from "./cliente";
export { criarGatewayMercadoPago } from "./pagamento";
export { criarGatewayMercadoPagoAssinatura } from "./assinatura";
export { criarGatewayMercadoPagoPlano } from "./plano";
