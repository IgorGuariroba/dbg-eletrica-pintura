# Plano de Implementação — Issue #37

**Fase 3 / Slice 4 — Aviso suave fora de cobertura no formulário público**
Metodologia: TDD (red→green→refactor, fatias verticais). Depende de #34 (mergeado).

---

## Objetivo

O formulário público `/solicitar` compara o bairro do endereço (resolvido via ViaCEP)
com a lista de bairros atendidos configurada no #34. Fora da lista:

- Aviso amigável **não-bloqueante** no form.
- Solicitação criada normalmente com `fora_cobertura=true`.
- Fila admin (`/painel/fila`) destaca solicitações fora de cobertura com badge.

Sem geocoding; bairro vem do CEP. Sem login.

---

## Decisões travadas

| Tema | Decisão |
| --- | --- |
| Semântica da flag | `fora_cobertura=true` ⟺ bairro **conhecido** E lista **configurada** E bairro **fora** dela. Bairro indefinido (CEP sem ViaCEP) ou lista vazia → `false` (sem aviso, sem flag). |
| Wiring | Server action de criação computa a flag via `listarBairrosAtendidos` e **persiste** (fonte de verdade). O form recebe a lista do server e usa a mesma função pura `bairroForaDaCobertura` para o aviso inline em tempo real (sem round-trip por tecla). |

---

## Reuso (Regra de Ouro §1)

- `normalizarBairro` (#34) — normalização trim+lowercase para comparar.
- `listarBairrosAtendidos` (#34) — seam de leitura pública já pronto.
- `buscarCep` — o form já resolve o bairro pelo CEP.
- `Badge` (shadcn) — já existe para o destaque na fila.

Uma única função pura (`bairroForaDaCobertura`) serve servidor (persistência) e
cliente (aviso) — um só lugar de verdade.

---

## Artefatos

```
src/operacao/cobertura.ts          + bairroForaDaCobertura(bairro, lista)   [puro]
src/db/schema.ts                   + solicitacao.fora_cobertura boolean (migração drizzle)
src/operacao/solicitacao-repo.ts   NovaSolicitacao.foraCobertura; OsFila.foraCobertura
src/operacao/solicitacao-repo-drizzle.ts   persiste/lê a flag
src/operacao/fila-repo.ts          OsFila.foraCobertura
src/operacao/fila-repo-drizzle.ts  join da flag na listagem da fila
src/app/solicitar/actions.ts       computa flag via listarBairrosAtendidos
src/app/solicitar/form.tsx         aviso inline não-bloqueante (fn pura + lista do server)
src/app/painel/fila/page.tsx       badge "fora cobertura"
```

---

## Ciclos TDD (1 teste → 1 implementação)

| # | Tipo | Comportamento testado | Implementação mínima |
| --- | --- | --- | --- |
| 1 ⦿ | unit | `bairroForaDaCobertura("Jardim X", ["centro"])` → `true` | função pura, caso fora |
| 2 | unit | bairro na lista (case/espaço-insensível) → `false` | reusa `normalizarBairro` |
| 3 | unit | bairro vazio/`undefined` → `false` (desconhecido) | guarda de entrada |
| 4 | unit | lista vazia → `false` (sem cobertura configurada) | guarda de lista |
| 5 | int | schema + `criarSolicitacao` persiste `foraCobertura=true` (AC) | coluna + repo + use case |
| 6 | int | bairro coberto → `foraCobertura=false` | caminho coberto |
| 7 | int | `fila-repo`/`listarFila` expõem `foraCobertura` | join da flag |
| 8 | UI | aviso inline no `/solicitar` + badge na fila | §2 (Builder→Review→Refactor) + Playwright |

⦿ = tracer bullet.

---

## Acceptance criteria (mapa)

- [ ] Form `/solicitar` consulta ViaCEP → bairro → ciclo 8 (já existe `buscarCep`)
- [ ] Bairro comparado com lista configurada (#34) → ciclos 1-4
- [ ] Fora da lista: aviso inline não-bloqueante + flag persistida → ciclos 5, 8
- [ ] Submit normal independente do status de cobertura → ciclo 5 (flag não bloqueia)
- [ ] Fila admin mostra badge "fora cobertura" → ciclos 7, 8
- [ ] CEP sem retorno ViaCEP: desconhecido (sem aviso, sem flag) → ciclo 3
- [ ] Teste: bairro fora da lista gera Solicitação com `fora_cobertura=true` → ciclo 5

---

## Validação final

`pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes +
validação visual Playwright MCP (§2.5) nas 4 resoluções (390/768/1366/1920):
aviso inline aparece/desaparece conforme o bairro, submit não-bloqueante,
badge na fila. Branch: `feat/issue-37-aviso-cobertura`. PR com `Closes #37`.
