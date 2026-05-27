# DBG Elétrica e Pintura

Sistema de gestão de serviços residenciais e comerciais de pequeno porte. Conecta clientes que precisam de reparos/manutenção a técnicos de campo, com rastreio total de cada interação.

## Language

### Atores

**Cliente**:
Pessoa física que solicita um serviço. Identificado pelo número de WhatsApp. Pode ter ou não conta Google vinculada.
_Avoid_: Usuário, consumidor, comprador

**Técnico**:
Profissional que executa serviços em campo. Flag independente no sistema — pode acumular com **Módulos** admin (roles compostas). Usa PWA offline-first. Vê OS atribuídas + fila de OS abertas filtrada por suas especialidades. Pode se atribuir a OS abertas (self-assign) e montar **Orçamento** sem precisar de **Módulo** Operação.
_Avoid_: Prestador, funcionário, operador

**Membro Interno**:
Pessoa com acesso ao painel administrativo. Tem **Módulos** atribuídos. Pode ser também **Técnico**.
_Avoid_: Usuário admin, operador, staff

**Admin Raiz**:
**Membro Interno** com acesso total a todos os **Módulos**. Definido via variável de ambiente, não pelo banco de dados. Único por instalação.
_Avoid_: Super admin, owner, root

### Entidades Centrais

**Solicitação**:
Pedido de serviço criado pelo **Cliente** via formulário ou pelo **Técnico** via criação express. Uma **Solicitação** gera uma ou mais **Ordens de Serviço** (1 por categoria selecionada). É o agrupador — o **Cliente** vê a **Solicitação** com suas OS filhas.
_Avoid_: Pedido, chamado, ticket, request

**Ordem de Serviço (OS)**:
Unidade atômica de trabalho. Sempre filha de uma **Solicitação**. Tem um **Tipo**, um **Estado**, um **Técnico** atribuído, fotos antes/depois e garantia própria. 1 OS = 1 técnico sempre.
_Avoid_: Tarefa, job, work order, chamado

**Orçamento**:
Proposta de preço para uma **OS**, composta por itens do **Catálogo** (preço base × quantidade). Todo **Técnico** pode montar orçamento (acesso à fila de OS abertas é inerente ao papel de técnico, sem precisar de **Módulo** Operação). **Membro Interno** com módulo Operação também pode. Válido por prazo configurável.
_Avoid_: Proposta, cotação, estimate

**Orçamento Complementar**:
**Orçamento** adicional criado durante execução de uma **OS**, quando o **Técnico** descobre serviço extra não previsto. Gera **OS** tipo COMPLEMENTAR vinculada à OS pai.
_Avoid_: Adendo, aditivo, extra

### Tipos de OS

**OS Normal**:
Originada de formulário remoto. Fluxo completo de estados. Paga.

**OS Express**:
Criada pelo **Técnico** no local (cliente chamou direto). **Solicitação** + OS geradas juntas. Coleta WhatsApp + categoria + endereço (geolocalização 1 tap — técnico já está no local) + consentimento LGPD obrigatório antes de qualquer dado. Pula estados de agendamento/deslocamento (registrados como "N/A — express"). Se cliente não aprova presencialmente, OS fica ORÇADA e segue aprovação remota — tipo continua EXPRESS, agendamento necessário se técnico não está mais no local. Paga.

**OS Complementar**:
Serviço extra descoberto durante execução. Vinculada a uma OS pai. Paga. Dois caminhos de aprovação: (1) cliente presente → **Aprovação Presencial**, pula pra EM_EXECUÇÃO. (2) cliente ausente → notificação, aprovação remota → APROVADA → agendamento normal (prioriza **Técnico** original, não garante). Deslocamento na OS Complementar com aprovação remota = decisão do admin caso a caso.

**OS Preventiva**:
Gerada automaticamente pelo sistema conforme calendário do **Plano de Assinatura**. Sem custo (coberta pelo plano). Segue **Checklist Preventivo**.

**OS Garantia**:
Gerada quando **Cliente** aciona garantia válida. Vinculada à OS original. Sem custo. Validação de prazo = automática. Correspondência com **Orçamento Complementar** rejeitado = decisão humana (admin sinalizado pelo sistema). Atribuição: **Técnico** original primeiro; se indisponível, cai na fila filtrada por especialidade. Admin pode override. OS original transita pra GARANTIA_ABERTA (estado terminal).

