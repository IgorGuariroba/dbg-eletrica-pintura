# Plano TDD — Issue #43 · Fase 3 / Slice 10

**Reagendamento / Cancelamento multi-ator + agenda do técnico**

> Parent: #7 · Blocked by #36 (CLOSED — desbloqueado)

---

## 1. Objetivo

Permitir transições `AGENDADA → AGENDADA` (novo slot) ou `AGENDADA → CANCELADA/APROVADA`
disparadas por três atores (Cliente, Técnico, Admin Operação), com regras distintas por ator,
liberação automática de slot e visão de agenda para o técnico.

---

## 2. O que já existe (REUSAR — Regra de Ouro)

| Peça | Arquivo | Cobre |
| --- | --- | --- |
| Cancelar/reagendar **técnico** | `src/operacao/reagendamento.ts` | Fase 2 / Slice 8. Regras pré/pós `A_CAMINHO`, exige motivo, devolve à fila |
| Repo de reagendamento (batch + histórico) | `src/operacao/reagendamento-repo-drizzle.ts` | `update ordemServico` + `insert transicaoOs` no mesmo batch |
| Reserva de slot (cliente agenda OS APROVADA) | `src/operacao/reserva-slot.ts` + `…-repo-drizzle.ts` | `APROVADA → AGENDADA`, índice único libera corrida de slot |
| Motor de slots | `src/operacao/slots-loader.ts` + `slots.ts` | **Liberação de slot é automática**: só conta estados `AGENDADA/A_CAMINHO/NO_LOCAL/EM_EXECUCAO` |
| Slots para o cliente | `src/operacao/agendamento-cliente.ts` | `validarOsAgendavel` (só APROVADA), `escolherSlot`, `slotsPorHorario`, `DIAS_AGENDAMENTO=14` |
| Action de agendar (cliente) | `src/app/s/[token]/agendamento-actions.ts` | `listarSlotsOsAction`, `agendarOsAction` |
| **Histórico** ator+motivo+timestamp | tabela `transicaoOs` (`src/db/schema.ts`) | AC "histórico de reagendamentos" já satisfeito pelo registro de transição |
| wa.me da empresa | `src/lib/contato.ts` (`WHATSAPP_NUMERO`, `linkWhatsapp`), `src/lib/whatsapp.ts` | redirect "dentro de 24h" e "sem Google" |
| Guard portal logado | `src/portal/guard.ts` (`exigirPortal`) | sessão cliente + WhatsApp vinculado |
| Wiring de action do técnico | `src/app/campo/os/[id]/acoes.ts` | padrão de Server Action a copiar |

### Consequência importante
A **liberação automática de slot** (AC 6) já é uma propriedade do `slots-loader`: ao cancelar
(`estado` sai de AGENDADA / `tecnicoId=null`) ou reagendar (`agendadoPara` muda), o slot antigo
deixa de ser ocupação na próxima consulta. **Não há código novo de "liberar slot"** — só teste
que prova a propriedade.

---

## 3. O que falta construir

1. **Regra pura de janela de 24h** (cliente) — `> 24h` permite, `≤ 24h` bloqueia.
2. **Domínio cliente**: `cancelarOsCliente` (→ `APROVADA`, `tecnicoId=null`, `agendadoPara=null`)
   e `reagendarOsCliente` (reusa reserva de slot, valida janela).
3. **Domínio admin**: cancelar/reagendar qualquer OS **pré-execução**, com motivo, **em lote**.
4. **Rotas portal**: botões reagendar/cancelar em OS `AGENDADA > 24h` + telas
   `/portal/os/{id}/reagendar` e `/portal/os/{id}/cancelar`.
5. **Redirect wa.me**: dentro de 24h (tela bloqueia) e sem Google (redirect direto).
6. **Admin `/admin/operacao/agenda`**: lista OS futuras, ações por linha + seleção em lote.
7. **Agenda do técnico** (PWA): dia + 7 dias, refetch 60s.

### ⚠️ Decisão a confirmar — rota do PWA
A issue cita `/pwa/agenda`, mas **o PWA do técnico vive em `/campo`** (não existe `/pwa`).
**Proposta:** construir em **`/campo/agenda`** para manter a convenção. Confirmar antes de codar a UI.

### Mudança de estado nova (cliente cancela)
`maquina-estado.ts` **não** tem `AGENDADA → APROVADA`. O fluxo de reagendamento já bypassa a
máquina (escreve estado direto via repo), então o cliente-cancela seguirá o mesmo padrão do repo,
**zerando também `agendadoPara`** (o técnico-cancela atual não zera). Exige novo método/param no
repo — ver §5 ciclo 2.

---

## 4. Interfaces propostas (revisar antes de codar)

