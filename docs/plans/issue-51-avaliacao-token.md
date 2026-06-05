# Plano TDD — Issue #51: Avaliação por token (estrelas por OS)

> **Fase 4 / Slice 7** — Parent #8. Blocked by #22 (CLOSED).
> Estilo de implementação: skill `/tdd` (tracer bullets verticais, 1 teste → 1 impl).

---

## 1. Objetivo

Cliente avalia cada OS após o estado terminal (CONCLUÍDA ou PAGA). E-mail + WhatsApp
`pedido_avaliacao` disparam com link `/s/{token}/avaliar`. Tela pública (sem login) lista
todas as OS avaliáveis da Solicitação; por OS recebe 1–5 estrelas (obrigatório) + comentário
opcional, mais um comentário geral da Solicitação. Lembrete único 48h reforça quem não avaliou.
Cada avaliação vincula `tecnico_id` (snapshot) para média futura por técnico.

---

## 2. Decisões de design (a issue pede "agente decide e documenta")

1. **Reenvio do token → sobrescrever + pré-preencher.** Upsert por `os_id`
   (`UNIQUE(os_id)` + `onConflictDoUpdate`). A tela carrega a avaliação anterior e permite
   alterar nota/comentário. Comentário geral: upsert por `solicitacao_id`.
2. **Momento do disparo (terminal por tipo, evita pedir 2×):**
   - Tipos pagáveis (`NORMAL` / `EXPRESS` / `COMPLEMENTAR`) → no **PAGA**.
   - Não-pagáveis (`PREVENTIVA` / `GARANTIA`) → no **CONCLUIDA**.
   - Reaproveita a regra `TIPOS_PAGAVEIS` já usada no `lembrete-pagamento.ts`.
3. **Dedup do lembrete 48h:** flag `lembrete_avaliacao_enviado` na `solicitacao` (nome literal
   da issue). Claim atômico `UPDATE ... WHERE flag = false RETURNING` → 1× por Solicitação.
4. **`tecnico_id` como snapshot** na linha de `avaliacao` (média por técnico sobrevive a
   reatribuição da OS).
5. **Local do domínio:** `src/operacao/avaliacao/` (espelha `src/operacao/garantia/`).

---

## 3. O que já existe (reaproveitar)

| Peça | Arquivo | Uso no #51 |
|---|---|---|
| Dispatcher de eventos OS | `src/notificacao/dispatcher.ts` (`MAPA_EVENTOS`, `despacharWhatsapp`) | Disparar `pedido_avaliacao` no estado terminal |
| Catálogo de templates | `src/notificacao/templates.ts` (`TEMPLATES_NOTIFICACAO`, `ordenarVariaveis`) | + entrada `pedido_avaliacao` |
| Job 48h + dedup | `src/notificacao/lembrete-pagamento.ts` (claim de marco, `concluidaEm`, `TIPOS_PAGAVEIS`) | Molde direto do `lembrete-avaliacao.ts` |
| E-mail render | `src/notificacao/email-service.tsx` (`renderizarEmail*`) | + `renderizarEmailPedidoAvaliacao` |
| Domínio puro + repo + drizzle | `src/operacao/aprovacao.ts`, `src/operacao/garantia/*` | Molde do domínio `avaliacao` |
| Server action `/s/` + IP | `src/app/s/[token]/actions.ts` (`ipDoCliente`, `revalidatePath`) | Reaproveitar `ipDoCliente` |
| Página pública por token | `src/app/s/[token]/page.tsx` (`carregarParaCliente`, `notFound`) | Molde da tela `/avaliar` |
| Marco de idempotência | `notificacaoMarco` (schema) | Dedup do disparo no evento |
| Dispatch já cabeado | `processar-pagamento.ts` (PAGA) + `api/campo/os/[id]/transicao/route.ts` (CONCLUIDA) | Trigger novo entra de graça nos 2 caminhos |
| Molde de teste de integração | `tests/integration/notificacao-lembrete.test.ts` | Seeds OS/sol/cli + cleanup `afterEach` |

**Faltam:** tabelas `avaliacao` + `comentario_geral`; flag `lembrete_avaliacao_enviado` na
`solicitacao`; componente de estrelas (não há star input em `src/components/ui/`); domínio
`avaliacao`; tela `/s/[token]/avaliar`; job `lembrete-avaliacao.ts`.

---

## 4. Schema (migration Drizzle)

```ts
// avaliacao — 1 por OS (upsert)
avaliacao:
  id        uuid pk defaultRandom
  osId      uuid ref ordemServico(restrict)  UNIQUE   // upsert key
  tecnicoId uuid ref membro(set null)                 // snapshot p/ média
  nota      integer notNull                           // 1..5 (validação no domínio)
  comentarioOs text null
  atorToken varchar(64) notNull
  ip        varchar(64) notNull
  criadoEm  timestamptz defaultNow
  atualizadoEm timestamptz defaultNow $onUpdate

// comentario_geral — 1 por Solicitação (upsert)
comentarioGeral:
  solicitacaoId uuid pk ref solicitacao(cascade)
  comentario    text notNull
  atorToken     varchar(64) notNull
  ip            varchar(64) notNull
  criadoEm / atualizadoEm

// solicitacao: + coluna
  lembreteAvaliacaoEnviado boolean notNull default false
```

