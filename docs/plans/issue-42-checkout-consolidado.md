# Plano de Implementação — Issue #42

**Fase 3 / Slice 9 — Checkout consolidado**

> Página pública de pagamento **agrupada por Solicitação** em `/s/{token}/pagar` (sem login) e acessível pelo portal cliente logado. Lista as OS **CONCLUÍDA** (pagáveis) e **PAGA** (riscada) da Solicitação, com botão individual por OS e um botão **"Pagar tudo junto"** (preferência única com a soma + `os_ids` no metadata). **Tem UI** → fluxo Builder → UX Reviewer → Frontend Reviewer → Refactor + validação visual Playwright (CLAUDE.md §2 e §2.5).
>
> **Blocked by #40** (já mergeado, PR #111) — usa `criarPreferenciaCheckoutPro`, `processarPagamento`, `parsearNotificacao`, tabela `pagamento`. O webhook consolidado (transição de N OS por `os_ids`) **já existe** desde a slice 7; esta slice o exercita e cobre com teste.

---

## 1. Contexto do código existente (reuso antes de criar)

| Peça | Onde | Uso nesta slice |
| :--- | :--- | :--- |
| `criarPreferenciaCheckoutPro(gateway, {items, metadata})` | `src/pagamento/checkout.ts` | individual (`metadata.os_id`) **e** consolidado (`metadata.os_ids` + soma) |
| `criarGatewayMercadoPago()` | `src/pagamento/mercadopago-client.ts` | instanciar gateway nas actions |
| `parsearNotificacao(recurso)` → lê `os_ids` ou `os_id` | `src/pagamento/webhook.ts` | webhook consolidado **já normaliza array** |
| `processarPagamento(dados, deps)` → **loop sobre `osIds`** | `src/pagamento/processar-pagamento.ts` | webhook já transita **N OS** por `os_ids`; idempotência por OS |
| Webhook route (valida assinatura → parseia → processa) | `src/app/api/webhooks/mercadopago/route.ts` | já consome o caminho consolidado, sem mudança |
| Tabela `pagamento` (PK `payment_id, os_id`) | `src/db/schema.ts` | 1 linha por OS; mesmo `payment_id` paga N OS (consolidado) |
| `aplicarTransicao` / `CONCLUIDA → PAGA` | `src/operacao/maquina-estado.ts` | porta única de transição (reuso) |
| Página `/s/[token]/page.tsx` + `carregarParaCliente(token, repo)` | `src/app/s/[token]/`, `src/operacao/aprovacao.ts` | padrão de tela pública por token (header/footer, layout, badges) |
| `AprovacaoRepo` / `SolicitacaoView` / drizzle | `src/operacao/aprovacao-repo*.ts` | modelo de leitura por token — **estender** p/ pagamento |
| Query "orçamento aprovado da OS" (`aprovadoEm not null`, `total`) | `src/app/campo/os/[id]/cobranca/actions.ts:43` | fonte do **valor a cobrar** por OS |
| `formatBRL`, `SiteHeader`, `SiteFooter` | `src/lib/utils.ts`, `src/app/_landing/*` | UI |
| `rotularEstadoCliente`, `VARIANTE_ESTADO`, `LABEL_CATEGORIA` | `src/operacao/rotulo-estado.ts`, página `/s` | rótulos/badges |
| Portal logado: `/portal/solicitacao/[id]` + `carregarSolicitacaoDoCliente` (lê `token` internamente) | `src/app/portal/solicitacao/[id]/`, `src/portal/historico-repo-drizzle.ts:154` | origem do redirect/link "Pagar" |
| Componentes shadcn: `Card`, `Button`, `Badge`, `Separator` | `src/components/ui/*` | UI (sem HTML cru) |
| Convenção de teste: `tests/unit/*.test.ts`, `tests/integration/*.test.ts` (`describe.skipIf(!hasDb)`, seed+cleanup) | `tests/` | onde escrever os testes |

### Falta criar
- **Modelo de leitura de pagamento por token**: lista de OS `CONCLUIDA`+`PAGA` da Solicitação, cada uma com o `total` do orçamento aprovado e flag `pago`. (domínio + método de repo)
- **Função pura `montarCheckoutConsolidado(ordens)`** (módulo profundo): particiona pagáveis × pagas, soma o pagável, monta a lista de `os_ids` para o "pagar tudo". Testável sem DB.
- Página `src/app/s/[token]/pagar/page.tsx` + componente cliente da lista.
- Server actions `src/app/s/[token]/pagar/actions.ts`: `pagarOsAction(token, osId)` e `pagarTudoAction(token)` — **escopadas pelo token** (segurança).
- Link/redirect "Pagar" no portal logado (`/portal/solicitacao/[id]`) → `/s/{token}/pagar` (expor `token` na view do portal, hoje só devolve `protocolo`).
- **Páginas de retorno `/pagamento/sucesso` e `/pagamento/falha`** — `back_urls` do Checkout Pro apontam pra elas e **ainda não existem** (gap herdado da slice 8). Ver §7.

