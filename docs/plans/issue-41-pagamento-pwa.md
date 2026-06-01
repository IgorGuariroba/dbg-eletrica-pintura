# Plano de Implementação — Issue #41

**Fase 3 / Slice 8 — Pagamento no PWA técnico (Pix QR + link MP + manual)**

> Primeira tela que consome a camada de pagamento da slice 7 (#40, PR #111). Técnico em OS **CONCLUÍDA** escolhe entre 3 formas de cobrança. **Tem UI** → fluxo Builder → UX Reviewer → Frontend Reviewer → Refactor + validação visual Playwright (CLAUDE.md §2 e §2.5).
>
> **Blocked by #40** — só começar após o merge do PR #111 (precisa de `criarCobrancaPix`, `criarPreferenciaCheckoutPro`, `processarPagamento`, tabela `pagamento`).

---

## 1. Contexto do código existente (reuso antes de criar)

| Peça | Onde | Uso nesta slice |
| :--- | :--- | :--- |
| `criarCobrancaPix(gateway, {valor, descricao, metadata})` | `src/pagamento/checkout.ts` | modo Pix QR |
| `criarPreferenciaCheckoutPro(gateway, {items, metadata})` | `src/pagamento/checkout.ts` | modo Link MP |
| `criarGatewayMercadoPago()` | `src/pagamento/mercadopago-client.ts` | instanciar gateway nas actions |
| `processarPagamento(dados, deps)` | `src/pagamento/processar-pagamento.ts` | modo manual (reuso, `status:"approved"`) |
| Tabela `pagamento` (PK `payment_id, os_id`) | `src/db/schema.ts` | registrar manual (payment_id sintético) |
| `aplicarTransicao` / `CONCLUIDA → PAGA` | `src/operacao/maquina-estado.ts` | já permite; manual não usa webhook |
| `exigirTecnico()` | `src/app/campo/guard.ts` | guard das actions |
| GET OS (retorna `estado`) | `src/app/api/campo/os/[id]/route.ts` | **polling 30s** de PAGA |
| `urlWhatsApp(msg)` + `WHATSAPP_NUMERO` | `src/lib/contato.ts` | botão "Enviar via wa.me" |
| Fila offline Dexie `fila_sync` + `processarItemSync` por `tipo` | `src/features/campo/db.ts`, `sync.ts` | modo manual offline |
| Padrão action `(prev, FormData) → {erro?, ok?}` | `src/app/campo/os/[id]/acoes.ts` | actions desta tela |
| Componentes shadcn: `Tabs`, `Card`, `Button`, `Input`, `Label`, `Select`/`RadioGroup`, `Textarea` | `src/components/ui/*` | UI (sem HTML cru) |
| Rota PWA real: `/campo/os/[id]/...` (não `/pwa/`) | `src/app/campo/...` | **usar `/campo/os/[id]/cobranca`** |

> **Nota de rota:** a issue cita `/pwa/os/{id}/cobranca`, mas o PWA do projeto vive em `/campo/os/[id]/`. Seguir a convenção do repo: **`/campo/os/[id]/cobranca`**.

### Falta criar
- Página `src/app/campo/os/[id]/cobranca/page.tsx` + componente cliente `CobrancaView`.
- Server actions: gerar Pix, gerar link, registrar manual.
- Caso de uso `registrarPagamentoManual` (reusa `processarPagamento`).
- Forma de pagamento manual: enum/validação `DINHEIRO | PIX_DIRETO | TRANSFERENCIA | OUTRO`.
- Coluna `observacao` em `pagamento` (manual registra observação) — **ver §5**.
- Handler `PAGAMENTO_MANUAL` na fila offline (`sync.ts`) + item Dexie.
- Polling de estado no cliente (30s) + indicação visual de PAGA.

---

## 2. Design de interfaces (testabilidade)

```txt
mercadopago-client.criarGatewayMercadoPago()  (rede — só modos digitais)
        ↓ injeta
checkout.criarCobrancaPix / criarPreferenciaCheckoutPro   (slice 7, já testados)
        ↑ usa
actions (server, /campo/os/[id]/cobranca/actions.ts)
  ├─ gerarPixAction(osId)        → guard + estado CONCLUIDA + criarCobrancaPix → {qrBase64, copiaCola} | {erro}
  ├─ gerarLinkAction(osId)       → guard + estado + criarPreferenciaCheckoutPro → {urlWaMe} | {erro}
  └─ registrarManualAction(prev, form) → guard + registrarPagamentoManual → {ok} | {erro}
        ↓ usa
registrarPagamentoManual(osId, {valor, forma, observacao, atorEmail}, deps)   ← caso de uso novo (deep)
        ↓ reusa
processarPagamento(DadosPagamento{paymentId:"manual-<uuid>", status:"approved", ...}, deps)
        ↓ reusa
pagamentoRepo.registrar (idempotente) + aplicarTransicao(CONCLUIDA→PAGA)

CobrancaView (client) — Tabs [Pix QR | Link | Manual]
  ├─ polling GET /api/campo/os/[id] a cada 30s → detecta estado PAGA → banner "Pago"
  ├─ modo manual offline: enfileira FilaSync{tipo:"PAGAMENTO_MANUAL"} no Dexie
  └─ sync.ts: handler "PAGAMENTO_MANUAL" → registrarPagamentoManual no servidor
```

**Módulo profundo:** `registrarPagamentoManual` esconde (geração de id sintético + idempotência + transição) atrás de uma assinatura pequena. Webhook e manual convergem em `processarPagamento` — uma só porta de transição PAGA.

### Extensão mínima da slice 7
`RegistroPagamento` e `DadosPagamento` ganham `observacao?: string`; `processarPagamento` repassa ao `registrar`. Webhook deixa `undefined`. Mantém uma única trilha de persistência.

---

## 3. Comportamentos a testar (fatias verticais TDD)

> Regra: um teste → uma implementação → repete. Tracer bullet primeiro. Nunca todos os testes antes do código.

### Integração / domínio (`tests/integration/`, `tests/unit/`)

1. **Tracer bullet — manual transita sem webhook:** OS `CONCLUIDA` (NORMAL) → `registrarPagamentoManual(valor, "DINHEIRO", obs)` → OS vira `PAGA` + linha `pagamento` com `metodo="DINHEIRO"`, `status="approved"`, `observacao` persistida. (integração)
2. **Ator + timestamp:** a transição registra `atorEmail` = e-mail do técnico e `em` (verifica em `transicao_os`). (integração)
3. **Estado ≠ CONCLUIDA não cobra:** OS `EM_EXECUCAO` → `registrarPagamentoManual` → erro/`transitadas` vazio, estado inalterado. (integração)
4. **Forma inválida rejeitada:** valor ≤ 0 ou forma fora do enum → erro de validação, nada persistido. (unit puro da validação)
5. **Idempotência manual:** mesmo `payment_id` sintético reenviado (retry de sync) → 1 linha, 1 transição. (integração — reusa garantia da slice 7)
6. **Offline — handler de sync:** `processarItemSync({tipo:"PAGAMENTO_MANUAL", payload})` aplica a transição PAGA igual ao online. (integração, espelha `campo-sync.test.ts`)

### Actions / rede

7. **Pix QR sem rede falha com mensagem clara:** `gerarPixAction` com gateway que lança → retorna `{erro: "..."}` legível (não exception crua). (unit com gateway fake que rejeita)
8. **Link MP monta wa.me com o link:** `gerarLinkAction` → `urlWaMe` contém `https://wa.me/` e o `init_point` da preferência. (unit com gateway fake)

### UI (Playwright MCP — §2.5, obrigatório)
9. `/campo/os/[id]/cobranca` exibe **3 opções** (Tabs).
10. Pix QR: imagem grande do QR + texto copia-cola visível e copiável.
11. Link: botão abre `wa.me` com link.
12. Manual: form (valor + forma + observação) → submit → banner **PAGA**.
13. OS não-CONCLUÍDA: tela mostra estado e **não** permite cobrar.
14. Polling: simular webhook externo marcando PAGA → banner aparece em ≤30s (ou botão "Atualizar").
15. Responsividade nas 4 resoluções (390/768/1366/1920), sem scroll horizontal, área de toque ≥44px (QR e botões mobile-first).

---

## 4. Loop TDD + fluxo de UI

### Fase A — Domínio (TDD puro, sem tela)
Para cada comportamento 1–8: `RED` (um teste) → `GREEN` (código mínimo) → repete. Começar pelo tracer bullet (1). Refatorar só no verde.

Ordem de implementação:
1. Migration: coluna `observacao text` em `pagamento` (`pnpm drizzle-kit generate`; aplicar isolado como na slice 7 dado o drift de migrations).
2. Estender `RegistroPagamento`/`DadosPagamento` com `observacao?`.
3. `registrarPagamentoManual` (gera `manual-<uuid>`, monta `DadosPagamento`, chama `processarPagamento`; valida estado CONCLUIDA antes para erro claro).
4. Validação de forma/valor (função pura).
5. Handler `PAGAMENTO_MANUAL` em `sync.ts` + tipo no Dexie.

### Fase B — UI (Builder → Review → Refactor, CLAUDE.md §2)
6. **Builder:** `page.tsx` (server: carrega estado, guard) + `CobrancaView` (client) com `Tabs`. Só componentes `src/components/ui/*`, tokens semânticos, sem hex/cor bruta, sem inline style estético. Densidade: tela de **Formulário/Detalhes** mobile-first (1 coluna, labels visíveis, botões largura total).
   - Adicionar shadcn que faltar: `npx shadcn add tabs radio-group` (se não existirem).
7. Actions client-side: gerar Pix/Link (precisam rede → desabilitar offline com aviso), manual (online → action; offline → enfileira no Dexie + toast "será sincronizado").
8. Polling 30s via GET `/api/campo/os/[id]`; ao detectar `PAGA`, banner + parar polling. Botão "Atualizar" como fallback manual.
9. **UX Reviewer + Frontend Reviewer:** abrir no Playwright MCP (dev bypass de técnico via `DEV_BYPASS_EMAIL`), validar comportamentos 9–15, relatório no formato §2.2. Semear OS CONCLUÍDA + limpar tudo ao final.
10. **Refactor:** corrigir só o que o review apontar.

### Validação final
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
+ evidência visual (screenshots das 4 resoluções) e fluxos exercitados no relatório.

---

## 5. Pontos a confirmar com o usuário (antes de codar)

1. **Observação do manual — onde guardar?** Recomendado: **coluna `observacao text` (nullable) em `pagamento`** — dado estruturado, simétrico ao digital. Alternativa: `motivo` da transição (mais pobre). → recomendo coluna.
2. **Forma de pagamento manual — enum no banco?** Recomendado: **`varchar` validado na aplicação** (`DINHEIRO|PIX_DIRETO|TRANSFERENCIA|OUTRO`), evitando migration de `pgEnum` para um conjunto que pode crescer. A coluna `pagamento.metodo` (varchar 20) já comporta.
3. **Detecção de PAGA na tela:** polling 30s automático **e** botão "Atualizar" (recomendado — cobre o caso de aba em background), ou só um deles?
4. **`payment_id` do manual:** `manual-<uuid>` sintético (recomendado) — garante idempotência via a mesma PK, distingue de pagamentos MP reais por prefixo.
5. **Itens da preferência (Link MP) e valor do Pix:** vêm do **orçamento aprovado** da OS (somatório `total`). Confirmar fonte do valor a cobrar (orçamento mais recente aprovado da OS).

---

## 6. Mapa acceptance criteria → cobertura

| Critério (issue #41) | Como cobre |
| :--- | :--- |
| `/campo/os/{id}/cobranca` mostra 3 opções | comportamento 9 (UI) |
| Pix QR grande + copia-cola | comportamento 10 |
| Link MP abre wa.me com link | comportamentos 8, 11 |
| Manual: valor+forma+observação → transição | comportamentos 1, 12 |
| OS ≠ CONCLUÍDA não cobra | comportamentos 3, 13 |
| Manual registra ator + timestamp | comportamento 2 |
| Indicação de PAGA na tela (polling 30s) | comportamento 14 |
| Manual funciona offline | comportamento 6 |
| Teste: manual → PAGA sem webhook | comportamento 1 |
| Teste: Pix QR sem rede falha claro | comportamento 7 |

---

## 7. Riscos / notas

- **Drift de migrations** (visto na slice 7): gerar a migration da coluna `observacao`, mas aplicá-la isolada (script com `neon`), não via `drizzle-kit migrate` que replaya o histórico divergente.
- **`global-setup.ts`** já varre `pagamento` (slice 7) — manual gera linhas `manual-...`; os testes limpam por `osId`.
- **Modos digitais exigem rede:** desabilitar Pix/Link offline com aviso; só manual enfileira. Não tentar gerar QR offline.
- **Dev bypass:** PWA exige sessão de técnico — usar `DEV_BYPASS_EMAIL` = e-mail de técnico cadastrado para a validação Playwright; remover ao final.
- **Não bloqueia conclusão:** a OS já chega CONCLUÍDA; pagar é opcional. A tela mostra "Aguardando pagamento" enquanto CONCLUÍDA e "Pago" quando PAGA.
```
