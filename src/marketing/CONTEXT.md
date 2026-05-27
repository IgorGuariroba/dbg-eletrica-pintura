# Marketing

Aquisição de clientes, reputação e retenção. Landing pages, leads, remarketing, avaliações, indicação e portfólio. Administrado pelo módulo Marketing.

## Language

**Landing Page**:
Página pública de um Serviço do Catálogo. Gerada automaticamente com template fixo (nome, descrição, preço, fotos, formulário pré-selecionado). URL limpa: site.com/servicos/{slug}. Admin pode customizar via override (título, descrição, fotos, preço promocional, upsell, depoimentos).
_Avoid_: Página de serviço, product page

**Override**:
Customização opcional de campos da Landing Page. Não é editor visual — são campos de formulário simples. Se não preenchido, usa dados do Catálogo.
_Avoid_: Customização, edição, template builder

**Preço Promocional**:
Override opcional na Landing Page. Mostra preço original riscado + novo preço. Não afeta Preço Base do Catálogo — é visual/marketing.
_Avoid_: Desconto, oferta, sale

**Lead**:
Cliente potencial capturado por formulário (landing page ou principal). Identificado por WhatsApp. Toda Solicitação gera Lead. Rastreio de origem por página/campanha.
_Avoid_: Contato, prospect, oportunidade

**Remarketing**:
Mensagens automáticas pra leads não convertidos. Regras configuráveis pelo admin: validade orçamento [7] dias, lembretes dia [3] e [6], remarketing após rejeição [48]h, reativação inativos [6] meses. Cada gatilho com toggle on/off e prazo editável.
_Avoid_: Follow-up, nurturing, drip

**Indicação (Referral)**:
Link único por cliente. Incentivo duplo: quem indica ganha crédito pro próximo serviço, indicado ganha desconto no primeiro. Valor fixo em reais (ex: R$30), configurável pelo admin. Gatilho: indicado conclui e paga primeiro serviço.
_Avoid_: Programa de afiliados, cupom

**Avaliação**:
Nota (1-5★) + comentário do cliente após conclusão da OS. Pedido automático + lembrete único 48h.
_Avoid_: Review, feedback, NPS

**Filtro Inteligente**:
Nota ≥ 4★ → cliente recebe link Google Review (g.page). Nota ≤ 3★ → não envia pro Google, alerta admin pra **Tratativa**. Protege reputação online.
_Avoid_: Gate, triagem

**Tratativa**:
Ação do admin em resposta a avaliação ≤ 3★. Registro: nota, comentário, OS vinculada, técnico responsável. Admin documenta ação (ligou, desconto, OS correção), responde ao cliente, marca resolvido. Após resolução → sistema pede reavaliação. Se nota sobe pra ≥ 4★ → recebe link Google.
_Avoid_: Reclamação, complaint, caso

**Portfólio Curado**:
Fotos antes/depois aprovadas pra exibição pública. Técnico marca "boa pra portfólio" no PWA → admin (Marketing) aprova. Fotos internas da OS ≠ fotos públicas. Nenhuma foto vai pro site sem aprovação.
_Avoid_: Galeria, showcase

**Reputação Google** (duas camadas):
Camada 1 (MVP): avaliações internas + link manual g.page. Camada 2 (upgrade): Google Business Profile API — lê avaliações externas, responde pelo painel, dashboard de tendência. Pré-requisito camada 2: negócio verificado no Google.
_Avoid_: SEO, Google Reviews

## Relationships

- **Marketing → Catálogo**: landing pages geradas de Serviços ativos; override não muda Catálogo
- **Marketing → Operação**: avaliações vinculadas a OS; fotos do portfólio vêm de OS concluídas
- **Marketing → Notificação**: remarketing e reativação → WhatsApp Cloud API; avaliação → WhatsApp
- **Marketing → Financeiro**: indicação gera crédito/desconto aplicado no checkout

## Example Dialogue

> **Dev**: Admin quer fazer promoção de limpeza de ar-condicionado. Como?
>
> **Domain Expert**: Serviço já existe no Catálogo. Admin abre landing page desse serviço no módulo Marketing, preenche override: título chamativo, preço promocional (riscado + novo), seleciona depoimentos. Publica. URL: site.com/servicos/limpeza-ar-condicionado. Formulário embutido com categoria pré-selecionada. Preço Base no Catálogo não muda.
>
> **Dev**: Cliente deu nota 2. O que acontece?
>
> **Domain Expert**: NÃO recebe link do Google. Alerta vai pro módulo Marketing. Admin abre tratativa, registra o que fez (ligou, ofereceu desconto). Marca resolvido. Sistema pede reavaliação. Se cliente muda pra 4★ → aí sim, link Google Review.