### Estados da OS

**NOVA**: Solicitação criada, aguardando orçamento.
**ORÇADA**: Orçamento montado e enviado ao cliente.
**APROVADA**: Cliente assinou (digital ou presencial).
**REJEITADA**: Cliente recusou orçamento.
**EXPIRADA**: Prazo de resposta esgotado sem ação do cliente.
**AGENDADA**: Slot de data/horário reservado.
**A_CAMINHO**: Técnico sinalizou deslocamento.
**NO_LOCAL**: Técnico sinalizou chegada.
**EM_EXECUÇÃO**: Foto antes tirada, trabalho em andamento. Metadado opcional: "aguardando complementar" (quando técnico não pode continuar sem aprovação de **Orçamento Complementar**).
**CONCLUÍDA**: Foto depois tirada, trabalho finalizado.
**PAGA**: Pagamento confirmado (webhook ou manual).
**CANCELADA**: Cancelada por qualquer ator com motivo registrado.
**GARANTIA_ABERTA**: Cliente acionou garantia válida. Estado terminal da OS original — gera nova **OS Garantia**.

### Caminhos por Tipo de OS

| Tipo | Caminho |
|------|---------|
| NORMAL | NOVA → ORÇADA → APROVADA → AGENDADA → A_CAMINHO → NO_LOCAL → EM_EXECUÇÃO → CONCLUÍDA → PAGA |
| EXPRESS | NOVA → ORÇADA → APROVADA → EM_EXECUÇÃO → CONCLUÍDA → PAGA |
| COMPLEMENTAR (presencial) | NOVA → ORÇADA → APROVADA → EM_EXECUÇÃO → CONCLUÍDA → PAGA |
| COMPLEMENTAR (ausente) | NOVA → ORÇADA → APROVADA → AGENDADA → A_CAMINHO → NO_LOCAL → EM_EXECUÇÃO → CONCLUÍDA → PAGA |
| PREVENTIVA | AGENDADA → A_CAMINHO → NO_LOCAL → EM_EXECUÇÃO → CONCLUÍDA |
| GARANTIA | AGENDADA → A_CAMINHO → NO_LOCAL → EM_EXECUÇÃO → CONCLUÍDA |

PREVENTIVA e GARANTIA terminam em CONCLUÍDA (sem PAGA — sem custo). Transição APROVADA → EM_EXECUÇÃO direta permitida quando **Técnico** já está NO_LOCAL (Visita Técnica com execução imediata, Express, Complementar presencial).

### Permissões e Módulos

**Módulo**:
Unidade de permissão binária (tem ou não tem acesso). Seis módulos: Operação, Financeiro, Marketing, Equipe, Garantias, Catálogo. Dashboard não é módulo — é reflexo filtrado dos módulos que o **Membro Interno** possui.
_Avoid_: Permissão, role, escopo, feature flag

### Agendamento

**Slot**:
Bloco de data/horário disponível na agenda de um **Técnico**. Definido dentro do horário comercial configurado pelo admin. **Técnico** pode restringir disponibilidade individual dentro do range.
_Avoid_: Horário, janela, bloco, time window

**Instant Booking**:
Modelo híbrido de agendamento. Sistema filtra **Técnicos** por especialidade + disponibilidade automaticamente. **Cliente** escolhe **Slot** (não escolhe técnico). Admin pode reatribuir.
_Avoid_: Agendamento manual, reserva direta

**Visita Técnica**:
Variação do fluxo Remoto. Informação do formulário insuficiente pra orçar — **Técnico** agenda visita de avaliação. No local: tira fotos, descreve problema real, monta **Orçamento** presencial. **Cliente** pode aprovar ali (**Aprovação Presencial**) ou receber link pra aprovar depois. Se aprovou e serviço é simples, **Técnico** pode executar na hora — estados de deslocamento da visita ficam no histórico (aconteceram de verdade), OS transita APROVADA → EM_EXECUÇÃO direta (permitido quando técnico já está NO_LOCAL). OS continua tipo NORMAL.
_Avoid_: Vistoria, inspeção, laudo

