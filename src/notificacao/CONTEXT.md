# Notificação

Camada de comunicação entre sistema e pessoas. Decide canal, horário e prioridade. Não tem módulo admin próprio — configuração distribuída entre Operação (horário, templates) e Marketing (remarketing).

## Language

**wa.me**:
Link que abre WhatsApp com mensagem pré-preenchida. Grátis, sem API, sem conta Business. Usado para ações iniciadas pelo usuário: formulário → empresa, técnico → cliente (botão no PWA com número pré-preenchido).
_Avoid_: WhatsApp link, deep link, API

**Cloud API**:
WhatsApp Business Cloud API (Meta). Mensagens proativas enviadas pelo sistema. Templates aprovados pela Meta. 1.000 conversas/mês grátis. Pré-requisito: número migrado pra WhatsApp Business verificado.
_Avoid_: WhatsApp API, Bot API

**Canal**:
Meio de entrega: WhatsApp (Cloud API) ou E-mail (Resend). Escolha por **Prioridade de Canal**.
_Avoid_: Meio, via, método

**Prioridade de Canal**:
WhatsApp pra ação imediata (orçamento pronto, técnico a caminho, lembrete pagamento, remarketing, avaliação). E-mail pra documentação (fatura PDF, fotos antes/depois, certificado garantia, resumo mensal, boas-vindas assinatura). Otimiza custo Cloud API.
_Avoid_: Regra de canal, routing

**Horário Restrito**:
Notificações proativas só entre 8h-20h. Gatilho fora do horário → entra na **Fila de Envio**, sai às 8h. Exceção: alerta emergência Premium → notifica admin imediatamente.
_Avoid_: Janela de envio, quiet hours

**Fila de Envio**:
Buffer pra notificações geradas fora do Horário Restrito. Processa automaticamente às 8h. FIFO.
_Avoid_: Queue, buffer, scheduler

**Template**:
Mensagem pré-aprovada pela Meta pra Cloud API. Admin configura no módulo Operação: confirmação solicitação, orçamento pronto, lembrete pagamento, remarketing, avaliação. Texto com variáveis (nome, valor, link).
_Avoid_: Mensagem padrão, modelo

**Evento de Notificação**:
Cada transição de estado da OS emite evento. Contexto Notificação consome e decide: qual canal, qual template, qual horário. Outros contextos emitem eventos também (pagamento falho, remarketing, avaliação).
_Avoid_: Trigger, webhook interno, signal

**Marco de Notificação**:
Registro único por (referência, evento) que o contexto reivindica antes de enviar. Garantia do contexto Notificação, não do emissor. A referência é genérica: id de OS para eventos de OS, id de assinatura para eventos de assinatura. Limitação consciente: claim ganho + falha de canal posterior não reenvia (sem retry parcial por canal).
_Avoid_: Dedup, lock de envio, flag de enviado

## Relationships

- **Notificação ← Operação**: transições de estado OS emitem eventos
- **Notificação ← Financeiro**: pagamento falho, fatura gerada, assinatura ativada/cancelada
- **Notificação ← Marketing**: remarketing, reativação, avaliação, tratativa
- **Notificação → Resend**: e-mails com React Email templates + React PDF anexos
- **Notificação → WhatsApp Cloud API**: mensagens proativas com templates Meta
- **Notificação → wa.me**: links gerados pra Portal e PWA técnico (não passa por este contexto — é client-side)

## Example Dialogue

> **Dev**: Técnico concluiu OS às 22h. Cliente recebe notificação?
>
> **Domain Expert**: Não imediatamente. Evento de conclusão gera notificação, mas 22h está fora do horário (8h-20h). Entra na fila, sai às 8h do dia seguinte. Fatura PDF vai por e-mail (documento). Status atualizado no portal se cliente acessar.
>
> **Dev**: E se for emergência Premium?
>
> **Domain Expert**: Alerta pro admin sai imediato, sem restrição de horário. Mas notificação pro cliente segue horário restrito — emergência é pra o admin reagir, não pro cliente receber mensagem às 3h.
