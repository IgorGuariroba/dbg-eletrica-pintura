# Context Map — DBG Elétrica e Pintura

Sistema de gestão de serviços residenciais. 7 contextos bounded + glossário raiz.

## Glossário Raiz

- [CONTEXT.md](./CONTEXT.md) — termos compartilhados entre todos os contextos (Solicitação, OS, estados, tipos, atores)

## Contextos

- [Catálogo](./src/catalogo/CONTEXT.md) — serviços, preços, unidades, checklist preventivo, garantias por tipo
- [Operação](./src/operacao/CONTEXT.md) — solicitações, ordens de serviço, orçamentos, agendamento (Instant Booking), rastreamento, fila, área de cobertura
- [Financeiro](./src/financeiro/CONTEXT.md) — pagamento (Mercado Pago), checkout consolidado, assinaturas, faturamento digital (PDF)
- [Equipe](./src/equipe/CONTEXT.md) — técnicos, membros internos, módulos, permissões binárias, admin raiz
- [Marketing](./src/marketing/CONTEXT.md) — landing pages (auto + override), leads, remarketing configurável, reputação Google, indicação (referral), portfólio curado
- [Notificação](./src/notificacao/CONTEXT.md) — wa.me, WhatsApp Cloud API, e-mail (Resend), prioridade por canal, fila de envio com horário restrito
- [Portal](./src/portal/CONTEXT.md) — landing page pública, formulário de solicitação, portal do cliente (token + Google), PWA técnico (offline-first)

## Relacionamentos

- **Portal → Operação**: formulário cria Solicitação; portal exibe OS e status; PWA técnico muda estados da OS
- **Operação → Catálogo**: orçamento monta itens do Catálogo (preço base × quantidade); OS herda garantia do serviço; preventiva segue checklist do Catálogo
- **Operação → Equipe**: agendamento consulta disponibilidade do técnico; atribuição por especialidade; admin com módulo Operação gerencia fila
- **Operação → Financeiro**: OS concluída dispara checkout; orçamento complementar soma ao checkout; OS preventiva = sem custo (coberta pelo plano)
- **Operação → Notificação**: cada transição de estado emite evento → Notificação decide canal (WhatsApp pra urgente, e-mail pra documento)
- **Financeiro → Notificação**: pagamento falho → notificação WhatsApp com link; fatura/garantia PDF → e-mail
- **Marketing → Catálogo**: landing pages geradas a partir de serviços ativos; override de título/descrição/preço promocional
- **Marketing → Operação**: avaliação ≤ 3★ → tratativa; avaliação ≥ 4★ → link Google Review; fotos aprovadas pro portfólio vêm da OS
- **Marketing → Notificação**: remarketing e reativação emitem eventos → Notificação envia por WhatsApp Cloud API
- **Equipe → Portal**: role detection no login (e-mail na tabela membros → visão interna; senão → visão cliente)
- **Financeiro → Operação**: assinante ativo → prioridade no agendamento + desconto automático no orçamento; visita preventiva gera OS automática

## Tipos compartilhados

- `SolicitacaoId`, `OrdemServicoId`, `ClienteId`, `TecnicoId`, `MembroId` — IDs referenciados entre contextos
- `EstadoOS` — enum de estados da OS, consumido por Operação, Portal e Notificação
- `TipoOS` — enum de tipos (Normal, Express, Complementar, Preventiva, Garantia)
- `Modulo` — enum dos 6 módulos de permissão