+ relations (`avaliacao` → `ordemServico`, `membro`). `pnpm drizzle-kit generate` → revisar SQL.

---

## 5. Loop TDD (ciclos verticais RED → GREEN → [refactor])

> **Como ler esta seção.** Cada item numerado é **um ciclo completo**, executado em ordem,
> de cima para baixo. Não escreva o próximo teste antes do ciclo atual estar GREEN.
> A coluna **Impl (mínima)** descreve só o código suficiente para passar **aquele** teste —
> os arquivos do domínio **crescem incrementalmente** ao longo dos ciclos, não nascem prontos.
>
> Por ciclo:
> 1. **RED** — escreve o teste, roda, vê falhar (pela razão certa).
> 2. **GREEN** — escreve o mínimo para passar. Sem antecipar testes futuros.
> 3. **[refactor]** — só com a suíte verde: remove duplicação, aprofunda módulo, roda os testes
>    de novo. **Nunca refatorar em RED.**
>
> Checklist por ciclo (skill `/tdd`): teste descreve comportamento (não implementação) ·
> usa só a interface pública · sobreviveria a refactor interno · código mínimo · sem feature
> especulativa.

### Bloco A — Domínio `avaliacao`
Arquivo de teste: `tests/integration/operacao-avaliacao.test.ts` (molde: `notificacao-lembrete.test.ts`).
Arquivos de produção que crescem ao longo do bloco: `src/operacao/avaliacao/avaliacao.ts` (puro),
`avaliacao-repo.ts` (interface + erros), `avaliacao-repo-drizzle.ts` (impl Drizzle).

| Ciclo | RED (teste) | GREEN (impl mínima para esse teste) |
|---|---|---|
| **A1 — tracer** | `registrarAvaliacoes(token, { avaliacoes: [{ osId, nota: 4 }] }, { ip })` persiste 1 linha `nota=4` + `tecnicoId` snapshot da OS. → *AC "4★ em 1 OS"* | `avaliacao.ts` com `registrarAvaliacoes` resolvendo 1 OS; `AvaliacaoRepo.salvar` + impl Drizzle do insert. Caminho ponta-a-ponta provado. |
| **A2** | 2 OS (4★ + 5★) → **2 registros**. → *AC explícito* | Iterar a lista de avaliações no insert. Nada além. |
| **A3** | Reenvio sobrescreve (nota 4→2 no mesmo `os_id`, segue 1 linha). → *decisão §2.1* | Trocar insert por upsert `onConflictDoUpdate` em `UNIQUE(os_id)`. |
| **A4** | Comentário geral: 1 por Solicitação; reenvio sobrescreve. | `salvarComentarioGeral` (upsert por `solicitacao_id`) chamado quando o payload traz `comentarioGeral`. |
| **A5** | `nota` fora de 1–5 → `NotaInvalidaError`; OS de outra Solicitação → `OsNaoAvaliavelError`. | Validação pura no domínio + checagem de pertencimento no repo; erros tipados. |
| **A6** | `carregarParaAvaliar(token)` lista só OS avaliável (CONCLUIDA/PAGA, incl. PREVENTIVA/GARANTIA) e injeta a avaliação anterior. | `carregarParaAvaliar` + `AvaliacaoRepo.carregarPorToken` (join OS + avaliação existente). |
| **[refactor A]** | — | Com tudo verde: extrair duplicação dos upserts, avaliar mover montagem de registro para o domínio puro. Rodar a suíte. |

### Bloco B — Disparo `pedido_avaliacao`
Arquivo de teste: `tests/integration/notificacao-avaliacao-evento.test.ts` (molde: `notificacao-dispatcher.test.ts`).
Produção que cresce: `templates.ts` (catálogo), `email-service.tsx` (render), `dispatcher.ts` (trigger).

| Ciclo | RED (teste) | GREEN (impl mínima) |
|---|---|---|
| **B1 — tracer** | `despacharEventoOs(osId, "PAGA")` em NORMAL → WhatsApp `pedido_avaliacao` + e-mail, link `/s/{token}/avaliar`, ordem de variáveis casa o catálogo. → *AC disparo* | + entrada `pedido_avaliacao` no catálogo; `renderizarEmailPedidoAvaliacao`; branch no dispatcher disparando o template para PAGA. |
| **B2** | PREVENTIVA em `CONCLUIDA` dispara; NORMAL em `CONCLUIDA` **não** (espera PAGA). | Helper `deveSolicitarAvaliacao(tipo, estado)` (reaproveita `TIPOS_PAGAVEIS`) gateando o disparo. |
| **B3** | 2 chamadas do mesmo evento → 1 envio. | Claim em `notificacaoMarco` (`onConflictDoNothing`) antes de enviar; 0 linhas = pula. |
| **[refactor B]** | — | Verde: conferir se o trigger cabe melhor num helper isolado vs. inline no `despacharEventoOs`. Rodar a suíte. |

