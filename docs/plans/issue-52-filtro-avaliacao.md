# Plano TDD — Issue #52: Filtro inteligente de avaliação (Google Review + indicação)

> **Fase 4 / Slice 8** — Parent #8. Blocked by #51 (MERGED, commit `877e185`).
> Estilo de implementação: skill `/tdd` (tracer bullets verticais, 1 teste → 1 impl).

---

## 1. Objetivo

Após o submit de avaliação (slice #51), a tela aplica o **Filtro Inteligente**:

- **Todas as notas da Solicitação ≥ 4★** → tela qualificada: botão "Avalie a gente no Google"
  (link `g.page/...`, URL configurável no módulo Operação) + link de indicação **placeholder**
  ("em breve" — Fase 5 ativa de verdade).
- **Qualquer nota ≤ 3★** → não mostra Google nem indicação. Mostra "Obrigado pelo feedback,
  vamos te procurar pra entender melhor" e cria um **Alerta de Avaliação** (Tratativa) na fila
  `/admin/marketing/avaliacoes` (slice #53 consome/resolve).

Os links Google/indicação também ficam acessíveis no portal por token (`/s/{token}`) quando a
Solicitação está qualificada (todas as OS avaliadas ≥ 4★).

---

## 2. Decisões de design (a issue pede "agente decide e documenta")

1. **Granularidade do filtro = por Solicitação.** "Todas ≥ 4★" agrega as notas de **todas as OS
   avaliadas** daquela Solicitação. Uma única OS ≤ 3★ derruba a qualificação inteira (protege a
   reputação — não pede Google a quem ficou insatisfeito com qualquer parte).
2. **Granularidade do Alerta = por OS ≤ 3★.** Cada OS com nota ≤ 3★ gera **uma** linha de alerta
   (com sua nota, comentário, OS e técnico snapshot). Mix `5★ + 3★` → **1 alerta** (só o 3★). A
   Tratativa do admin (#53) age por OS/técnico, então o alerta granular por OS é o útil.
3. **Limiar literal da issue/CONTEXT:** `≥ 4` qualifica, `≤ 3` reprova. Não há zona cinza (notas
   são inteiros 1–5, garantido pelo domínio do #51).
4. **URL Google Review mora no `operacaoConfig`** (singleton já existente) como coluna nova
   `googleReviewUrl text null`. A issue permite "estende #34 OU cria entrada nova" — estender o
   singleton evita nova tabela e reaproveita form/repo/action de Config Operação.
5. **Indicação = placeholder inerte.** Renderiza "Indique e ganhe — em breve" desabilitado. A
   mecânica real (link único + crédito) é a slice #63 (Fase 5). Sem rota, sem persistência agora.
6. **Orquestração num módulo profundo (`marketing/filtro-avaliacao`).** Função única
   `finalizarAvaliacao(...)` registra as avaliações (reaproveita `registrarAvaliacoes` do #51),
   aplica o filtro (puro) e cria os alertas — devolve `{ qualificada, googleReviewUrl }` para a
   UI. Interface pequena, implementação funda → testável direto pelos 2 cenários da AC.
7. **Local do domínio:** Filtro + Alerta vivem em `src/marketing/` (CONTEXT "Filtro Inteligente"
   e "Tratativa" são linguagem do módulo Marketing). Cross-domain Marketing → Operação já previsto
   no `src/marketing/CONTEXT.md` ("avaliações vinculadas a OS").

---

## 3. O que já existe (reaproveitar)

| Peça | Arquivo | Uso no #52 |
|---|---|---|
| Domínio avaliação + repo + drizzle | `src/operacao/avaliacao/avaliacao.ts`, `avaliacao-repo*.ts` | `registrarAvaliacoes` chamado dentro de `finalizarAvaliacao`; reusa `obterTecnicoSnapshot` |
| Server action `/s/` + IP | `src/app/s/[token]/actions.ts` (`ipDoCliente`, `registrarAvaliacaoAction`) | Action passa a chamar `finalizarAvaliacao` e **retornar** o resultado do filtro |
| Form de avaliação | `src/app/s/[token]/avaliar/form-avaliacao.tsx` (estado `submitted`) | Bloco pós-submit passa a renderizar Google/indicação OU mensagem de feedback |
| Singleton de config + form + action | `src/operacao/config-repo*.ts`, `src/app/admin/operacao/config/{config-form,actions}.tsx` | + campo `googleReviewUrl` na interface, repo, form e `salvarConfigAction` |
| Página por token (portal) | `src/app/s/[token]/page.tsx` (`carregarParaCliente`, `notFound`) | + seção de links quando Solicitação qualificada |
| Padrão de fila admin | `src/app/admin/marketing/portfolio/page.tsx` (+ `EmptyState`, `exigirMarketing`) | Molde da fila `/admin/marketing/avaliacoes` |
| Guard do módulo Marketing | `src/app/admin/marketing/guard.ts` (`exigirMarketing`) | Proteger a nova fila |
| Item de navegação | `src/app/admin/sidebar-nav.tsx` (`ITENS`, `modulo: "MARKETING"`) | + item "Avaliações" |
| Molde de teste de integração | `tests/integration/operacao-avaliacao.test.ts` (`seedContexto`, cleanup `afterEach`) | Reusar seed de cliente/sol/OS/técnico para os testes do filtro |
| Componentes UI | `src/components/ui/{button,card,badge}`, `EmptyState` | Bloco pós-submit + fila (sem HTML cru) |

**Faltam:** coluna `operacaoConfig.googleReviewUrl`; tabela `alerta_avaliacao` (+ relations);
domínio `src/marketing/filtro-avaliacao.ts` (puro) + `alerta-avaliacao-repo*.ts`; orquestrador
`finalizarAvaliacao`; retorno do filtro na action; UI pós-submit; seção no portal `/s/{token}`;
fila `/admin/marketing/avaliacoes` + item de nav.

---

## 4. Schema (migration Drizzle)

```ts
// alerta_avaliacao — 1 por OS com nota <= 3 (fila de Tratativa, slice #53 resolve)
alertaAvaliacao:
  id            uuid pk defaultRandom
  osId          uuid ref ordemServico(restrict)  UNIQUE   // 1 alerta vivo por OS (upsert)
  solicitacaoId uuid ref solicitacao(cascade)             // agrupa na fila
  tecnicoId     uuid ref membro(set null)                 // snapshot p/ Tratativa
  nota          integer notNull                           // 1..3
  comentarioOs  text null                                 // copiado da avaliação
  status        varchar(16) notNull default 'PENDENTE'    // PENDENTE | RESOLVIDO (#53)
  criadoEm      timestamptz defaultNow notNull
  atualizadoEm  timestamptz defaultNow $onUpdate

// operacao_config: + coluna
  googleReviewUrl text null   // link g.page/... ; null = filtro não mostra botão Google
```

+ relations (`alertaAvaliacao` → `ordemServico`, `solicitacao`, `membro`).
`UNIQUE(os_id)` + `onConflictDoUpdate`: reenvio da avaliação de uma OS ≤ 3★ **atualiza** o alerta
(nota/comentário) em vez de duplicar. `pnpm drizzle-kit generate` → revisar SQL gerado.

---

## 5. Loop TDD (ciclos verticais RED → GREEN → [refactor])

> **Como ler.** Cada item numerado é **um ciclo completo**, em ordem, de cima para baixo. Não
> escreva o próximo teste antes do ciclo atual estar GREEN. A coluna **Impl (mínima)** descreve só
> o suficiente para passar **aquele** teste — os arquivos crescem incrementalmente.
>
> Por ciclo: **RED** (escreve teste, vê falhar pela razão certa) → **GREEN** (mínimo p/ passar,
> sem antecipar testes futuros) → **[refactor]** (só com suíte verde; nunca refatorar em RED).
>
> Checklist `/tdd`: teste descreve comportamento (não implementação) · usa só interface pública ·
> sobreviveria a refactor interno · código mínimo · sem feature especulativa.

### Bloco A — Filtro Inteligente (domínio puro)
Arquivo de teste: `tests/unit/marketing-filtro-avaliacao.test.ts` (sem DB — função pura).
Produção que cresce: `src/marketing/filtro-avaliacao.ts`.

| Ciclo | RED (teste) | GREEN (impl mínima) |
|---|---|---|
| **A1 — tracer** | `qualificarAvaliacoes([4, 5])` → `{ qualificada: true }`. → *AC "todas ≥4★"* | `qualificarAvaliacoes(notas)` retorna `{ qualificada: notas.every(n => n >= 4) }`. |
| **A2** | `qualificarAvaliacoes([5, 3])` → `{ qualificada: false }`. → *AC "mix 5★+3★"* | Já coberto pelo `.every`; teste trava o comportamento contra regressão. |
| **A3** | `qualificarAvaliacoes([])` → `{ qualificada: false }` (sem notas não mostra Google). → *edge* | Guarda `notas.length === 0 → false`. |
| **A4** | `notasParaAlerta([{osId,nota:3},{osId,nota:5}])` → só a OS nota 3. → *granularidade §2.2* | `notasParaAlerta(itens)` = `itens.filter(i => i.nota <= 3)`. |
| **[refactor A]** | — | Verde: nomear o limiar (`NOTA_MINIMA_QUALIFICACAO = 4`) único ponto de verdade. Rodar suíte. |

### Bloco B — Alerta de Avaliação (repo + drizzle)
Arquivo de teste: `tests/integration/marketing-alerta-avaliacao.test.ts` (molde: `operacao-avaliacao.test.ts`).
Produção que cresce: `src/marketing/alerta-avaliacao-repo.ts` (interface), `alerta-avaliacao-repo-drizzle.ts`.

| Ciclo | RED (teste) | GREEN (impl mínima) |
|---|---|---|
| **B1 — tracer** | `criar({ osId, solicitacaoId, tecnicoId, nota:2, comentarioOs })` persiste 1 linha `status='PENDENTE'`. | Interface `AlertaAvaliacaoRepo.criar` + impl Drizzle (`insert`). |
| **B2** | Reenvio do mesmo `osId` (nota 2→1) → segue 1 linha, nota atualizada. → *decisão §4 upsert* | `onConflictDoUpdate` em `UNIQUE(os_id)`. |
| **B3** | `listarPendentes()` traz alerta com nota+comentário+OS+técnico (join), só `PENDENTE`. → *AC fila #53* | `listarPendentes` (join `ordemServico`/`membro`, filtro `status='PENDENTE'`). |
| **[refactor B]** | — | Verde: extrair shape de retorno (`AlertaPendenteView`) reusada pela fila. Rodar suíte. |

### Bloco C — Config Google Review URL
Arquivo de teste: estende `tests/integration/*operacao-config*` (ou novo `marketing-config-google.test.ts`).
Produção que cresce: `src/operacao/config-repo.ts` (interface), `config-repo-drizzle.ts`.

| Ciclo | RED (teste) | GREEN (impl mínima) |
|---|---|---|
| **C1 — tracer** | `repo.atualizar({...atual, googleReviewUrl:'https://g.page/x'})` → `obter()` devolve a URL. | + campo na interface `OperacaoConfig`, no `COLUNAS`/`materializar` e no `atualizar` do drizzle. |
| **C2** | Config nunca setada → `googleReviewUrl` é `null` (default). | Coluna nullable; `materializar` propaga `row.googleReviewUrl ?? null`. |
| **[refactor C]** | — | Verde: conferir que `salvarConfigAction` não apaga a URL ao salvar preço/litro (merge `...atual`). |

### Bloco D — Orquestrador `finalizarAvaliacao` (deep module)
Arquivo de teste: `tests/integration/marketing-finalizar-avaliacao.test.ts` (molde + seeds do Bloco A do #51).
Produção que cresce: `src/marketing/filtro-avaliacao.ts` (cresce com a orquestração) ou `finalizar-avaliacao.ts`.

| Ciclo | RED (teste) | GREEN (impl mínima) |
|---|---|---|
| **D1 — tracer (AC explícito "todas 4★")** | `finalizarAvaliacao(token, {avaliacoes:[{os,4},{os,4}]}, meta, deps)` → `{ qualificada:true, googleReviewUrl }`, **0 alertas**. | Orquestra: `registrarAvaliacoes` (#51) → `qualificarAvaliacoes` → devolve URL do config; sem nota ≤3, não cria alerta. |
| **D2 — tracer (AC explícito "5★+3★")** | mesma Solicitação `[5, 3]` → `{ qualificada:false, googleReviewUrl:null }` + **1 alerta** (a OS 3★, com nota+comentário+técnico). | `notasParaAlerta` → `alertaRepo.criar` por OS reprovada; quando não-qualificada, `googleReviewUrl=null`. |
| **D3** | `googleReviewUrl` ausente no config + todas ≥4★ → `qualificada:true` mas `googleReviewUrl:null` (UI esconde botão). | Ler config; propagar `null` sem quebrar a qualificação. |
| **[refactor D]** | — | Verde: garantir que a action vire casca fina sobre `finalizarAvaliacao`. Conferir dedup com #51. Rodar suíte. |

### Bloco E — Action + UI pós-submit (UI — segue §2 do AGENTS.md)

Ciclos UI verticais; verificação = validação visual Playwright MCP **além** dos testes.

| Ciclo | RED (comportamento) | GREEN (impl mínima) |
|---|---|---|
| **E1** | `registrarAvaliacaoAction` retorna `{ qualificada, googleReviewUrl }` (integração da action). | Action chama `finalizarAvaliacao` (em vez de `registrarAvaliacoes`); reaproveita `ipDoCliente`; `revalidatePath`. |
| **E2** | Pós-submit qualificada → botão "Avalie no Google" (`<a>`/`buttonVariants`, href = URL) + bloco indicação "em breve" desabilitado. | `form-avaliacao.tsx`: guardar resultado no estado; ramo qualificada renderiza Google (`Button asChild`) + placeholder. |
| **E3** | Pós-submit não-qualificada → mensagem "Obrigado pelo feedback, vamos te procurar…", **sem** Google nem indicação. | Ramo `else` no bloco `submitted`. |
| **E4** | URL Google ausente (qualificada mas `googleReviewUrl=null`) → mostra indicação placeholder, esconde botão Google. | Render condicional ao `googleReviewUrl`. |
| **[refactor E]** | — | Verde: extrair subcomponente do bloco pós-submit se crescer; só tokens semânticos; alvo ≥44×44. |

### Bloco F — Config Operação (form) + Fila admin (UI)

| Ciclo | RED (comportamento) | GREEN (impl mínima) |
|---|---|---|
| **F1** | `/admin/operacao/config` tem campo "Link Google Review"; salvar persiste; recarregar mostra valor. | + `<Input name="googleReviewUrl">` no `config-form.tsx`; `salvarConfigAction` lê e grava (merge `...atual`). |
| **F2** | `/admin/marketing/avaliacoes` lista alertas pendentes (nota, comentário, OS, técnico); vazio → `EmptyState`. | `page.tsx` (server: `listarPendentes` + `exigirMarketing`), molde do `portfolio/page.tsx`. Read-only (resolução = #53). |
| **F3** | Item "Avaliações" aparece no sidebar admin sob módulo MARKETING. | + entrada em `ITENS` (`sidebar-nav.tsx`, `modulo:"MARKETING"`, ícone lucide). |
| **F4** | `/s/{token}` (portal) mostra links Google/indicação quando todas as OS avaliadas ≥4★; esconde se houver ≤3★ ou OS não avaliada. | Carregar avaliações + config na page; `qualificarAvaliacoes` reusado; seção condicional. |
| **[refactor F]** | — | Verde: extrair o bloco de links (pós-submit E2 ↔ portal F4) para `src/features/...` se duplicar. |

**Processo UI obrigatório (AGENTS.md §2):** Builder → UX Reviewer → Frontend Reviewer → Refactor →
Aprovado. Validação visual Playwright MCP nas 4 resoluções (390 / 768 / 1366 / 1920), sem scroll
horizontal, só tokens semânticos, só componentes `ui/`. `/s/{token}*` é **público** (sem dev
bypass); `/admin/*` exige **dev bypass** de auth (`DEV_BYPASS_EMAIL` = e-mail admin no `.env.local`).
Semear o mínimo (1 alerta pendente para a fila) e limpar tudo ao final.

---

## 6. Acceptance criteria → cobertura

| AC da issue | Onde |
|---|---|
| Filtro: todas ≥4★ → Google+indicação; qualquer ≤3★ → não mostra | A1, A2, A3, D1, D2, E2, E3 |
| URL Google Review configurável em `/admin/operacao/config` | C1, C2, F1 |
| Alerta criado para avaliação ≤3★ (nota+comentário+OS+técnico) | B1, B3, D2 |
| Portal cliente mostra links Google/indicação nas Solicitações qualificadas | F4 |
| Link de indicação placeholder "em breve" (Fase 5 ativa) | E2, F4 (decisão §2.5) |
| **Teste:** 1 OS 5★ + 1 OS 3★ → sem Google, sem indicação, alerta criado | **D2** |
| **Teste:** todas 4★ → mostra Google + indicação | **D1** (+ E2 visual) |

---

## 7. Fechamento (workflow §13 + análise §3.1 do AGENTS.md)

1. `pnpm lint && pnpm typecheck && pnpm test`
2. `npx fallow dead-code dupes health` + `npx fallow fix --dry-run` — tratar findings reais.
3. Validação visual Playwright MCP: `/s/{token}/avaliar` (público, 2 ramos pós-submit),
   `/s/{token}` (portal), `/admin/operacao/config` e `/admin/marketing/avaliacoes` (dev bypass admin).
   Semear 1 alerta pendente + limpar ao final (linhas + `DEV_BYPASS_EMAIL` + processo `pnpm dev`).
4. Branch `feat/filtro-avaliacao` (NÃO commitar na branch atual). Conferir branch antes do commit.
5. PR para `main` com `Closes #52` no corpo (keyword em inglês).
6. Aguardar CI/GitHub Actions + veredicto do Gemini Code Review.