---

## 2. Design de interfaces (testabilidade)

```txt
mercadopago-client.criarGatewayMercadoPago()              (rede)
        ↓ injeta
checkout.criarPreferenciaCheckoutPro({items, metadata})   (slice 7, já testado)
        ↑ usa
actions (server, /s/[token]/pagar/actions.ts)  — TODAS escopadas pelo token
  ├─ pagarOsAction(token, osId)
  │     → repo valida (osId ∈ solicitação do token) + estado CONCLUIDA
  │     → criarPreferenciaCheckoutPro(items:[1 OS], metadata:{os_id}) → {url} | {erro}
  └─ pagarTudoAction(token)
        → repo carrega pagáveis do token → montarCheckoutConsolidado
        → criarPreferenciaCheckoutPro(items, metadata:{os_ids:[...]}, soma) → {url} | {erro}
        ↓ usa
PagamentoCheckoutRepo.carregarPorToken(token)  ← modelo de leitura novo
   → { ordens: [{ osId, categoria, estado, total, pago }] }   (CONCLUIDA + PAGA)
        ↓ função pura (deep, testável isolada)
montarCheckoutConsolidado(ordens)
   → { pagaveis:[{osId,total}], pagas:[...], somaPagavel, osIds, podePagarTudo }

PagarView (client) — lista por OS
  ├─ OS CONCLUIDA: valor + botão "Pagar esta OS" → pagarOsAction → window.location = url
  ├─ OS PAGA: riscada + Badge "pago", sem botão
  └─ rodapé: "Pagar tudo junto (R$ X)" → pagarTudoAction (se podePagarTudo)

WEBHOOK (já existe — sem código novo, só teste):
parsearNotificacao(metadata.os_ids=[a,b]) → DadosPagamento{osIds:[a,b]}
        ↓
processarPagamento → loop: registrar(idempotente) + aplicarTransicao(CONCLUIDA→PAGA) por OS
```

**Módulo profundo:** `montarCheckoutConsolidado` esconde (partição por estado + soma + montagem de `os_ids`) atrás de uma assinatura mínima — é o coração testável da slice, independente de DB/rede. As actions só orquestram repo + gateway.

**Segurança (núcleo da slice):** o `osId` vem do cliente (sem login no fluxo `/s/`). As actions **nunca** confiam nele direto — o repo só devolve/aceita OS que pertençam à Solicitação daquele `token`. `pagarOsAction(token, osIdDeOutraSolicitacao)` deve falhar.

### Extensão mínima do modelo de leitura
A `SolicitacaoView` de aprovação foca ORÇADA/APROVADA e **não** traz `PAGA` nem o `total` cru por OS de forma conveniente para cobrança. Em vez de inflar a `AprovacaoRepo`, criar um port enxuto `PagamentoCheckoutRepo` (ou método dedicado) que devolve só o necessário: `osId, categoria, estado ∈ {CONCLUIDA, PAGA}, total (orçamento aprovado), pago`. Mantém a separação de responsabilidades (aprovação × cobrança).

---

## 3. Comportamentos a testar (fatias verticais TDD)

> Regra: um teste → uma implementação → repete. Tracer bullet primeiro. **Nunca** todos os testes antes do código (anti-pattern horizontal).

### Domínio puro (`tests/unit/`) — sem DB
1. **Tracer bullet — partição básica:** `montarCheckoutConsolidado([CONCLUIDA 250])` → `pagaveis=[{osId,250}]`, `somaPagavel="250.00"`, `osIds=[osId]`, `podePagarTudo=true`.
2. **OS PAGA não entra no pagável:** 1 CONCLUIDA + 1 PAGA → `pagas` contém a PAGA (p/ render riscado), `pagaveis` só a CONCLUIDA, soma = total da CONCLUIDA.
3. **Nada pagável:** todas PAGA (ou lista vazia) → `somaPagavel="0.00"`, `osIds=[]`, `podePagarTudo=false` (esconde "pagar tudo").
4. **Soma de múltiplas:** 2 CONCLUIDA (250 + 199.90) → `somaPagavel="449.90"`, `osIds=[a,b]` (precisão decimal, sem float drift).

