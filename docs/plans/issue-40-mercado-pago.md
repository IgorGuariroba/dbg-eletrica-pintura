# Plano de Implementação — Issue #40

**Fase 3 / Slice 7 — Mercado Pago integration (Checkout Pro + Pix QR + webhook)**

> Camada de integração com Mercado Pago. **Sem UI** — slices 8 (PWA técnico) e 9 (checkout consolidado) consomem. Abordagem TDD: fatias verticais (um teste → uma implementação), tracer bullet primeiro.

---

## 1. Contexto do código existente (reuso antes de criar)

| Peça | Onde | Estado |
| :--- | :--- | :--- |
| Enum `estado_os` com `PAGA` | `src/db/schema.ts:53` | ✅ já existe |
| Transição `CONCLUIDA → PAGA` | `src/operacao/maquina-estado.ts:42` | ✅ já existe |
| Bloqueio PAGA p/ PREVENTIVA/GARANTIA | `maquina-estado.ts:89` (`bloqueiaPagamento`) | ✅ já existe |
| Caso de uso `aplicarTransicao(osId, alvo, ator, motivo, repo)` | `maquina-estado.ts:99` | ✅ reusar p/ transitar PAGA |
| `TransicaoRepo` + impl drizzle | `transicao-repo.ts`, `*-repo-drizzle.ts` | ✅ reusar |
| Padrão idempotência via `onConflictDoNothing().returning()` | `presenca-repo-drizzle.ts` | ✅ replicar p/ webhook |
| Padrão route POST + extração de IP | `src/app/s/[token]/presenca/route.ts` | ✅ replicar |
| Merge em `metadados` jsonb | `complementar-repo-drizzle.ts:96` | referência |
| Acesso a env | `process.env` direto (`db/client.ts`, `notificacao/email-service.tsx`) | seguir |

**Conclusão:** vários acceptance criteria sobre máquina de estados já estão satisfeitos no código. Viram **testes de regressão**, não implementação nova.

### Falta criar
- Dependência `mercadopago` (SDK oficial server-side).
- Tabela `pagamento` (persistência + âncora de idempotência por `payment_id`).
- Domínio `src/pagamento/*` (client MP, checkout, webhook, caso de uso, repo).
- Route `src/app/api/webhooks/mercadopago/route.ts`.

---

## 2. Design de interfaces (testabilidade — módulos profundos)

IO externo (SDK do MP) fica atrás de um **gateway** injetável → funções de checkout testáveis com fake, sem rede. Validação de assinatura e parse do payload são **puras** → unit puro. Persistência idempotente + transição → integração com drizzle (reusa `aplicarTransicao`).

```txt
mercadopago-client.ts   → cria SDK config (env: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, flag sandbox)
        ↓ implementa
GatewayPagamento (interface)   ← funções de checkout dependem disto (fake nos testes)
        ↑ usa
checkout.ts             → criarPreferenciaCheckoutPro(items, metadata)
                          criarCobrancaPix(valor, descricao, metadata)
webhook.ts (puro)       → validarAssinatura(rawBody, headers, secret) : boolean
                          parsearNotificacao(payload) : { paymentId, status, osIds }
processar-pagamento.ts  → caso de uso: idempotência + aplicarTransicao(CONCLUIDA→PAGA)
pagamento-repo.ts       → interface { registrar(payment), buscar(paymentId) }
pagamento-repo-drizzle.ts → onConflictDoNothing por payment_id (idempotência)
        ↓ compõe
app/api/webhooks/mercadopago/route.ts  → POST: valida → parseia → processa → 200/401
```

### Tabela `pagamento` (nova migration drizzle)

```ts
export const pagamento = pgTable("pagamento", {
  // payment_id do MP = PK natural → garante idempotência do webhook.
  paymentId: varchar("payment_id", { length: 64 }).primaryKey(),
  osId: uuid("os_id").notNull().references(() => ordemServico.id, { onDelete: "restrict" }),
  valor: decimal("valor", { precision: 10, scale: 2 }).notNull(),
  metodo: varchar("metodo", { length: 20 }).notNull(),   // pix | credit_card | ...
  status: varchar("status", { length: 20 }).notNull(),   // approved | rejected | cancelled
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow().notNull(),
});
```

> Checkout consolidado (slice 9) paga N OS num pagamento. Decisão p/ esta slice: tabela `pagamento` 1 linha por OS afetada; a idempotência usa `payment_id`. Para múltiplas OS, registrar N linhas `(payment_id, os_id)` numa única tx — PK passa a ser composta `(payment_id, os_id)`. **Confirmar com o usuário** se modela consolidado já agora ou só single-OS nesta slice (ver §5).

---

## 3. Comportamentos a testar (fatias verticais TDD)

Ordem = tracer bullet primeiro, cada teste responde ao que o anterior ensinou. **Nunca escrever todos os testes antes da implementação.**

### Unit puro (`tests/unit/`) — sem rede, sem db