### Bloco C — Lembrete 48h
Arquivo de teste: `tests/integration/notificacao-lembrete-avaliacao.test.ts` (molde: `notificacao-lembrete.test.ts`).
Produção que cresce: `src/notificacao/lembrete-avaliacao.ts` (função exposta e testável; wiring de
cron fica na Fase 5, igual aos jobs atuais).

| Ciclo | RED (teste) | GREEN (impl mínima) |
|---|---|---|
| **C1 — tracer** | OS avaliável há ≥48h sem avaliação → 1 lembrete (WhatsApp + e-mail), flag `lembrete_avaliacao_enviado=true`. | `processarLembretesAvaliacao` varre candidatas, envia 1×, seta a flag. |
| **C2** | Job roda 2× → **1 envio só**. → *AC "não envia 2×"* | Claim atômico antes de enviar: `UPDATE solicitacao SET flag=true WHERE flag=false RETURNING`; 0 linhas = pula. |
| **C3** | OS já avaliada → não lembra; OS há <48h → não lembra. | Filtros na seleção de candidatas (idade ≥48h + ausência de avaliação). |
| **[refactor C]** | — | Verde: deduplicar `concluidaEm`/carregamento de contexto com `lembrete-pagamento.ts` se a lógica colidir. Rodar a suíte. |

### Bloco D — Action + tela (UI — segue §2 do AGENTS.md)

Ciclos UI também são verticais (um comportamento observável por vez), mas a verificação é a
validação visual via Playwright MCP além dos testes:

| Ciclo | RED (comportamento) | GREEN (impl mínima) |
|---|---|---|
| **D1** | Action `registrarAvaliacaoAction(token, payload)` persiste e revalida (teste de integração da action). | Server action reaproveita `ipDoCliente`; chama domínio; `revalidatePath('/s/${token}/avaliar')`. |
| **D2** | Estrelas interativas: clique seleciona nota, foco visível, alvo ≥44×44 no mobile. | `src/components/shared/estrelas-input.tsx` (Button `ghost` + lucide `Star`, `ring-ring`). **Não há star input em `ui/`** → criar. |
| **D3** | `/s/{token}/avaliar` renderiza todas as OS avaliáveis + pré-preenche avaliação anterior; token inválido → `notFound`. | `src/app/s/[token]/avaliar/page.tsx` (server: `carregarParaAvaliar`) + client compondo D2 + comentário geral + submit. |
| **[refactor D]** | — | Verde: extrair subcomponente de "card de OS avaliável" se repetir; conferir tokens semânticos. |

**Processo UI obrigatório (AGENTS.md §2):** Builder → UX Reviewer → Frontend Reviewer → Refactor →
Aprovado. Validação visual Playwright MCP nas 4 resoluções (390 / 768 / 1366 / 1920), sem scroll
horizontal, só tokens semânticos, só componentes `ui/`. Rota `/s/` é pública (sem dev bypass).

---

## 6. Acceptance criteria → cobertura

| AC da issue | Onde |
|---|---|
| E-mail/WhatsApp `pedido_avaliacao` ao transitar CONCLUÍDA (ou PAGA) | B1, B2 |
| `/s/{token}/avaliar` renderiza tela única com todas as OS | D3 |
| Estrelas por OS obrigatórias, comentário opcional | A1, A5, D2/D3 |
| Submit persiste avaliações por OS + comentário geral | A1, A2, A4, D1 |
| Cada avaliação vincula `tecnico_email`/`tecnico_id` p/ média | A1 (snapshot) |
| Reenvio sobrescreve (decisão documentada) | A3, A4 (decisão §2.1) |
| Lembrete 48h enviado 1× por Solicitação | C1, C2 |
| Teste: 4★ + 5★ persiste 2 registros | A2 |
| Teste: lembrete não envia 2× | C2 |

---

## 7. Fechamento (workflow §13 + análise §3.1 do AGENTS.md)

1. `pnpm lint && pnpm typecheck && pnpm test`
2. `npx fallow dead-code dupes health` + `npx fallow fix --dry-run` — tratar findings reais.
3. Validação visual Playwright MCP (rota pública `/s/` — sem dev bypass).
4. Branch `feat/avaliacao-token-os` (NÃO commitar na branch atual). PR para `main` com
   `Closes #51` no corpo (keyword em inglês).
5. Aguardar CI/GitHub Actions + veredicto do Gemini Code Review.