### Integração / actions (`tests/integration/`) — DB + gateway fake
5. **Modelo de leitura escopado:** `carregarPorToken(token)` devolve só OS da Solicitação do token, estado ∈ {CONCLUIDA, PAGA}, com o `total` do orçamento **aprovado**; ignora OS de outra Solicitação.
6. **Individual monta preferência certa:** `pagarOsAction(token, osId)` (OS CONCLUIDA do token) → `criarPreferenciaCheckoutPro` chamado com `metadata={os_id}` e `unit_price` = total do orçamento; retorna `{url}`.
7. **Segurança — OS de fora do token rejeitada:** `pagarOsAction(token, osIdDeOutraSolicitacao)` → `{erro}`, **gateway não é chamado**, nada criado.
8. **"Pagar tudo" consolida:** `pagarTudoAction(token)` com 2 CONCLUIDA → 1 preferência única, `metadata={os_ids:[a,b]}`, valor = soma; retorna `{url}`.
9. **Webhook consolidado transita N OS:** `processarPagamento({status:"approved", osIds:[a,b]})` → **ambas** viram `PAGA`, 2 linhas em `pagamento` com o mesmo `payment_id`. (exercita o caminho que já existe)
10. **Pagamento parcial não interfere:** pagar **só** a OS `a` (webhook `os_id:a`) → `a` PAGA, `b` segue CONCLUIDA indefinidamente.
11. **Duas individuais em sequência:** webhook `a` depois webhook `b` (payment_ids distintos) → ambas PAGA, sem interferência mútua.
12. **Idempotência consolidada:** mesmo webhook `os_ids:[a,b]` reenviado → 2 linhas no total, **sem** segunda transição (reusa garantia da PK da slice 7).
13. **Já PAGA não recobra:** `pagarOsAction(token, osIdPaga)` → `{erro}` (estado ≠ CONCLUIDA), gateway não chamado.

### UI (Playwright MCP — §2.5, obrigatório)
14. `/s/{token}/pagar` lista as OS **CONCLUÍDA** com valor e botão **"Pagar esta OS"** por linha.
15. OS já **PAGA** aparece riscada + Badge "pago", **sem** botão.
16. Botão **"Pagar tudo junto (R$ X)"** visível quando há ≥1 pagável; some quando não há.
17. Clicar individual / "pagar tudo" **redireciona** para o `init_point` do MP (mock/intercept da preferência).
18. **Portal logado** (`/portal/solicitacao/[id]`, dev bypass de cliente) tem ação "Pagar" que leva à **mesma** `/s/{token}/pagar`.
19. Responsividade nas 4 resoluções (390/768/1366/1920): sem scroll horizontal (`scrollWidth === clientWidth`), área de toque ≥44px, densidade **Detalhes/Tabela** mobile (lista de cards no mobile).

---

## 4. Loop TDD + fluxo de UI

### Fase A — Domínio (TDD puro, sem tela)
Para cada comportamento 1–13: `RED` (um teste) → `GREEN` (código mínimo) → repete. Tracer bullet (1) primeiro. Refatorar só no verde.

Ordem de implementação:
1. `montarCheckoutConsolidado` (função pura) — comportamentos 1–4.
2. `PagamentoCheckoutRepo` port + impl drizzle (`carregarPorToken`) — comportamento 5.
3. `pagarOsAction` (guard de escopo por token + estado CONCLUIDA + preferência `os_id`) — comportamentos 6, 7, 13.
4. `pagarTudoAction` (carrega pagáveis + `montarCheckoutConsolidado` + preferência `os_ids`) — comportamento 8.
5. **Webhook**: sem código novo. Escrever os testes 9–12 contra `processarPagamento`/`parsearNotificacao` existentes; só implementar se algum revelar lacuna (ver §7 sobre atomicidade).

### Fase B — UI (Builder → Review → Refactor, CLAUDE.md §2)
6. **Builder:** `src/app/s/[token]/pagar/page.tsx` (server: `carregarPorToken`, `notFound()` em token inválido, `montarCheckoutConsolidado` para o view-model) + `PagarView` (client) com lista. Só `src/components/ui/*`, tokens semânticos, sem hex/cor bruta, sem inline style estético. Reusar `SiteHeader`/`SiteFooter`, `formatBRL`, badges de estado da página `/s`.
7. Link "Pagar" no portal logado → expor `token` na view do portal e renderizar `buttonVariants` apontando `/s/{token}/pagar` (mesma página; sem rota nova de redirect).
8. Criar páginas mínimas `/pagamento/sucesso` e `/pagamento/falha` se ainda não existirem (ver §7) — necessárias para o `auto_return` do MP não cair em 404.
9. **UX Reviewer + Frontend Reviewer:** abrir no Playwright MCP, validar comportamentos 14–19, relatório no formato §2.2. Semear Solicitação com 2 OS CONCLUÍDA + 1 PAGA (+ orçamentos aprovados) e **limpar tudo** ao final (linhas + `DEV_BYPASS_EMAIL` + processo `pnpm dev`).
10. **Refactor:** corrigir só o que o review apontar.

