# Plano de Implementação — Fase 5 / Slice 1: MP Subscriptions API setup

> **Issue:** #55 (parent #9 — PRD Fase 5) · **Branch:** `feat/mp-subscriptions-setup`
> **Método:** TDD vertical (tracer bullet → ciclos RED→GREEN incrementais), espelhando a arquitetura hexagonal já existente em `src/pagamento/`.

---

## 1. Objetivo

Integrar a **Mercado Pago Subscriptions API** (pre-approval) para cobrança recorrente: criar/pausar/cancelar/atualizar assinatura, e um webhook idempotente que consome eventos do MP e mantém o `status` da assinatura no banco. **Inadimplência é 100% delegada ao MP** (ADR-0006) — o sistema só escuta webhooks e dispara notificação.

**Fora de escopo deste slice** (vão para slices seguintes):
- CRUD de planos com UI + benefícios/desconto (#56)
- Assinatura multicanal / QR / PWA (#57)
- Upgrade/downgrade/cancelamento pela UI admin (#58)
- Notificação WhatsApp de falha (este slice só **registra** a falha + expõe o gancho; o envio é tratado no #58/slice de notificação)

---

## 2. O que já existe (REUTILIZAR — Regra de Ouro §1 do AGENTS.md)

| Ativo | Arquivo | Como reaproveitar |
|---|---|---|
| Validação HMAC do webhook MP | `src/pagamento/webhook.ts` → `validarAssinatura()` | **Reutilizar como está.** Mesmo esquema `ts=...,v1=...` para o webhook de subscriptions. |
| Cliente SDK MP via env | `src/pagamento/mercadopago-client.ts` | Mesmo `MercadoPagoConfig({ accessToken })`. Adicionar `PreApproval`/`PreApprovalPlan` no mesmo módulo ou irmão. |
| Padrão Port/Adapter | `src/pagamento/gateway.ts` (`GatewayPagamento`) | Espelhar com novo port `GatewayAssinatura`. |
| Padrão Use-case + Repo + deps injetadas | `src/pagamento/processar-pagamento.ts` + `pagamento-repo*.ts` | Espelhar `processarEventoAssinatura` + `assinatura-repo`. |
| Idempotência por `onConflictDoNothing` | `src/pagamento/pagamento-repo-drizzle.ts` | Mesmo truque: insert do `event_id` retorna `[]` se duplicado. |
| Env já provisionada | `.env.example` (`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_SANDBOX`) | **Reutilizar.** `MP_ACCESS_TOKEN` é compartilhado (decisão: mesma conta MP da Fase 3). |
| Padrão de teste integração | `tests/integration/pagamento-processar.test.ts` | `describe.skipIf(!hasDb)`, seed `cliente`, cleanup em `afterAll`. |
| Padrão de teste unit (HMAC) | `tests/unit/pagamento-webhook.test.ts` | Helper `assinar()` reaproveitável. |
| Tabela `cliente` (FK) | `src/db/schema.ts:80` | `assinatura.cliente_id` → `cliente.id`. **Issue pede `cliente_whatsapp`; usar FK `cliente_id` (uuid)** por consistência com o resto do schema. |

> A issue cita `cliente_whatsapp FK`, mas todo o schema referencia `cliente.id` (uuid). **Decisão: `assinatura.cliente_id uuid → cliente.id`** (whatsapp é único mas não é a PK). Registrar essa divergência no PR.

---

## 3. Decisões de arquitetura

### 3.1. Novo módulo `src/assinatura/`
Espelha `src/pagamento/`. Mantém o domínio de recorrência isolado do pagamento avulso.

```
src/assinatura/
├── gateway.ts                  # Port GatewayAssinatura (interface) + tipos req/resp
├── mercadopago-assinatura.ts   # Adapter real (PreApproval/PreApprovalPlan)
├── evento-webhook.ts           # parsearEventoAssinatura() + mapeamento status MP→domínio
├── processar-evento.ts         # Use-case: aplica evento ao status (idempotente)
├── assinatura-repo.ts          # Port do repositório (interface)
└── assinatura-repo-drizzle.ts  # Adapter Drizzle
```

Rota: `src/app/api/webhooks/mp-subscriptions/route.ts` (espelha `mercadopago/route.ts`).

### 3.2. Schema (migration `0027`)

Duas tabelas. `plano` entra **mínima** aqui (FK alvo); o CRUD completo (benefícios, % desconto, UI) é o slice #56.

```ts
// src/db/schema.ts

// Status de assinatura (domínio DBG, normalizado a partir do MP)
export const statusAssinaturaEnum = pgEnum("status_assinatura", [
  "PENDENTE",     // pre-approval criado, aguardando 1ª autorização
  "ATIVA",        // authorized
  "PAUSADA",      // paused
  "CANCELADA",    // cancelled
  "INADIMPLENTE", // payment_failed (antes do MP cancelar de vez)
]);

export const plano = pgTable("plano", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 120 }).notNull(),
  preco: decimal("preco", { precision: 10, scale: 2 }).notNull(),
  // preApprovalPlanId do MP (template de cobrança). Nullable: plano pode existir
  // no DBG antes de ser espelhado no MP (slice #56 preenche).
  preapprovalPlanIdMp: varchar("preapproval_plan_id_mp", { length: 64 }),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow().notNull(),
});

export const assinatura = pgTable("assinatura", {
  id: uuid("id").defaultRandom().primaryKey(),
  clienteId: uuid("cliente_id").notNull()
    .references(() => cliente.id, { onDelete: "restrict" }),
  planoId: uuid("plano_id").notNull()
    .references(() => plano.id, { onDelete: "restrict" }),
  status: statusAssinaturaEnum("status").notNull().default("PENDENTE"),
  // preapproval_id do MP — único (1 pre-approval = 1 assinatura).
  preapprovalIdMp: varchar("preapproval_id_mp", { length: 64 }),
  inicio: timestamp("inicio", { withTimezone: true }),
  fimCicloAtual: timestamp("fim_ciclo_atual", { withTimezone: true }),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow().notNull(),
  canceladoEm: timestamp("cancelado_em", { withTimezone: true }),
  motivoCancelamento: text("motivo_cancelamento"),
}, (t) => ({
  preapprovalUq: uniqueIndex("assinatura_preapproval_uq").on(t.preapprovalIdMp),
}));

// Idempotência de eventos de webhook (espelha o truque de `pagamento`).
export const assinaturaEvento = pgTable("assinatura_evento", {
  eventId: varchar("event_id", { length: 80 }).primaryKey(), // id da notificação MP
  preapprovalIdMp: varchar("preapproval_id_mp", { length: 64 }).notNull(),
  tipo: varchar("tipo", { length: 40 }).notNull(), // created|authorized|paused|cancelled|payment_failed|payment_recovered
  recebidoEm: timestamp("recebido_em", { withTimezone: true }).defaultNow().notNull(),
});
```

> `assinatura_evento.event_id PK` garante o critério **"mesmo event_id 2x persiste 1x"** com `onConflictDoNothing` — exatamente como `pagamento`.

### 3.3. Mapa de eventos MP → status

| Evento MP (`type`/`action`) | Efeito no domínio |
|---|---|
| `created` | upsert assinatura, `status=PENDENTE` |
| `authorized` | `status=ATIVA`, grava `inicio`/`fim_ciclo_atual` |
| `paused` | `status=PAUSADA` |
| `cancelled` | `status=CANCELADA`, `cancelado_em=now` |
| `payment` + `status=rejected` (payment_failed) | `status=INADIMPLENTE`, dispara gancho de notificação |
| `payment` + `status=approved` após inadimplência (recovered) | `status=ATIVA` |

> O webhook de subscriptions do MP entrega `data.id` (preapproval) — o adapter **consulta** o pre-approval (igual o fluxo de pagamento consulta `buscarPagamento`) para obter `status` real, em vez de confiar no corpo. Mantém o mesmo padrão "corpo só traz id".

---

## 4. Interfaces (Port)

```ts
// src/assinatura/gateway.ts
export interface CriarAssinaturaReq {
  preapprovalPlanIdMp: string;     // template do plano no MP
  payerEmail: string;
  externalReference: string;       // assinatura.id (DBG) p/ correlação
  backUrl: string;
}
export interface CriarAssinaturaResp {
  preapprovalIdMp: string;
  initPoint: string;               // URL de checkout
  status: string;                  // status cru do MP
}
export interface RecursoAssinaturaMP {
  id: string;
  status: string;                  // authorized|paused|cancelled|pending
  externalReference?: string;
  nextPaymentDate?: string;
}

export interface GatewayAssinatura {
  criarAssinatura(req: CriarAssinaturaReq): Promise<CriarAssinaturaResp>;
  pausarAssinatura(preapprovalId: string): Promise<void>;
  cancelarAssinatura(preapprovalId: string, motivo: string): Promise<void>;
  atualizarAssinatura(preapprovalId: string, novoPlanoIdMp: string): Promise<void>;
  buscarAssinatura(preapprovalId: string): Promise<RecursoAssinaturaMP>;
}
```

> Testável com **fake** (sem rede), idêntico a como `GatewayPagamento` é fakeado nos testes de checkout.

---

## 5. Plano TDD — ciclos verticais (RED → GREEN)

> **Regra do skill /tdd:** um teste por vez, código mínimo para passar, sem antecipar testes futuros. **Nunca refatorar no vermelho.** Não escrever todos os testes de uma vez (anti-pattern horizontal).

### Tracer bullet (ciclo 1)
Prova o caminho ponta-a-ponta com o que já existe.

- **RED:** `tests/unit/assinatura-webhook.test.ts` — "valida assinatura HMAC do webhook de subscriptions" reusando `validarAssinatura` + helper `assinar()`.
- **GREEN:** confirmar reuso de `src/pagamento/webhook.ts` (ou reexport). Sem código novo se já passar — prova que o port HMAC serve.

### Ciclos de mapeamento de evento (use-case puro, sem DB)
`src/assinatura/evento-webhook.ts` + `processar-evento.ts` com repo **fake** em memória.

| Ciclo | Teste (RED) | Código mínimo (GREEN) |
|---|---|---|
| 2 | `authorized` → status `ATIVA` | `parsearEventoAssinatura` + branch authorized |
| 3 | `paused` → `PAUSADA` | branch paused |
| 4 | `cancelled` → `CANCELADA` + `cancelado_em` | branch cancelled |
| 5 | `payment_failed` → `INADIMPLENTE` + chama `notificarFalha` (spy) | gancho de notificação injetável (default fire-and-forget, igual `notificarTransicao`) |
| 6 | `payment_recovered` → volta `ATIVA` | branch recovered |
| 7 | `created` → upsert `PENDENTE` | branch created |
| 8 | evento desconhecido → ignora (no-op, sem throw) | default branch |

### Ciclos de idempotência + persistência (integração, `skipIf(!hasDb)`)
`tests/integration/assinatura-processar.test.ts` — espelha `pagamento-processar.test.ts` (seed `cliente`+`plano`+`assinatura`, cleanup `afterAll` respeitando FKs: evento → assinatura → plano → cliente).

| Ciclo | Teste (RED) | GREEN |
|---|---|---|
| 9 | evento aprovado atualiza `status` no banco | `assinatura-repo-drizzle` (`atualizarStatus`) |
| 10 | **mesmo `event_id` 2x → 1 linha em `assinatura_evento`, status não reprocessa** | `registrarEvento` com `onConflictDoNothing` (retorna bool) |
| 11 | `payment_failed` persiste `INADIMPLENTE` | já coberto pelo branch, valida no DB |
| 12 | `payment_recovered` reverte `INADIMPLENTE`→`ATIVA` | idem |

### Ciclos de criação (gateway, fake)
`tests/unit/assinatura-criar.test.ts`

| Ciclo | Teste (RED) | GREEN |
|---|---|---|
| 13 | `criarAssinatura` retorna `initPoint` + `preapprovalIdMp` e persiste assinatura `PENDENTE` | use-case `criarAssinatura` usando `GatewayAssinatura` fake + repo |
| 14 | `cancelarAssinatura` exige motivo (erro se vazio) | validação no use-case |

### Ciclos de rota (integração, opcional se DB)
`tests/integration/assinatura-route.test.ts` — espelha `pagamento-route.test.ts`.

| Ciclo | Teste (RED) | GREEN |
|---|---|---|
| 15 | POST sem assinatura válida → 401 | rota chama `validarAssinatura` |
| 16 | POST com evento válido → 200 + status atualizado | rota → use-case |
| 17 | POST duplicado → 200, efeito único | idempotência ponta-a-ponta |

### Refactor (após verde)
- Extrair duplicação entre `mercadopago-client.ts` e `mercadopago-assinatura.ts` (config do `MercadoPagoConfig`) se houver — só se natural.
- Avaliar se `validarAssinatura` deve subir para um módulo compartilhado (`src/pagamento/webhook.ts` → `src/lib/`?) já que agora dois webhooks usam. **Decidir no PR**; por ora, importar do módulo `pagamento`.

---

## 6. Critérios de aceite (da issue #55) → cobertura

- [x] SDK MP Subscriptions configurado (sandbox+prod via `MP_SANDBOX`/token) → `mercadopago-assinatura.ts`
- [x] Criação/pausa/cancelamento/atualização → `GatewayAssinatura` + use-cases (ciclos 13–14)
- [x] Webhook valida HMAC → ciclo 1, 15
- [x] Eventos atualizam status → ciclos 2–7, 9–12
- [x] Idempotente (mesmo event_id 1x) → ciclos 10, 17
- [x] `payment_failed` registra + gancho notificação → ciclo 5, 11
- [x] `payment_recovered` reverte p/ ativa → ciclos 6, 12
- [x] Doc no PR: passos manuais MP + sandbox/prod → §7
- [x] Teste webhook simulado atualiza status → ciclos 9, 16
- [x] Teste webhook duplicado não duplica → ciclos 10, 17

---

## 7. Passos manuais MP (documentar no PR)

1. Conta Mercado Pago com **Subscriptions (pre-approval)** habilitado.
2. Criar **Application** no painel MP → obter `Access Token` (TEST- para sandbox, APP_USR- para prod).
3. Configurar webhook no painel MP apontando para `/api/webhooks/mp-subscriptions`, eventos: `subscription_preapproval`, `subscription_authorized_payment`.
4. Copiar a **secret** do webhook → `MP_WEBHOOK_SECRET` (compartilhada com o webhook de pagamento; validar se o MP usa a mesma secret p/ ambos — senão, separar em `MP_SUBS_WEBHOOK_SECRET`).
5. Env:
   - `MP_ACCESS_TOKEN` — reusa Fase 3 (mesma conta).
   - `MP_SANDBOX=true` em dev.
   - Confirmar/adicionar secret de webhook no `.env.example` e `.env.local`.

---

## 8. Checklist de finalização (Workflow §13 + §3.1 do AGENTS.md)

```bash
git switch -c feat/mp-subscriptions-setup
# ... ciclos TDD ...
pnpm lint && pnpm typecheck && pnpm test
pnpm db:generate           # gera migration 0027
pnpm build
npx fallow dead-code
npx fallow dupes
npx fallow health
```
- [ ] Migration `0027` revisada (sem destrutivo).
- [ ] `assinatura-evento` garante idempotência (PK event_id).
- [ ] Divergência `cliente_whatsapp`→`cliente_id` anotada no PR.
- [ ] PR para `main` com doc dos passos manuais MP.
- [ ] Conferir CI + veredicto Gemini.

---

## 9. Riscos / pontos a confirmar antes de codar

1. **Secret do webhook**: o MP usa a mesma `MP_WEBHOOK_SECRET` para payments e subscriptions? Se não, separar env.
2. **Whatsapp vs cliente_id**: confirmar uso de `cliente_id` (recomendado) — diverge do texto literal da issue.
3. **`plano` mínima aqui**: ok criar a tabela já neste slice (FK alvo) e o #56 preenche CRUD/benefícios? (Recomendado — evita FK órfã.)
4. **Notificação de falha**: este slice só expõe o gancho `notificarFalha` (no-op default); envio WhatsApp real fica no #58. Confirmar.