```ts
// src/operacao/reagendamento.ts  (estender, não duplicar)

/** > 24h até o horário agendado: cliente pode mexer sozinho. */
export function dentroDaJanelaCliente(agendadoPara: Date, agora: Date): boolean;
//  retorna true quando faltam ≤ 24h (bloqueia self-service)

export class ForaDaJanelaError extends Error { readonly status = 409; } // ≤24h

export async function cancelarOsCliente(
  osId: string,
  cliente: { whatsapp: string },     // ator = "cliente:<whatsapp>"
  repo: ReagendamentoRepo,
  agora?: Date,
): Promise<void>;
//  carrega OS → valida estado AGENDADA + janela → repo.cancelarParaApr(...)

export async function reagendarOsCliente(
  osId: string,
  cliente: { whatsapp: string },
  novoSlot: Date,
  repo: ReagendamentoRepo,
  agora?: Date,
): Promise<void>;
//  valida AGENDADA + janela → repo.reagendar(...) (reusa) — sem motivo (cliente)
```

```ts
// ReagendamentoRepo — adicionar um método (cliente zera agendadoPara)
cancelarParaAprovada(
  osId: string,
  registro: RegistroTransicao,   // estadoNovo = "APROVADA"
): Promise<void>;
//  set estado=APROVADA, tecnicoId=null, agendadoPara=null  + transicaoOs
```

```ts
// src/operacao/reagendamento-lote.ts  (novo — admin)

/** Estados pré-execução em que o admin pode agir. */
const PRE_EXECUCAO: EstadoOs[] = ["APROVADA","AGENDADA","A_CAMINHO","NO_LOCAL"];

export async function cancelarLoteAdmin(
  osIds: string[],
  admin: { email: string },
  motivo: string,                // único, aplicado a todas; mín. 10 chars
  repo: ReagendamentoRepo,
  agora?: Date,
): Promise<{ osId: string; ok: boolean; erro?: string }[]>;
//  para cada OS: valida pré-execução → cancela → coleta resultado (não aborta o lote)
```

```ts
// src/operacao/agenda-tecnico.ts  (novo — leitura)

export interface ItemAgenda {
  osId: string; categoria: Categoria; agendadoPara: Date;
  endereco: string; estado: EstadoOs;
}
export async function agendaDoTecnico(
  db: DB, tecnicoId: string, agora: Date,
): Promise<ItemAgenda[]>;
//  OS do técnico com agendadoPara em [hoje 00h, hoje+7d], estados ativos, ordenado
```

---

## 5. Sequência TDD (tracer bullets — um teste, uma implementação)

> Regras: vertical slice. RED → GREEN por comportamento. Sem refatorar no vermelho.
> Testar **comportamento via interface pública**, nunca detalhe interno.
> `pnpm test` por ciclo; `lint`+`typecheck` antes de cada commit.

### Bloco A — Domínio Cliente (unit, puro/mock)
Arquivo: `tests/unit/operacao-reagendamento-cliente.test.ts`

1. **Janela 24h — permite.** `dentroDaJanelaCliente(agendado, agora)` com 25h de folga → `false`
   (não está dentro da janela de bloqueio). _impl:_ função pura.
2. **Janela 24h — bloqueia.** 23h de folga → `true`. _impl:_ comparação `≤ 24h`.
3. **Cliente cancela 25h antes → OS vira APROVADA, técnico/data zerados.** mock repo, assert
   `cancelarParaAprovada` chamado com `estadoNovo="APROVADA"`. _impl:_ `cancelarOsCliente`.
4. **Cliente tenta cancelar 23h antes → `ForaDaJanelaError`.** _impl:_ guarda de janela.
5. **Cliente só cancela OS AGENDADA** (ex.: `EM_EXECUCAO` → `EstadoInvalidoError`). _impl:_ guarda estado.
6. **Cliente reagenda 25h antes → repo.reagendar com novo slot, ator `cliente:<wpp>`.** _impl:_ `reagendarOsCliente`.
7. **Cliente reagenda 23h antes → `ForaDaJanelaError`.** _impl:_ reuso da guarda.

### Bloco B — Liberação de slot (integration, banco real)
Arquivo: `tests/integration/operacao-reagendamento-cliente.test.ts`

8. **Cliente reagenda 25h antes → libera slot anterior + reserva novo.**
   Semear OS AGENDADA(slot S1). Reagendar p/ S2. Assert: `slots-loader` volta a oferecer S1;
   OS agora em S2. _(prova AC "libera slot imediatamente" + AC teste 25h)_ _impl:_ fio cliente→repo→loader.
9. **Cliente cancela → slot volta a ficar disponível e OS = APROVADA.** _impl:_ idem via cancelar.

### Bloco C — Domínio Admin / lote (unit)
Arquivo: `tests/unit/operacao-reagendamento-lote.test.ts`

10. **Admin cancela OS APROVADA/AGENDADA/A_CAMINHO/NO_LOCAL com motivo.** _impl:_ `cancelarLoteAdmin` + `PRE_EXECUCAO`.
11. **Admin não cancela OS EM_EXECUCAO/CONCLUIDA** → item marcado `ok:false`, lote continua. _impl:_ try/catch por item.
12. **Motivo curto (<10) → erro para todas.** _impl:_ valida motivo antes do loop.
13. **Lote de 5 OS com motivo único → 5 resultados `ok:true`.** _(AC teste lote)_ _impl:_ map sobre ids.

### Bloco D — Agenda do técnico (integration)
Arquivo: `tests/integration/operacao-agenda-tecnico.test.ts`