### Validação final
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
+ evidência visual (screenshots das 4 resoluções) e fluxos exercitados no relatório.

---

## 5. Pontos a confirmar com o usuário (antes de codar)

1. **Atomicidade do webhook consolidado.** A issue diz "transita todas as OS do metadata pra PAGA **atomicamente**". Hoje `processarPagamento` faz um **loop por OS** (registrar + transição), **não** numa única transação de banco. Se uma transição falhar no meio (erro inesperado, não `TransicaoInvalida`), parte fica PAGA e parte não — e o **retry at-least-once do MP** converge o resto (idempotência por PK). Recomendo: **manter o modelo de convergência por retry** (mais simples, já robusto) e tratar "atomicamente" como "todas acabam PAGA". Alternativa: envolver o loop numa transação drizzle (all-or-nothing real). → **confirmar qual semântica** vale como Done.
2. **Valor a cobrar por OS.** Vem do **orçamento aprovado** mais recente da OS (`aprovadoEm not null`, `total`), igual à slice 8. Confirmar que não há rateio de deslocamento/recálculo no consolidado — soma simples dos `total`.
3. **Páginas de retorno `/pagamento/sucesso|falha`.** Não existem (gap da slice 8). Criar nesta slice (mínimas, reusando `SiteHeader/Footer`) ou tratar como dívida separada? → recomendo criar o mínimo aqui, senão o redirect do MP quebra.
4. **Acesso pelo portal logado.** Link direto para `/s/{token}/pagar` (recomendado — "mesma página", sem duplicar UI) **ou** uma rota `/portal/.../pagar` que renderiza o mesmo componente? → recomendo o link direto.
5. **Mostrar OS PAGA riscada — escopo do estado.** Incluir só `CONCLUIDA`+`PAGA`, ou também `GARANTIA_ABERTA`/outras? A issue fala só de CONCLUÍDA (pagável) e PAGA (riscada). → recomendo só esses dois.

---

## 6. Mapa acceptance criteria → cobertura

| Critério (issue #42) | Como cobre |
| :--- | :--- |
| `/s/{token}/pagar` lista OS CONCLUÍDA da Solicitação | comportamentos 5, 14 |
| Botão individual cria preferência com 1 OS no metadata | comportamentos 6, 17 |
| Botão "pagar tudo junto" → soma + `os_ids` | comportamentos 8, 16, 17 |
| Webhook consolidado atualiza N OS atomicamente | comportamento 9 (+ §5.1) |
| OS já PAGA marcada e sem botão | comportamentos 2, 13, 15 |
| Acesso pelo portal cliente leva à mesma página | comportamento 18 |
| Pagar 2 OS individualmente em sequência funciona | comportamento 11 |
| Teste: pagar tudo junto + webhook → todas PAGA | comportamentos 8 + 9 |
| Teste: 1 OS paga individual, outras seguem CONCLUÍDA | comportamento 10 |

---

## 7. Riscos / notas

- **Atomicidade vs convergência (§5.1):** decidir antes de codar o teste 9. Se "atomicidade real" for exigida, é a única mudança de código no webhook (envolver o loop numa transação) — caso contrário, slice é **só leitura + actions + UI**, webhook intocado.
- **Segurança de escopo por token:** o risco central. `osId` é input não confiável (fluxo sem login). Garantir no repo/action que toda OS cobrada pertence à Solicitação do token (teste 7 é obrigatório, não opcional).
- **`back_urls` órfãs:** `/pagamento/sucesso` e `/pagamento/falha` não existem — `auto_return:"approved"` redireciona o cliente pra 404 após pagar. Criar páginas mínimas (§4.8) ou alinhar como dívida.
- **`global-setup.ts`** já varre `pagamento` (slice 7); os testes consolidados geram linhas com `payment_id` compartilhado — limpar por `osId`/`solicitacaoId` no `afterAll`.
- **Modelo de leitura novo, não inflar `AprovacaoRepo`:** manter `PagamentoCheckoutRepo` separado (aprovação × cobrança são contextos distintos — ver `src/pagamento/CONTEXT.md`).
- **Precisão decimal:** somar `total` como decimal string (evitar `Number` drift); usar a mesma estratégia de `formatBRL`/decimal do projeto.
- **Dev bypass:** `/s/{token}/pagar` é **público** (não precisa sessão); só o teste 18 (portal) usa `DEV_BYPASS_EMAIL` = e-mail de cliente cadastrado.
