# Financeiro

Pagamento, assinaturas recorrentes e faturamento digital. Integração principal: Mercado Pago. Administrado pelo módulo Financeiro.

## Language

**Checkout Consolidado**:
Página de pagamento para OS concluídas de uma Solicitação. Cada OS tem link individual. Se múltiplas concluídas, opção "pagar tudo junto". Cliente escolhe. Nenhuma OS bloqueia pagamento de outra.
_Avoid_: Carrinho, fatura unificada

**Pagamento Flexível**:
Pode ser na hora (QR Pix na tela do PWA, dinheiro, transferência) ou depois (link digital). Nunca obrigatório pra concluir OS — técnico pode marcar CONCLUÍDA antes do pagamento. Técnico confirma pagamento manual na plataforma.
_Avoid_: Cobrança obrigatória

**Pagamento Manual**:
Dinheiro, transferência bancária ou outro meio fora do Mercado Pago. Técnico registra na plataforma: valor + forma de pagamento. Sistema marca como PAGA.
_Avoid_: Pagamento informal, por fora

**Plano de Assinatura**:
Contrato recorrente mensal. Três planos: Básico (~R$99), Conforto (~R$179), Premium (~R$299). Benefícios: visitas preventivas, desconto percentual, prioridade no agendamento. Cobrança via Mercado Pago Subscriptions API.
_Avoid_: Contrato, mensalidade

**Assinatura Multicanal**:
Três canais pra assinar: checkout digital (upsell com economia visível), presencial (técnico mostra plano, cliente assina na tela), QR (cliente escaneia e faz sozinho).
_Avoid_: Venda de plano

**Upsell**:
Oferta de Plano de Assinatura antes do pagamento no checkout. Mostra economia visível ("com plano Conforto, esse serviço sairia R$X ao invés de R$Y"). Aparece uma vez só (primeiro checkout ou consolidado). Social proof incluído.
_Avoid_: Cross-sell, upgrade

**Fatura**:
PDF gerado automaticamente após pagamento confirmado. Layout profissional com logo DBG. Enviada por e-mail (Resend). Acessível no portal.
_Avoid_: Nota fiscal, invoice, recibo

**Inadimplência**:
Gerenciada pelo Mercado Pago: retry 4x em 10 dias, Card Updater automático, cancela após 3 parcelas rejeitadas consecutivas. DBG constrói: webhook listener (atualiza banco), notificação WhatsApp (link pra atualizar cartão), gestão manual pelo admin.
_Avoid_: Default, cobrança

## Relationships

- **Financeiro → Operação**: OS concluída dispara checkout; assinante → prioridade + desconto; preventiva gerada pelo calendário do plano
- **Financeiro → Notificação**: pagamento falho → WhatsApp com link; fatura/garantia → e-mail
- **Financeiro → Catálogo**: desconto de assinante aplicado sobre Preço Base do serviço
- **Financeiro → Mercado Pago**: Checkout Pro, Pix QR, Subscriptions API, webhooks

## Example Dialogue

> **Dev**: Cliente tem 2 OS concluídas. Paga como?
>
> **Domain Expert**: Cada OS tem link individual. Se ambas concluídas, checkout mostra "pagar tudo junto" com total. Cliente escolhe. Upsell de assinatura aparece uma vez só.
>
> **Dev**: E se pagamento do plano falha?
>
> **Domain Expert**: Mercado Pago retenta 4x em 10 dias. Nós só mandamos WhatsApp pro cliente com link pra atualizar cartão. 3 falhas seguidas → MP cancela sozinho, webhook atualiza nosso banco.