1. **`validarAssinatura` aceita HMAC válido** → tracer bullet. Assinatura calculada com o secret bate → `true`.
2. **`validarAssinatura` rejeita HMAC inválido / ausente** → `false`.
3. **`parsearNotificacao` extrai `paymentId`, `status`, `osIds`** do payload do MP (lê `metadata.os_id` / `metadata.os_ids`).
4. **`parsearNotificacao` em payload sem metadata os_id** → erro/Null tratável (não explode).
5. **`criarPreferenciaCheckoutPro` monta request correto** (fake gateway): items, `metadata.os_id`, `back_urls` success/failure, retorna `{ url, preferenciaId }`.
6. **`criarCobrancaPix` retorna `{ qrBase64, copiaCola, transacaoId }`** (fake gateway).
7. **decisão de transição:** pagamento `approved` → decide transitar PAGA; `rejected`/`cancelled` → decide **não** transitar (função pura que separa decisão de IO).

### Integração (`tests/integration/`) — drizzle real (`describe.skipIf(!hasDb)`)

8. **Webhook aprovado transita OS:** seed OS em `CONCLUIDA` → processar pagamento `approved` → OS vira `PAGA` + linha em `pagamento` com `payment_id`, valor, método.
9. **Idempotência:** mesmo `payment_id` processado 2× → 1 linha em `pagamento`, 1 transição (segunda chamada no-op via `onConflictDoNothing`).
10. **Pagamento rejeitado:** estado da OS **não muda**, registra evento/log, sem transição.
11. **PREVENTIVA/GARANTIA:** se webhook chegar p/ OS que bloqueia PAGA → `TransicaoInvalidaError` tratado, não transita (regressão de `bloqueiaPagamento`).

### Route (`tests/integration/` ou unit do handler)

12. **POST com assinatura inválida → 401.**
13. **POST válido aprovado → 200** e efeito aplicado.

### Regressão de máquina de estados (já implementada)
14. `transicionar` CONCLUIDA→PAGA permitido p/ NORMAL/EXPRESS/COMPLEMENTAR (provável já coberto em `operacao-maquina-estado.test.ts` — verificar e completar se faltar).

---

## 4. Loop TDD (execução)

Para **cada** comportamento da §3, na ordem:

```
RED:   escreve UM teste → roda pnpm test → falha
GREEN: código mínimo p/ passar → roda pnpm test → passa
```

Regras: um teste por vez; só o código necessário; não antecipar fatias futuras; testar comportamento observável via interface pública (não detalhe interno).

**Refactor (só no verde, depois de tudo passar):**
- Extrair duplicação entre checkout Pix/Pro.
- Aprofundar `processar-pagamento` (interface pequena, esconde idempotência + transição + log).
- Garantir que renomear interno não quebra teste (sinal de teste acoplado a implementação).

### Passos não-TDD (infra, antes do tracer bullet)
1. `pnpm add mercadopago` + tipos.
2. Migration drizzle da tabela `pagamento` (`pnpm drizzle-kit generate` conforme fluxo do repo).
3. Env: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_SANDBOX` em `.env.local` (NUNCA versionar) + documentar no `.env.example` se existir.

### Validação final
```bash
pnpm lint && pnpm typecheck && pnpm test
```

---

## 5. Pontos a confirmar com o usuário (antes de codar)

1. **Escopo consolidado nesta slice:** modelar `pagamento` já com múltiplas OS por `payment_id` (PK composta `(payment_id, os_id)`), ou só single-OS agora e expandir na slice 9? Recomendação: **PK composta já agora** — barato e evita migration dupla.
2. **Validação de assinatura:** MP usa header `x-signature` (formato `ts=...,v1=...`) com HMAC-SHA256 sobre template `id:<data.id>;request-id:<x-request-id>;ts:<ts>`. Confirmar que vamos validar o esquema oficial (não um HMAC simplificado).
3. **Back URLs / success-failure:** quais rotas usar como `back_urls` já que slice 7 não tem UI? Placeholder `NEXT_PUBLIC_SITE_URL/pagamento/sucesso` (criadas na slice 8) ou só o domínio raiz por ora?
4. **Onde mora o domínio:** `src/pagamento/` (novo) — coerente com `src/operacao`, `src/catalogo`. Confirmar nome.

---

## 6. Mapa acceptance criteria → cobertura

| Critério (issue #40) | Como cobre |
| :--- | :--- |
| SDK MP configurado (sandbox+prod via flag) | `mercadopago-client.ts` + env `MP_SANDBOX` |
| `criarPreferenciaCheckoutPro` retorna URL+items+metadata+back_urls | comportamento 5 |
| `criarCobrancaPix` retorna QR base64 + copia-cola | comportamento 6 |
| Webhook valida assinatura HMAC | comportamentos 1,2,12 |
| Webhook idempotente (mesmo payment_id 1×) | comportamento 9 |
| Aprovado → CONCLUIDA→PAGA + persiste payment_id/valor/método | comportamento 8 |
| Rejeitado/cancelado → estado não muda + log | comportamento 10 |
| Enum PAGA + transição CONCLUIDA→PAGA | ✅ já no código (regressão 14) |
| Teste: webhook simulado dispara transição | comportamento 8/13 |
| Teste: webhook duplicado não duplica | comportamento 9 |
| Teste: assinatura inválida → 401 | comportamento 12 |
| Doc no PR: rotacionar credenciais + setup sandbox | seção no PR description + §4 passo 3 |
