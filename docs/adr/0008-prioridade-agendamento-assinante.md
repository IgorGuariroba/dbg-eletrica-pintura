# ADR-0008 — Prioridade de agendamento para assinante (flag, sem disputa concorrente)

## Status

Aceito (#56, Fase 5 / Slice 2).

## Contexto

Planos de assinatura prometem "prioridade no agendamento" (campo
`plano.prioridade_agendamento`). A issue #56 permite, nesta fase, uma **regra
simples documentada**: "quando dois clientes disputam o mesmo slot, assinante
vence (ou em fase de implementação simples, agente decide a regra e documenta)".

O motor de slots (`calcularSlotsDisponiveis`) é puro e calcula a disponibilidade
de cada técnico de forma independente por cliente. A reserva
(`reservarSlot`) é **FCFS** (first-come-first-served): o primeiro que reserva um
horário vence, e o segundo recebe `SlotIndisponivelError`. Não existe um ponto de
contenção concorrente onde dois clientes "disputem" o mesmo slot ao mesmo tempo —
logo, um leilão/desempate real exigiria segurar slots (hold/lock), fora do escopo
desta fatia.

## Decisão

1. `SlotDisponivel` ganha uma flag opcional `prioridade?: boolean`.
2. `calcularSlotsDisponiveis({ assinante: true })` marca **todos** os slots
   retornados com `prioridade: true`; para não-assinante a flag fica ausente.
3. `listarSlotsDisponiveis` (loader) repassa `assinante` ao motor; o caller
   (fluxo de agendamento) decide o valor a partir da assinatura ATIVA do cliente.
4. A flag é o **ponto de extensão** para a precedência de assinante (badge na UI,
   ordenação, ou hold concorrente futuro). O **desempate concorrente real fica
   deferido** — quando houver demanda, implementa-se segurando o slot por um
   curto TTL antes de confirmar.

## Consequências

- **Prós:** comportamento testável e honesto sem reescrever a reserva FCFS;
  cumpre o critério da issue ("regra simples documentada"); não introduz lock
  distribuído prematuro.
- **Contras:** a "prioridade" hoje é informativa (flag), não garante o slot numa
  corrida real entre assinante e não-assinante. Documentado como limitação
  consciente, a evoluir num slice futuro de booking concorrente.
