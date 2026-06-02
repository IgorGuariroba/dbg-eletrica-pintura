# Plano de Implementação — Issue #44

**Fase 3 / Slice 11 — Dashboard financeiro** (último slice da Fase 3, parent #7)
Metodologia: **TDD** (red→green→refactor, fatias verticais). Depende de #40 (mergeado). Sem desbloqueio a jusante — fecha a Fase 3.

---

## Objetivo

`/admin/financeiro`, acessível só a membros com módulo **FINANCEIRO** (admin raiz sempre). Quatro blocos:

1. **Pagamentos pendentes** — OS `CONCLUIDA` ainda não `PAGA`, ordenadas da mais antiga para a mais nova. Mostra cliente + valor + dias pendente + badge de idade. Botão "Enviar lembrete via wa.me" (manual nesta fase; Cloud API só na Fase 4).
2. **Pagamentos confirmados** — OS `PAGA`, filtro por período (dia/semana/mês).
3. **Faturamento** — soma do recebido no período (número grande, sem gráfico).
4. **Ticket médio** — média do recebido no período.

Sem módulo FINANCEIRO → **403**.

---

## Decisões travadas

### Fonte do valor (confirmada com o usuário)

- **Faturamento, ticket médio, confirmados** → `pagamento.valor` onde `status = 'approved'`.
  É o caixa real: gravado tanto pelo webhook MP (`processar-pagamento.ts`) quanto pelo manual (`registrar-manual.ts`, sempre `approved`). 1 linha por OS (PK composta `payment_id + os_id`). Soma direta, sem subquery de "orçamento mais recente" — ajuda no alvo `<500ms / 1000 OS`. Reflete pagamento manual/parcial divergente do orçamento.
- **Pendentes** (ainda sem linha em `pagamento`) → valor a cobrar = `orcamento.total` do **orçamento aprovado mais recente** da OS (mesma regra do checkout, ver `checkout-query-repo-drizzle.ts:60`).

### Idade da pendência

`diasPendente` = `now - (em da transição para CONCLUIDA)`, lido de `transicao_os` (`estadoNovo = 'CONCLUIDA'`, maior `em`). **Não** usar `ordemServico.atualizadoEm` (muda em qualquer update via `$onUpdate`).

### Período

Calendário corrente, não janela rolante:
- `dia` → de hoje 00:00
- `semana` → da segunda-feira corrente 00:00
- `mes` → do dia 1 do mês corrente 00:00

Função **pura** `intervaloPeriodo(periodo, agora)` → `{ inicio, fim }`, 100% testável sem DB.

### Lembrete wa.me

Reusa `montarLinkWhatsApp` (`src/lib/whatsapp.ts`). Nova mensagem pura `mensagemLembretePagamento` com link `${SITE_URL}/s/{token}/pagar`. Botão é um `<Link>`/`<a>` estilizado como `Button` (variante `asChild`/render) abrindo em nova aba — **sem** server action (link externo).

---

## Arquitetura de arquivos (segue §11 — feature nova)

```txt
src/features/financeiro/
├── financeiro.ts                 # tipos + interface FinanceiroRepo + funções puras de montagem
├── periodo.ts                    # intervaloPeriodo (puro) — candidato a reuso global
├── idade-pendencia.ts            # classificarIdadePendencia (puro)
├── ticket.ts                     # calcularTicketMedio (puro)
├── financeiro-repo-drizzle.ts    # implementação Drizzle do FinanceiroRepo
└── components/
    ├── pendentes-lista.tsx       # lista/cards de pendentes + badge + botão wa.me
    ├── confirmados-lista.tsx     # lista de confirmados + filtro período
    └── resumo-cards.tsx          # cards Faturamento + Ticket médio

src/lib/whatsapp.ts               # + mensagemLembretePagamento (estende, não duplica)

src/app/admin/financeiro/
├── guard.ts                      # exigirFinanceiro() — espelha operacao/guard.ts
└── page.tsx                      # server component: lê repo, compõe blocos

src/app/admin/sidebar-nav.tsx     # + item "Financeiro" (modulo: "FINANCEIRO")
```

> Reutilização (Regra de Ouro): `requireModulo`/`podeAcessarModulo` (`src/auth/require-modulo.ts`), `montarLinkWhatsApp` (`src/lib/whatsapp.ts`), padrão de repo Drizzle (`features/dashboard/dashboard-repo-drizzle.ts`), componentes `Card`/`Badge`/`Button`/`Tabs` de `components/ui/*`. **Nada de HTML cru, cor bruta ou inline style** (§4/§5).

---

## Contratos (interfaces)

```ts
// financeiro.ts
export type Periodo = "dia" | "semana" | "mes";

export interface PagamentoPendente {
  osId: string;
  clienteNome: string;
  clienteWhatsapp: string;
  token: string;            // p/ link /s/{token}/pagar
  valor: string;            // orcamento.total (a cobrar)
  diasPendente: number;
  categoria: Categoria;
}

export interface PagamentoConfirmado {
  osId: string;
  clienteNome: string;
  valor: string;            // pagamento.valor (recebido)
  metodo: string;
  pagoEm: Date;
}

export interface ResumoFinanceiro {
  faturamento: string;      // soma pagamento.valor approved no período
  ticketMedio: string;      // faturamento / qtd
  qtdPagamentos: number;
}

export interface FinanceiroRepo {
  listarPendentes(): Promise<PagamentoPendente[]>;            // ordenado: mais antiga primeiro
  listarConfirmados(intervalo: { inicio: Date; fim: Date }): Promise<PagamentoConfirmado[]>;
  resumoPeriodo(intervalo: { inicio: Date; fim: Date }): Promise<ResumoFinanceiro>;
}
```

```ts
// puros
export function intervaloPeriodo(p: Periodo, agora: Date): { inicio: Date; fim: Date };
export function classificarIdadePendencia(dias: number): "novo" | "1dia" | "3dias";
export function calcularTicketMedio(soma: string, qtd: number): string; // qtd 0 → "0.00"
// whatsapp.ts
export function mensagemLembretePagamento(i: { clienteNome: string; protocolo: string; valor: string; link: string }): string;
```

---

## Fatias TDD (vertical, uma de cada vez: red → green)

> Unitárias em `tests/unit/`, integração em `tests/integration/` com `describe.skipIf(!process.env.DATABASE_URL)` + cleanup no `afterAll` (padrão `dashboard-repo.test.ts`). **Não** escrever todos os testes de uma vez — cada teste responde ao que o anterior revelou.

### Tracer bullet

**Fatia 1 — pendentes aparecem.** `listarPendentes()` devolve uma OS `CONCLUIDA` não paga, com `valor` do orçamento aprovado e dados do cliente.
- RED: seed 1 cliente + solicitação + OS `CONCLUIDA` + orçamento aprovado; espera 1 item com `valor` correto.
- GREEN: query mínima `ordemServico` join `solicitacao`/`cliente`/`orcamento`.

### Núcleo — repo (integração)

**Fatia 2 — OS PAGA não é pendente.** Seed OS `PAGA` → `listarPendentes()` não a inclui.

**Fatia 3 — ordenação por idade.** Duas pendentes com transições `CONCLUIDA` em datas diferentes → a mais antiga vem primeiro. (Introduz join em `transicao_os` p/ `diasPendente`.)

**Fatia 4 — diasPendente vem da transição.** Pendente cuja transição p/ `CONCLUIDA` foi há 4 dias → `diasPendente === 4`.

**Fatia 5 — confirmados no período.** Seed OS `PAGA` com `pagamento` approved dentro do intervalo e outra fora → `listarConfirmados` só inclui a de dentro, com `valor = pagamento.valor`.

**Fatia 6 — faturamento = soma recebida.** Dois pagamentos approved no período → `resumoPeriodo.faturamento` = soma. Um `rejected` no período é ignorado.

**Fatia 7 (spec) — ticket médio = soma ÷ count.** Período com N pagamentos → `ticketMedio === faturamento / qtdPagamentos`. Sem pagamentos → `"0.00"`, sem divisão por zero.

### Puros (unitário)

**Fatia 8 (spec) — badge "3+ dias".** `classificarIdadePendencia(4) === "3dias"`; `(1) === "1dia"`; `(0) === "novo"`; fronteiras `2→"1dia"`, `3→"3dias"`.

**Fatia 9 — intervalo de período.** `intervaloPeriodo("dia"|"semana"|"mes", agoraFixo)` devolve limites esperados (segunda p/ semana, dia 1 p/ mês).

**Fatia 10 — link do lembrete.** `mensagemLembretePagamento` contém `/s/{token}/pagar` e o protocolo; `montarLinkWhatsApp` encoda o texto e limpa não-dígitos do número.

### Gate de acesso

**Fatia 11 — 403 sem módulo.** `exigirFinanceiro()` (ou `requireModulo("FINANCEIRO", …)`) lança `ForbiddenError` p/ membro sem o módulo; admin raiz passa. (Pode ser unitário sobre `podeAcessarModulo`, já coberto pela infra — testar só o guard novo.)

### Refactor (após verde)

- Extrair `intervaloPeriodo` p/ reuso se algum outro módulo precisar (deixar em `features/financeiro` por ora; promover a `lib/` só se um 2º consumidor aparecer — evitar abstração especulativa).
- Conferir duplicação com `npx fallow dupes` (esp. seeds de teste vs `dashboard-repo.test.ts` / `checkout-query-repo.test.ts`).
- Garantir que o cálculo de valor pendente reusa a mesma lógica de "orçamento aprovado mais recente" do checkout, sem reescrever.

---

## UI (Builder → UX → Frontend → Refactor, §2)

Tela tipo **Tabela/Detalhes** (§10.3/10.4). Densidade: desktop alta, mobile média.

- **Resumo no topo (acima da dobra, §7):** 2 cards grandes — Faturamento (dominante) + Ticket médio + contagem. `Card` de `components/ui`.
- **Filtro de período:** `Tabs` (dia/semana/mês) controlando confirmados + resumo. 1 só CTA visual.
- **Pendentes:** desktop = `Table` (`components/ui/table`); mobile = lista de `Card` (§10.3, >4 col vira card). Cada linha: cliente, valor, `Badge` de idade (`1 dia` / `3+ dias` → variante de destaque sutil, **não** `destructive`), botão lembrete (`Button` `variant="outline"` como link wa.me — ação secundária, não compete com nada).
- **Confirmados:** `Table`/cards: cliente, valor, método, data.
- Valores monetários `pt-BR` (`Intl.NumberFormat`), datas relativas/curtas. Texto secundário em `text-muted-foreground` (§6/§7).
- Espaçamento múltiplo de 4px, seções `space-y-8` (§8). Tokens semânticos só (§5). Sem scroll horizontal em 390/768/1366/1920 (§9).

### Validação visual obrigatória (§2.5)

Playwright MCP (ou chrome-devtools MCP), `pnpm dev`, dev bypass `@/auth/dev-bypass` com `DEV_BYPASS_EMAIL` = e-mail admin com módulo FINANCEIRO no `.env.local`.
- 4 resoluções: 390/768/1366/1920 — `scrollWidth === clientWidth` em cada.
- Fluxos: trocar período (dia/semana/mês) e ver resumo/confirmados mudarem; clicar lembrete e conferir URL `wa.me` com texto + link `/s/{token}/pagar`.
- Semear mínimo (1-2 pendentes de idades diferentes + 1-2 confirmados no período) e **remover tudo ao final** (linhas + `DEV_BYPASS_EMAIL` + processo `pnpm dev`).
- Screenshots das 4 resoluções no relatório.

---

## Acceptance criteria → cobertura

| Critério (issue) | Onde | Fatia |
| --- | --- | --- |
| `/admin/financeiro` só com módulo FINANCEIRO | guard + page | 11 |
| Lista pendentes (CONCLUIDA não PAGA) por idade | repo | 1,2,3 |
| Lista PAGA filtro dia/semana/mês | repo + Tabs | 5,9 |
| Faturamento + ticket médio por período | repo | 6,7 |
| Botão wa.me abre WhatsApp c/ link `/s/{token}/pagar` | whatsapp.ts + UI | 10 |
| Badge "1 dia"/"3 dias" por idade | puro + UI | 8 |
| Queries < 500ms com 1000 OS | índices + medição manual | — |
| Teste: ticket médio = soma ÷ count | integração | 7 |
| Teste: pendente 4 dias → badge "3+ dias" | unitário | 8 |

### Performance (`<500ms / 1000 OS`)

Confiar nos índices: filtros por `estado` e `pagamento.status/criado_em`. Avaliar índice parcial `ordem_servico (estado) WHERE estado='CONCLUIDA'` e índice em `pagamento (status, criado_em)` se a medição exigir. Medir com seed de 1000 OS (script descartável) — **não** vira teste automatizado (lento/flaky); registrar número no PR.

---

## Validação & PR (§3, §13)

```bash
pnpm lint && pnpm typecheck && pnpm test
npx fallow dead-code && npx fallow dupes && npx fallow health && npx fallow fix --dry-run
pnpm build
```

1. `git switch -c feat/dashboard-financeiro`
2. Commits incrementais por fatia (red→green visível no histórico).
3. Validação visual Playwright (§2.5) + screenshots.
4. Fallow (§3.1) — tratar findings reais.
5. `/code-review` e corrigir.
6. Push + PR p/ `main`. Corpo: `Closes #44` (keyword em inglês, ver memória `feedback-pr-closing-keyword`).

---

## Riscos / pontos de atenção

- **OS sem orçamento aprovado em pendentes:** OS pode estar `CONCLUIDA` sem orçamento aprovado mais recente (ex.: aprovação presencial?). Decidir: `valor` = `null`/"0.00" e ainda listar, ou `LEFT JOIN` com fallback. Confirmar na Fatia 1 com seed do caminho real.
- **Pagamento consolidado:** 1 pagamento MP cobre N OS, mas grava 1 linha por OS (PK `payment_id+os_id`) — somar `pagamento.valor` por linha **não** duplica. Validar na Fatia 6 com seed consolidado.
- **Fuso horário:** `intervaloPeriodo` deve casar com `criado_em` (timestamptz). Usar a mesma referência de tempo do banco (`now()`/UTC) e testar com `agora` fixo.
- **`metodo`/`status` são `varchar` livres** (não enum) — filtrar `status = 'approved'` exatamente como gravado em `registrar-manual.ts`/`processar-pagamento.ts`.