**Reagendamento**:
Transição de AGENDADA → AGENDADA (novo slot). Não é estado — é ação. Três atores podem reagendar com regras diferentes. Cancelamento libera **Slot** automaticamente (volta pro instant booking).

**Cancelamento pelo Cliente**:
Até 24h antes → cancelamento direto (site ou WhatsApp), sem taxa. Dentro de 24h → bloqueado no sistema, tela redireciona pra wa.me do admin. Admin decide caso a caso.

### Pagamento

**Checkout Consolidado**:
Página de pagamento que mostra **OS** concluídas de uma **Solicitação**. Cada OS tem link individual. Se múltiplas concluídas, opção "pagar tudo junto". Cliente escolhe.
_Avoid_: Carrinho, cart, fatura unificada

**Pagamento Flexível**:
Pagamento pode ser na hora (QR Pix na tela do PWA, dinheiro, transferência) ou depois (link digital). Nunca obrigatório pra concluir OS. Técnico confirma pagamento manual na plataforma.

**Aprovação Presencial**:
Cliente assina na tela do **Técnico** (como entrega de encomenda). Checkbox de aprovação do orçamento + assinatura capturada. Registrado como "aprovado presencial". Usado em: OS Express (LGPD já coletado no E1), Visita Técnica com aprovação no local, Orçamento Complementar com cliente presente. Na Visita Técnica: dois checkboxes (LGPD + Orçamento) se LGPD não foi coletado antes.
_Avoid_: Assinatura verbal, aceite oral

### Assinatura e Fidelização

**Plano de Assinatura**:
Contrato de manutenção recorrente com visitas preventivas, desconto e prioridade. Cobrança via Mercado Pago Subscriptions API. Três planos: Básico, Conforto, Premium. Upgrade: efetivo imediato, diferença proporcional cobrada. Downgrade: efetivo no fim do ciclo pago. Cancelamento: efetivo no fim do ciclo pago — preventivas dentro do ciclo acontecem normalmente; ao efetivar, sistema cancela automaticamente preventivas futuras (AGENDADA → CANCELADA, motivo: "assinatura encerrada").
_Avoid_: Contrato, mensalidade, subscription

**Checklist Preventivo**:
Lista de itens de verificação por categoria de serviço, definida pelo admin no **Catálogo**. **Técnico** segue no PWA + adiciona observações. Resultado vira relatório pro **Cliente**.

**Indicação (Referral)**:
Link único por **Cliente**. Incentivo duplo: quem indica ganha crédito, indicado ganha desconto no primeiro serviço. Gatilho: indicado conclui e paga. Entrega do link: após avaliação ≥ 4★ (junto com link Google Business) + sempre acessível no portal.
_Avoid_: Programa de afiliados, cupom

### Confiança e Garantia

**Garantia de Mão de Obra**:
Prazo definido por tipo de serviço no **Catálogo**. Certificado PDF gerado ao concluir OS. Acionamento: botão no portal, descrição + foto obrigatória. Validação automática: prazo vigente. Se existe **Orçamento Complementar** rejeitado na OS original → sistema sinaliza pro admin com detalhes. Admin (módulo Garantias) decide se garantia se aplica — correspondência problema-complementar é julgamento humano, não automático.
_Avoid_: Warranty, seguro, proteção

**Tratativa**:
Registro de ação tomada pelo admin (módulo Marketing) em resposta a avaliação ≤ 3★. Vinculada à avaliação e à OS. Após resolução, sistema pede reavaliação.
_Avoid_: Reclamação, complaint, caso

### Comunicação

**wa.me**:
Link que abre WhatsApp com mensagem pré-preenchida. Grátis, sem API. Usado para: formulário → empresa, técnico → cliente.
_Avoid_: WhatsApp link, deep link

**Cloud API**:
WhatsApp Business Cloud API (Meta). Mensagens proativas com templates aprovados. Usado para: notificações de ação imediata (orçamento pronto, técnico a caminho, lembrete pagamento, remarketing, avaliação). Horário restrito 8h-20h (exceção: emergência Premium).

### Área de Atendimento