14. **Agenda traz só OS do técnico em [hoje, hoje+7d], ordenado por horário.** _impl:_ `agendaDoTecnico` query.
15. **Cliente reagenda → agenda do técnico reflete na releitura.** (reusa fio do bloco B). _impl:_ nenhum novo — prova revalidação.

### Bloco E — Server Actions (wiring; teste leve ou via integração de página)
- `src/app/portal/os/[id]/actions.ts`: `reagendarOsClienteAction`, `cancelarOsClienteAction`
  → `exigirPortal`, chama domínio, `revalidatePath('/portal/...')`, trata `ForaDaJanelaError`.
- `src/app/admin/operacao/agenda/actions.ts`: `cancelarLoteAction`, `reagendarLinhaAction`
  → guard admin (`src/app/admin/operacao/guard.ts`), motivo único, revalidate.

---

## 6. UI (segue o fluxo obrigatório Builder→UX→Frontend→Refactor, §2 do AGENTS.md)

> Toda UI exige validação visual via Playwright/Chrome-DevTools MCP nas 4 resoluções
> (390/768/1366/1920) com dev bypass de auth. Sem isso a tarefa não fecha.

### 6.1 Portal cliente
- Na `src/app/portal/solicitacao/[id]/page.tsx`: em cada OS `AGENDADA`, botões **Reagendar** /
  **Cancelar** (variantes secundárias — não competem com CTA "Pagar Serviços"). Mostrar só se `> 24h`.
- `/portal/os/[id]/reagendar`: reusa o seletor de slots do fluxo `/s/[token]` (`listarSlotsOsAction`
  análogo). `≤ 24h`: tela de bloqueio + `Button` link wa.me. Sem sessão Google: redirect direto wa.me
  (no guard da rota, antes do `exigirPortal`).
- `/portal/os/[id]/cancelar`: `AlertDialog` de confirmação (shadcn) → action.

### 6.2 Admin `/admin/operacao/agenda`
- **Densidade Tabela (§10.3):** desktop = `Table` de OS futuras (data, cliente, categoria,
  técnico, estado, ações). Mobile (>4 col) = **lista de Cards** com busca/filtro.
- Seleção em lote via `Checkbox` por linha + barra de ações com `Dialog` (motivo único `Textarea`).
- Ações por linha: reagendar / cancelar (com motivo).

### 6.3 Agenda do técnico (PWA — confirmar `/campo/agenda`)
- Lista agrupada por dia (hoje + 7d). Client Component com refetch 60s
  (`setInterval` + Server Action, ou `revalidate`/router.refresh). Densidade Detalhes mobile (§10.4).

---

## 7. Mapa de Acceptance Criteria → onde fecha

| AC | Onde |
| --- | --- |
| Portal mostra reagendar/cancelar em AGENDADA > 24h | §6.1 + Bloco A/E |
| Dentro de 24h: bloqueia + wa.me | §6.1 (tela bloqueio) + teste A4/A7 |
| Sem Google: redirect direto wa.me | guard da rota §6.1 |
| Admin `/operacao/agenda` lista + ações + lote | §6.2 + Bloco C |
| Lote: motivo único | Bloco C (12,13) |
| Cancelamento libera slot imediatamente | Bloco B (8,9) — propriedade do `slots-loader` |
| PWA agenda dia+7d refetch 60s | §6.3 + Bloco D |
| Histórico ator+motivo+timestamp | `transicaoOs` (já existe) — registrado em todo cancel/reagenda |
| Teste cliente reagenda 25h → libera+reserva | Bloco B (8) |
| Teste cliente 23h → bloqueia+redirect | Bloco A (4,7) + guard §6.1 |
| Teste admin cancela 5 em lote, motivo único | Bloco C (13) |

---

## 8. Riscos / decisões abertas

1. **`/pwa/agenda` vs `/campo/agenda`** — confirmar rota (proposta: `/campo/agenda`).
2. **`AGENDADA → APROVADA` no cliente-cancela** — novo método de repo que zera `agendadoPara`
   (o técnico-cancela atual mantém `agendadoPara`). Não mexer no fluxo do técnico.
3. **Ator do cliente** sem e-mail → registrar `cliente:<whatsapp>` em `transicaoOs.atorEmail`
   (mesmo padrão do `cliente:<token>` em `reserva-slot`).
4. **Refetch 60s no PWA** — escolher entre `router.refresh()` client-side vs Server Action polling;
   preferir o mais simples que mantenha offline-first sem quebrar SW.
5. **Lote parcial** — cancelar lote **não aborta** se uma OS falhar; devolve por-item. Confirmar UX
   do feedback (toast com N ok / M falhas).

---

## 9. Workflow (§13 AGENTS.md)

```
git checkout main && git pull
git switch -c feat/issue-43-reagendamento-multi-ator
# ciclos TDD (blocos A→D), commits incrementais
pnpm lint && pnpm typecheck && pnpm test
# UI: Builder→UX→Frontend→Refactor + validação visual MCP (4 resoluções)
# push + PR p/ main  (corpo: "Closes #43")
```
