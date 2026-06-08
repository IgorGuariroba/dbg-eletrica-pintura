# Operação

Ciclo de vida completo de solicitações e ordens de serviço — da entrada do pedido à conclusão. Inclui orçamentos, agendamento, rastreamento de campo e fila de trabalho. Contexto mais central do sistema.

## Language

**Solicitação**:
Pedido do cliente. Criada via formulário (remoto) ou pelo técnico no local (express). Contém: WhatsApp, categorias, fotos, endereço, descrição. Gera 1 ou mais **OS** automaticamente (1 por categoria). É o agrupador que o cliente vê.
_Avoid_: Pedido, chamado, ticket

**Ordem de Serviço (OS)**:
Unidade atômica de trabalho. Sempre filha de uma **Solicitação**. Tem um **Tipo**, um **Estado**, um técnico atribuído. 1 OS = 1 técnico sempre. Cinco tipos: Normal, Express, Complementar, Preventiva, Garantia.
_Avoid_: Tarefa, job, work order

**Orçamento**:
Proposta de preço composta por itens do Catálogo (preço base × quantidade). Breakdown: material + mão de obra + deslocamento. Montado por técnico ou membro com módulo Operação. Válido por prazo configurável (default 7 dias).
_Avoid_: Proposta, cotação, estimate

**Orçamento Complementar**:
Orçamento adicional criado durante execução. Técnico descobre serviço extra não previsto. Gera OS tipo COMPLEMENTAR vinculada à OS pai. Rejeição registrada = proteção de garantia.
_Avoid_: Adendo, aditivo

**Fila**:
Solicitações aguardando orçamento, ordenadas por urgência e data. Qualquer membro com módulo Operação pode processar.
_Avoid_: Backlog, inbox, pipeline

**Slot**:
Bloco de data/horário na agenda do técnico. Dentro do horário comercial configurado. Técnico pode restringir disponibilidade individual.
_Avoid_: Horário, janela, time window

**Instant Booking**:
Modelo híbrido de agendamento. Sistema filtra técnicos por especialidade + disponibilidade. Cliente escolhe Slot (não técnico). Admin pode reatribuir (override).
_Avoid_: Agendamento manual, reserva

**Raio de Cobertura**:
Ponto central + km, configurado no módulo Operação. Fora do raio → aviso suave no formulário, não bloqueia. Deslocamento calculado automaticamente (km × valor/km configurável).
_Avoid_: Zona, região, área

**Merge de OS**:
Admin/técnico junta múltiplas OS de uma Solicitação em uma só. Usado quando mesmo técnico faz tudo (ex: Diego faz elétrica + pintura). Operação inversa da separação automática.
_Avoid_: Unificar, combinar

### Estados

**NOVA** → **ORÇADA** → **APROVADA** → **AGENDADA** → **A_CAMINHO** → **NO_LOCAL** → **EM_EXECUÇÃO** → **CONCLUÍDA** → **PAGA**

Caminhos alternativos: ORÇADA → REJEITADA | EXPIRADA. Qualquer estado → CANCELADA (com motivo).
Garantia: PAGA → GARANTIA_ABERTA → nova OS tipo GARANTIA.
Express: pula AGENDADA, A_CAMINHO, NO_LOCAL.
Reagendamento: AGENDADA → AGENDADA (transição, não estado).

**Predicados de estado** (elegibilidade pontual, sem transição — `estado-predicados.ts`):
- **Pagável**: OS pode iniciar cobrança. `estado === CONCLUÍDA` (PAGA já está paga). Gate de Pix/link/checkout/pagamento manual.
- **Entregue**: serviço entregue ao cliente. `CONCLUÍDA | PAGA`. Base para acionar garantia e listar ordens do checkout.

Como `PAGA` é estado próprio, "Pagável" não precisa de flag de pagamento separada — `pago` é derivado de `estado === PAGA`.

### Tipos de OS

| Tipo | Origem | Custo | Particularidade |
|------|--------|-------|-----------------|
| Normal | Formulário remoto | Pago | Fluxo completo |
| Express | Técnico no local | Pago | Pula agendamento/deslocamento |
| Complementar | Extra durante execução | Pago | Vinculada a OS pai |
| Preventiva | Sistema (calendário plano) | Sem custo | Segue checklist, recorrente |
| Garantia | Cliente aciona | Sem custo | Vinculada a OS original |

## Relationships

- **Operação → Catálogo**: orçamento monta itens do Catálogo; OS herda garantia; preventiva segue checklist
- **Operação → Equipe**: agendamento consulta disponibilidade; atribuição por especialidade
- **Operação → Financeiro**: OS concluída dispara checkout; preventiva = sem custo; assinante tem prioridade
- **Operação → Notificação**: cada transição de estado emite evento → canal decidido por prioridade
- **Operação → Portal**: formulário cria Solicitação; PWA técnico muda estados; portal cliente exibe status

## Example Dialogue

> **Dev**: Técnico está no local, descobre fiação ruim. O que acontece?
>
> **Domain Expert**: Cria Orçamento Complementar na mesma OS. Se cliente presente → assina na tela, OS Complementar pula pra EM_EXECUÇÃO. Se ausente → notificação, espera aprovação remota — se aprovar, agenda volta do técnico.
>
> **Dev**: E se o técnico não consegue resolver e quer cancelar?
>
> **Domain Expert**: Duas opções: cancela definitivo (motivo obrigatório, OS → CANCELADA) ou converte pra remoto — OS volta pra ORÇADA/AGENDADA, entra na fila pra reagendar.