**Raio de Cobertura**:
Ponto central + distância em km, configurado no módulo Operação. Fora do raio → aviso suave no formulário, não bloqueia envio. Deslocamento calculado automaticamente no orçamento.

### Self-Assign e Devolução

**Self-Assign**:
**Técnico** se atribui a uma OS aberta da fila (filtrada por especialidade). Antes de montar **Orçamento** (OS em NOVA), pode devolver com motivo breve obrigatório — OS volta pra fila sem atribuição. Depois de orçar (ORÇADA+), só cancela com motivo completo.

### Reagendamento pelo Técnico

Antes de A_CAMINHO → reagendamento livre (novo **Slot**). Depois de A_CAMINHO → motivo obrigatório. Cancelamento sempre com motivo — OS volta pra fila (AGENDADA sem técnico) pra reatribuição. Em EM_EXECUÇÃO não cancela — cria **Orçamento Complementar** ou registra motivo como metadado "aguardando complementar".

### Avaliação

Nota por **OS**, não por **Solicitação**. Tela única agrupa todas as OS da **Solicitação** — cliente avalia cada uma separadamente (estrelas individuais) + comentário geral opcional. Cada nota vinculada à OS e ao **Técnico** responsável. Link Google Business: só se **todas** as notas da **Solicitação** ≥ 4★. Link de **Indicação (Referral)**: entregue junto com link Google Business após avaliação ≥ 4★. Lembrete único 48h se não avaliou.

### Vinculação Google

Primeiro Google OAuth a acessar portal vincula ao número do **Cliente** (do formulário). Admin pode desvincular Google no módulo Equipe (edge case: vinculação errada).

### Sincronização Offline

**Conflito de Reatribuição**:
Admin não pode reatribuir OS em EM_EXECUÇÃO. Se precisa tirar do **Técnico**, primeiro força status de volta pra AGENDADA (ação explícita com motivo), aí reatribui. Dados locais (fotos, notas) do técnico original sincronizam como histórico — nada se perde. Se **Técnico** concluiu offline e OS foi reatribuída enquanto estava sem sinal, sync detecta conflito → dados salvos como histórico + notificação pro técnico e admin. Admin resolve manualmente.

## Flagged Ambiguities

**Solicitação vs OS**: Uma **Solicitação** é o pedido do cliente (1 formulário). Uma **OS** é a unidade de trabalho por especialidade. 1 Solicitação → N OS. Cliente interage com Solicitação. Sistema opera com OS.

**Técnico vs Membro Interno**: **Técnico** é flag de campo (PWA, fotos, execução). **Membro Interno** é acesso ao painel. São independentes — um pode ser ambos (Diego = técnico + admin raiz).

**Orçamento vs OS**: **Orçamento** é a proposta de preço. **OS** é o ciclo de vida completo do trabalho. Orçamento existe dentro da OS (estado ORÇADA).

## Example Dialogue

> **Dev**: O cliente mandou uma solicitação pedindo elétrica e pintura. Isso é uma OS ou duas?
>
> **Domain Expert**: É uma Solicitação só, mas gera duas OS — uma pra cada categoria. Cada uma com técnico, agenda e garantia separados. Mesmo que Diego faça as duas, são duas OS — 1 OS = 1 categoria = 1 técnico = 1 garantia. Cliente vê tudo agrupado na Solicitação.
>
> **Dev**: E se durante a elétrica o técnico descobre que precisa trocar fiação?
>
> **Domain Expert**: Ele cria um Orçamento Complementar na mesma OS. Se o cliente está ali, assina na tela — aprovação presencial. Se saiu, vai notificação e espera. OS Complementar aprovada remotamente segue agendamento normal — prioriza técnico original mas não garante.
>
> **Dev**: E se o cliente recusar esse complementar e depois acionar garantia porque a fiação deu problema?
>
> **Domain Expert**: Sistema valida prazo automaticamente. Se tem Complementar rejeitado, sinaliza pro admin com detalhes. Admin decide se garantia se aplica — essa correspondência é julgamento humano, não automático.
>
> **Dev**: Dona Maria não tem Google. Consegue aprovar orçamento?
>
> **Domain Expert**: Sim. Ela recebe link por WhatsApp com token. Aprova pelo link + código de verificação via WhatsApp. Sem login. Google é só pra portal completo.
