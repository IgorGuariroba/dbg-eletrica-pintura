# Mercado Pago gerencia inadimplência de assinaturas

Retry de pagamento, Card Updater e cancelamento por inadimplência são delegados ao Mercado Pago Subscriptions API (retry 4x em 10 dias, cancela após 3 parcelas rejeitadas consecutivas). DBG constrói apenas: webhook listener para atualizar status no banco, notificação WhatsApp ao cliente quando pagamento falha, e gestão manual (pausa/cancelamento) pelo admin.

Decidimos assim porque: (1) MP já tem lógica robusta de retry e Card Updater built-in — reimplementar seria desperdício; (2) regras de inadimplência do MP são razoáveis pro caso de uso; (3) reduz complexidade do sistema significativamente.

## Consequences

- Prazos de retry não são configuráveis pelo admin — são fixos do MP (10 dias, 4 tentativas).
- Se MP mudar regras de inadimplência, DBG é afetada sem controle.
