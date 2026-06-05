# Plano de Implementação — Issue #54

**Fase 4 / Slice 10 — Dashboard ampliado (taxa aprovação + avaliação + garantias)** (último slice da Fase 4, parent #8)
Metodologia: **TDD** (red→green→refactor, **fatias verticais** — um teste → uma implementação → repete). Bloqueios `#50` (Admin Garantias) e `#53` (Admin Marketing) já mergeados. Sem desbloqueio a jusante — fecha a Fase 4.

---

## Objetivo

Estender o dashboard existente em **`/painel`** (`src/app/painel/page.tsx` → `montarDashboard` + `DashboardCards`, criado no #20) com novos cards filtrados por módulo do membro:

- **Operação** (módulo `OPERACAO`): **taxa de aprovação** = OS que entraram em `APROVADA` ÷ OS que entraram em `ORCADA` nos últimos 30 dias.
- **Marketing** (módulo `MARKETING`): **nota média geral** + **ranking de nota média por técnico** (técnicos com ≥ 5 avaliações válidas) + **alertas ≤ 3★ pendentes**.
- **Garantias** (módulo `GARANTIAS`): **chamados abertos** + **chamados resolvidos no mês** + **garantias ativas** (OS `PAGA`, tipo com prazo, dentro do prazo).
- **Financeiro** (módulo `FINANCEIRO`): **inadimplência > 7 dias** (estende o painel da Fase 3 #44).

Sem gráficos. Números grandes + listas curtas. Cada bloco só aparece se o membro tiver o módulo (admin raiz vê tudo) — mesma regra de `montarDashboard` hoje.

---

## Reutilização (Regra de Ouro §1) — já existe, NÃO recriar

| Necessidade | Já existe | Onde |
| --- | --- | --- |
| `montarDashboard(usuario, repo)` + gating por módulo (`podeAcessarModulo`) | ✅ | `src/features/dashboard/dashboard.ts` |
| `DashboardRepo` Drizzle (helper `contar(tabela, where)`) | ✅ | `src/features/dashboard/dashboard-repo-drizzle.ts` |
| `DashboardCards` (seções → grid de KpiCard) | ✅ | `src/features/dashboard/components/dashboard-cards.tsx` |
| Média + total por técnico (`avg`/`count`, exclui `invalida`) | ✅ | `src/marketing/nota-tecnico-repo-drizzle.ts` → `listarNotasPorTecnico()` / `obterNotaMedia()` |
| Vigência de garantia = `pagamento.criadoEm + prazoGarantiaMeses` | ✅ (regra) | `src/operacao/garantia/garantia-repo-drizzle.ts:49-59` |
| Dias pendente (transição→`CONCLUIDA`, sem pagamento `approved`) | ✅ | `src/features/financeiro/financeiro-repo-drizzle.ts:20-59` |
| `podeAcessarModulo(modulo, sess)` | ✅ | `src/auth/require-modulo.ts` |

**Decisão de arquitetura:** manter o **port único** `DashboardRepo` (padrão atual). A impl Drizzle ganha métodos novos; para o ranking, a impl **reusa `criarNotaTecnicoRepoDrizzle(db).listarNotasPorTecnico()`** (não duplicar a query de `avg`). O filtro `≥ 5`, a ordenação e o `top N` ficam na **camada de domínio** (`montarDashboard`), que é unit-testável sem banco.

---

## Decisões travadas

### Taxa de aprovação (Operação)
- Janela: **últimos 30 dias rolantes** (`now() - interval '30 days'`).
- Denominador (`totalOrcadas`): nº de OS distintas com transição `estado_novo = 'ORCADA'` e `em >= now() - 30d`.
- Numerador (`aprovadas`): das mesmas OS, quantas têm transição `estado_novo = 'APROVADA'` (em qualquer momento ≥ a entrada em ORCADA). Conta a OS, não a transição (uma OS pode reorçar/reaprovar — `count(distinct os_id)`).
- `pct = totalOrcadas === 0 ? null : aprovadas / totalOrcadas`. **`null` quando não há ORÇADAs** → card mostra "—" (não "0%", que mentiria).
- Fonte: `transicao_os` (tem `estado_novo`, `em`, índice `(os_id, em)`).

### Nota média geral + ranking (Marketing)
- **Geral:** `avg(nota)` sobre `avaliacao` com `invalida = false`. `null` se não há avaliações → "—".
- **Ranking:** reusa `listarNotasPorTecnico()` (média + total por técnico, exclui inválidas, exclui `tecnicoId` nulo). Domínio: filtra `total >= 5`, ordena por `media desc` (desempate `total desc`), pega **top 5**.
- **Alertas pendentes:** `alerta_avaliacao` ainda não resolvido. Verificar a coluna de status na tabela (ver §"Verificação pré-código").

### Garantias
- **Abertos:** `garantia_chamado.status = 'pendente'`.
- **Resolvidos no mês:** `status IN ('aplicada','rejeitada')` e `decidido_em` dentro do mês-calendário corrente (`>= date_trunc('month', now())`).
- **Ativas:** OS com `estado = 'PAGA'`, `prazo_garantia_meses` não nulo e `> 0`, e `pagamento.criadoEm + make_interval(months => prazo_garantia_meses) > now()`. Usa `pagamento` com `status='approved'` como âncora da data (mesma fonte de vigência do `garantia-repo-drizzle`). Garantia **expirada não conta**.

### Inadimplência > 7 dias (Financeiro)
- nº de OS `CONCLUIDA` sem `pagamento` `approved` cuja transição mais recente para `CONCLUIDA` tem `em < now() - interval '7 days'`. Mesma lógica de `listarPendentes` (financeiro), reduzida a um `count`.

### UI
- `KpiCard` hoje aceita só `value: number`. **Estender** para `value: number | string` (taxa "85%", nota "4.7"). Mudança mínima, retrocompatível.
- Ranking é **lista curta**, não KPI → novo componente `RankingTecnicos` em `dashboard/components/`. Usa só primitivos shadcn/tokens (sem HTML cru, sem cor bruta — §4/§5).
- Ordem das seções em `DashboardCards`: Operação → Garantias → Marketing → Financeiro → (Catálogo/Equipe/Técnico já existentes). Manter 1 elemento dominante por seção (§7).

### Performance
- Alvo do AC: **< 500ms com 5000 OS**. Todas as queries são agregações (`count`/`avg`) ou subquery correlacionada já validada (financeiro mede 23ms/49ms com 1000 OS). Registrar medição no PR. Se a taxa de aprovação degradar, candidato a índice em `transicao_os(estado_novo, em)`.

---

## Arquitetura de arquivos (estende feature existente — §11)

```txt
src/features/dashboard/
├── dashboard.ts                    # + interfaces CardOperacao(estendido), CardMarketing,
│                                   #   CardGarantias, CardFinanceiro + métodos no DashboardRepo
│                                   #   + lógica de gating/filtro/ordenação em montarDashboard
├── dashboard-repo-drizzle.ts       # + queries novas (reusa nota-tecnico-repo p/ ranking)
├── ranking.ts (novo, opcional)     # função pura rankearTecnicos(notas, {min,topN}) — testável
└── components/
    ├── kpi-card.tsx                # value: number | string
    ├── dashboard-cards.tsx        # + seções Operação(taxa)/Garantias/Marketing/Financeiro
    └── ranking-tecnicos.tsx (novo) # lista média por técnico
```

Testes (co-localização do repo segue convenção atual: `tests/unit` + `tests/integration`):

```txt
tests/unit/dashboard.test.ts             # estende: novos cards no montarDashboard (repo fake)
tests/unit/dashboard-ranking.test.ts     # novo: rankearTecnicos puro (≥5, ordenação, topN)
tests/integration/dashboard-repo.test.ts # estende: novas queries Drizzle contra o banco
```

---

## Plano TDD — fatias verticais (um teste → uma impl → repete)

> Regras (do skill /tdd): um teste por vez; só o código mínimo p/ passar; nunca refatorar em RED; teste descreve **comportamento via interface pública**, sobrevive a refactor. Rodar `pnpm test` a cada ciclo.

### Tracer bullet — Slice 1: card Operação ganha taxa de aprovação (domínio)
- **RED** (`tests/unit/dashboard.test.ts`): membro com `OPERACAO`; repo fake retorna `contarOsOrcadas30d→4`, `contarOsAprovadas30d→3`; espera `dash.operacao.taxaAprovacao` = `{ aprovadas: 3, totalOrcadas: 4, pct: 0.75 }`.
- **GREEN**: adicionar campos ao `CardOperacao` + 2 métodos ao `DashboardRepo`; preencher em `montarDashboard` dentro do bloco `OPERACAO` existente.

### Slice 2: taxa com zero ORÇADAS → pct null
- **RED**: repo fake `orcadas→0, aprovadas→0`; espera `pct === null` (não `0`/`NaN`).
- **GREEN**: guarda `totalOrcadas === 0 ? null : aprovadas/totalOrcadas`.

### Slice 3: card Marketing aparece só com módulo MARKETING
- **RED**: membro `["MARKETING"]`; repo fake `obterNotaMediaGeral→4.2`, `contarAlertasPendentes→2`, `listarNotasPorTecnico→[]`; espera `dash.marketing` definido com `notaMediaGeral: 4.2`, `alertasPendentes: 2`, `ranking: []`; e `dash.marketing` **undefined** p/ membro sem o módulo.
- **GREEN**: interface `CardMarketing` + bloco `if podeAcessarModulo("MARKETING")` em `montarDashboard`.

### Slice 4: ranking filtra técnicos com < 5 avaliações
- **RED** (`tests/unit/dashboard-ranking.test.ts`): `rankearTecnicos([{nome:A,media:5,total:3},{nome:B,media:4,total:10}], {min:5, topN:5})` → só B.
- **GREEN**: função pura `rankearTecnicos`.

### Slice 5: ranking ordena por média desc e limita ao topN
- **RED**: 7 técnicos com `total≥5`, médias variadas; `topN:5` → 5 itens, ordenados desc (desempate `total desc`).
- **GREEN**: completar ordenação + slice em `rankearTecnicos`. `montarDashboard` chama `rankearTecnicos(repo.listarNotasPorTecnico(), {min:5, topN:5})`.

### Slice 6: card Garantias aparece só com módulo GARANTIAS
- **RED**: membro `["GARANTIAS"]`; repo fake `contarChamadosAbertos→2`, `contarChamadosResolvidosNoMes→5`, `contarGarantiasAtivas→12`; espera `dash.garantias = {chamadosAbertos:2, resolvidosNoMes:5, ativas:12}`; undefined sem módulo.
- **GREEN**: interface + bloco de gating + 3 métodos no port.

### Slice 7: card Financeiro aparece só com módulo FINANCEIRO
- **RED**: membro `["FINANCEIRO"]`; repo fake `contarInadimplenciaMais7Dias→4`; espera `dash.financeiro = {inadimplenciaMais7Dias:4}`; undefined sem módulo.
- **GREEN**: interface + bloco + método no port.

### Slice 8: admin raiz vê todos os novos cards
- **RED**: estende o teste `admin_raiz` existente — `dash.marketing/garantias/financeiro` definidos; `operacao.taxaAprovacao` presente.
- **GREEN**: nada novo (gating por `podeAcessarModulo` já cobre admin) — só ajustar o repo fake do teste.

### Slice 9 (integração): taxa de aprovação reflete transições semeadas
- **RED** (`tests/integration/dashboard-repo.test.ts`): semear OS com transições `→ORCADA` (3) das quais 2 também `→APROVADA`, dentro de 30d; e 1 ORÇADA antiga (40d) que **não** conta. Esperar `contarOsOrcadas30d` e `contarOsAprovadas30d` consistentes (`>=` por causa do banco compartilhado/paralelo — ver comentário no teste atual).
- **GREEN**: implementar as 2 queries em `dashboard-repo-drizzle.ts` (count distinct `os_id` sobre `transicao_os`).

### Slice 10 (integração): garantia expirada não conta como ativa
- **RED**: semear OS `PAGA` + `pagamento approved`: (a) prazo 12m paga ontem → ativa; (b) prazo 6m paga há 8 meses → expirada, não conta; (c) `prazo=0`/null → não conta. Esperar `contarGarantiasAtivas >= 1` e que a expirada não entre (montar cenário isolável por ids semeados).
- **GREEN**: query `contarGarantiasAtivas` com `make_interval` + join `pagamento approved`.

### Slice 11 (integração): chamados abertos vs resolvidos no mês
- **RED**: semear `garantia_chamado`: 1 `pendente`, 1 `aplicada`/`decidido_em` neste mês, 1 `rejeitada`/`decidido_em` mês passado (não conta em "resolvidos no mês"). Esperar abertos e resolvidos-no-mês coerentes.
- **GREEN**: queries `contarChamadosGarantiaAbertos` + `contarChamadosGarantiaResolvidosNoMes`.

### Slice 12 (integração): inadimplência > 7 dias
- **RED**: 1 OS `CONCLUIDA` sem pagamento, transição→CONCLUIDA há 10d (conta); 1 há 3d (não conta); 1 `CONCLUIDA` já com `pagamento approved` (não conta). Esperar `contarInadimplenciaMais7Dias >= 1`.
- **GREEN**: query reduzindo `listarPendentes` a `count` + filtro `> 7d`.

### Slice 13 (integração): média geral + ranking via banco
- **RED**: semear avaliações (válidas e 1 `invalida`) p/ 2 técnicos — um com ≥5, outro com <5. Esperar `obterNotaMediaGeral` ignora inválidas; `listarNotasPorTecnico` traz ambos (o filtro ≥5 é do domínio, já coberto em unit).
- **GREEN**: `obterNotaMediaGeral` (`avg` global) + plugar `listarNotasPorTecnico` (reuso da impl marketing) no `DashboardRepo`.

### Slice 14 (UI): renderização dos novos cards
- `KpiCard` → `value: number | string`; `DashboardCards` → novas seções (taxa "%", nota, contadores); `RankingTecnicos` novo. Cobertura é via **Playwright MCP** (§2.5), não unit (`.tsx` excluído do coverage). Validar nas 4 resoluções (390/768/1366/1920), sem scroll horizontal, tokens semânticos, sem HTML cru.

---

## Refactor (após GREEN de todas as fatias)
- Extrair duplicação entre `contarInadimplenciaMais7Dias` e `listarPendentes` (financeiro) se a subquery `CONCLUIDA sem pagamento` ficar repetida — considerar mover p/ helper compartilhado.
- Conferir se `montarDashboard` ficou com blocos repetitivos de gating → manter legível, não sobre-abstrair.
- Rodar `npx fallow dead-code | dupes | health | fix --dry-run` (§3.1) e tratar findings reais.

---

## Critérios de aceite (do issue) → cobertura
- [ ] Cards por módulo do membro → Slices 1,3,6,7,8 (unit gating)
- [ ] Taxa aprovação 30 dias → Slices 1,2,9
- [ ] Ranking técnicos ≥ 5 avaliações → Slices 4,5,13 (**teste: técnico com 3 avaliações não aparece** = Slice 4)
- [ ] Chamados garantia abertos/resolvidos no mês → Slice 11
- [ ] Garantias ativas (PAGA + tipo aplicável + dentro do prazo) → Slice 10 (**teste: garantia expirada não conta** = Slice 10)
- [ ] Inadimplência > 7 dias → Slice 12
- [ ] Queries < 500ms com 5000 OS → medir e registrar no PR
- [ ] UI validada (Playwright MCP, 4 resoluções) → Slice 14

---

## Verificação pré-código (antes da Slice 1) — ✅ RESOLVIDA

1. **`alerta_avaliacao` (alertas ≤3★ pendentes)** — ✅ confirmado:
   - `alerta_avaliacao.status` (`varchar(16)`, default `'PENDENTE'`) + `resolvido_em`. Pendente = `status = 'PENDENTE'`.
   - Alerta só é criado para `nota < 4` (`NOTA_MINIMA_QUALIFICACAO`, `filtro-avaliacao.ts:notasParaAlerta`) → "pendente" já significa "≤3★".
   - **Reusar** `criarAlertaAvaliacaoRepoDrizzle(db).listarPendentes()` (filtra `status='PENDENTE'`) e contar o tamanho, **ou** adicionar `contarPendentes()` no port (preferível p/ não materializar a lista só p/ um número). Não criar query nova de zero.
2. **Tipos de OS com garantia** — ✅ confirmado: usar `prazo_garantia_meses` por OS (nullable). "Tipo aplicável" = `prazo_garantia_meses` não nulo e `> 0`. Não hardcodar `tipo_os`.
3. **`pagamento.criadoEm`** como âncora de vigência — ✅ consistente com `garantia-repo-drizzle.ts:57`.

## Atenção de performance (AC < 500ms / 5000 OS)

`montarDashboard` hoje faz `await` **sequencial** por contador. Com ~10 queries novas, somam-se round-trips ao Neon (serverless HTTP). **Paralelizar** com `Promise.all` dentro de cada bloco de card (e, se viável, entre blocos) para manter o alvo. Medir e registrar no PR.

---

## Workflow (§13)
`git switch -c feat/issue-54-dashboard-ampliado` → commits incrementais por fatia → `pnpm lint && pnpm typecheck && pnpm test` → fallow (§3.1) → Playwright MCP (§2.5) → push + PR p/ `main` com `Closes #54` no corpo → checar CI + veredito Gemini.
