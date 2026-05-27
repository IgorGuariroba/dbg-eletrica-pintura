# Portal

Superfície de interação com usuários. Três faces: landing page pública, portal do cliente (web) e PWA do técnico (mobile offline-first). Não é módulo admin — é a camada de apresentação que consome os outros contextos.

## Language

### Público (sem login)

**Landing Page**:
Página institucional. Serviços, portfólio (fotos curadas), avaliações, CTA principal ("Descreva seu problema"). Conteúdo estático + dados do Catálogo e Marketing.
_Avoid_: Home, site, página inicial

**Formulário de Solicitação**:
Interface de taps — mínimo de digitação. Campos: WhatsApp (único digitado), categorias (cards visuais, múltipla seleção), fotos (câmera/galeria, opcional), data desejada, duração estimada (chips), descrição (áudio via Web Speech API ou texto), endereço (obrigatório — Geolocation, CEP/ViaCEP, ou manual), checkbox LGPD obrigatório. Cria Solicitação no contexto Operação.
_Avoid_: Form, cadastro, registro

**Landing Page de Serviço**:
Página pública gerada por serviço ativo do Catálogo. URL: site.com/servicos/{slug}. Formulário embutido com categoria pré-selecionada. Conteúdo: auto do Catálogo + override do Marketing.
_Avoid_: Product page, service page

### Cliente (token ou Google)

**Link Token**:
URL única por Solicitação: site.com/s/{token}. Acesso sem login. Versão limitada: aprovar/rejeitar orçamento, ver status, avaliar, acionar garantia. Ações sensíveis (aprovar) exigem código de verificação via WhatsApp.
_Avoid_: Magic link, link público

**Portal do Cliente**:
Área logada via Google OAuth. Versão completa: histórico de todas Solicitações, múltiplas OS com status, fotos antes/depois, faturas, certificados de garantia, garantias ativas, plano de assinatura.
_Avoid_: Dashboard cliente, área do cliente, minha conta

**Código de Verificação**:
Código enviado por WhatsApp pra confirmar ação sensível via Link Token (sem Google). Ex: aprovar orçamento → recebe código → digita no site → aprovado.
_Avoid_: OTP, PIN, 2FA

### Técnico (PWA)

**PWA Técnico**:
Progressive Web App mobile offline-first. Service Worker + IndexedDB (Dexie.js) + Background Sync. Tela pequena, mãos ocupadas. Funciona sem sinal.
_Avoid_: App, aplicativo, mobile app

**Solicitação Express**:
Técnico cria Solicitação direto no PWA (cliente chamou direto, sem formulário). Campos: WhatsApp do cliente + categoria + fotos. Checkbox LGPD + aprovação presencial na mesma tela.
_Avoid_: OS manual, cadastro rápido

**Aprovação Presencial**:
Cliente assina na tela do técnico (como entrega de encomenda). Checkbox LGPD antes da assinatura. Registrado como "aprovado presencial" com assinatura capturada (base64 → PNG → R2).
_Avoid_: Assinatura verbal, aceite oral

**Role Detection**:
Mesmo link pra todos (site.com/s/{token}). Auth.js verifica: e-mail na tabela membros → visão técnico/admin (edição, status, orçamento). Senão → visão cliente (leitura, aprovação). Sem login → versão token (limitada).
_Avoid_: Detecção de papel, visão condicional

## Relationships

- **Portal → Operação**: formulário cria Solicitação; PWA muda estados; portal exibe OS
- **Portal → Catálogo**: formulário lista categorias; landing pages consomem serviços
- **Portal → Equipe**: role detection consulta tabela membros
- **Portal → Marketing**: landing pages de serviço com override; portfólio curado exibido
- **Portal → Financeiro**: checkout embutido; status de pagamento; plano de assinatura

## Example Dialogue

> **Dev**: Dona Maria recebeu link no WhatsApp pra aprovar orçamento. Ela não tem Google. Como funciona?
>
> **Domain Expert**: Clica no link (site.com/s/{token}). Vê orçamento com breakdown. Clica "Aprovar". Sistema envia código de verificação pro WhatsApp dela. Ela digita o código. Aprovado. Sem login, sem Google, sem senha.
>
> **Dev**: E se Diego (técnico + admin) acessar o mesmo link?
>
> **Domain Expert**: Loga com Google. Auth.js vê e-mail na tabela membros com flag técnico + admin raiz. Mostra visão de edição: pode mudar status, montar orçamento, ver notas internas. Mesmo link, visão diferente.
