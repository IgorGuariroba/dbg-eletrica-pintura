# Pagamento

Camada de integração com o Mercado Pago. Gera cobranças (Checkout Pro e Pix) e processa as notificações de pagamento que transitam a OS para PAGA. **Sem UI** — as slices de checkout (PWA técnico, checkout consolidado) consomem estas funções. Não confunde com Financeiro (dashboard/faturamento): este contexto só fala com o gateway.

## Language

**Checkout Pro**:
Fluxo hospedado do Mercado Pago. `criarPreferenciaCheckoutPro` cria uma **Preferência** com items + metadata + back_urls e devolve a URL para onde o cliente é redirecionado.
_Avoid_: Checkout transparente, link de pagamento

**Cobrança Pix**:
`criarCobrancaPix` cria um pagamento Pix e devolve QR (base64) + texto **copia-e-cola** + id da transação. Mostrado na tela do PWA ou enviado por link.
_Avoid_: QR code, boleto

**Preferência**:
Objeto do MP que descreve o que será cobrado no Checkout Pro. Tem `id` e `init_point` (a URL).
_Avoid_: Pedido, order

**Metadata**:
Carga anexada à cobrança que carrega a(s) OS: `os_id` (única) ou `os_ids` (checkout consolidado). É como o **Webhook** mapeia pagamento → OS.
_Avoid_: Tags, custom data

**Webhook**:
Notificação POST do MP em `/api/webhooks/mercadopago`. O corpo só traz `data.id`; status, valor, método e metadata vêm de **consultar o pagamento** por esse id. Valida **Assinatura** antes de processar.
_Avoid_: Callback, postback

**Assinatura**:
HMAC-SHA256 no header `x-signature` (`ts=...,v1=...`), sobre o manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` com o segredo `MP_WEBHOOK_SECRET`. Inválida → 401.
_Avoid_: Token, HMAC genérico

**Idempotência**:
Tabela `pagamento` com PK composta `(payment_id, os_id)`. Webhook duplicado não insere segunda linha nem dispara segunda transição. Mesma cobrança pode pagar N OS (consolidado) — uma linha por OS.
_Avoid_: Deduplicação, lock

**Transição PAGA**:
Só `status === "approved"` transita CONCLUIDA → PAGA (reusa a máquina de estados de Operação). Rejeitado/cancelado: log, sem mudança. PREVENTIVA/GARANTIA bloqueiam PAGA (sem custo) — `TransicaoInvalidaError` é capturado e logado.
_Avoid_: Confirmação, baixa

## Relationships

- **Pagamento → Operação**: `aplicarTransicao` (máquina de estados) leva CONCLUIDA → PAGA
- **Pagamento → Mercado Pago**: `GatewayPagamento` isola o SDK (`mercadopago-client.ts`); o domínio depende da interface, testável com fake
- **Pagamento ← Slices 8/9**: PWA técnico (Pix QR/link) e checkout consolidado consomem `criarCobrancaPix`/`criarPreferenciaCheckoutPro`
- **Pagamento → Notificação** (futuro): pagamento confirmado/falho emite evento

## Example Dialogue

> **Dev**: O mesmo webhook chegou duas vezes. Cobra duas vezes?
>
> **Domain Expert**: Não. A PK `(payment_id, os_id)` é a âncora de idempotência. A primeira gravação vence; a segunda bate no conflito, não insere e não transita. Webhook do MP é at-least-once — duplicar é esperado.
>
> **Dev**: Webhook aprovado mas a OS é PREVENTIVA?
>
> **Domain Expert**: Preventiva não tem custo, a máquina bloqueia PAGA. A transição lança `TransicaoInvalidaError`, a gente captura e loga `transicao_bloqueada`. Não deveria nem ter chegado cobrança — é sinal de erro a montante.
