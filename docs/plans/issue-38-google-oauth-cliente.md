# Plano de Implementação — Issue #38

**Fase 3 / Slice 5 — Google OAuth cliente + vinculação Google↔WhatsApp + desvincular**
Metodologia: TDD (red→green→refactor, fatias verticais). Pai #7. Bloqueado por #12 (mergeado). Base do Portal logado (#39).

---

## Objetivo

Auth.js (já configurado, ADR 0001) passa a aceitar **cliente**, não só membro/admin. Fluxo:

1. Cliente faz "Entrar com Google". E-mail fora da tabela `membro` → role `cliente` (já é o default do `detectRole`).
2. **Primeira sessão exige confirmar WhatsApp**: tela "Qual seu WhatsApp?" → sistema gera código → entrega manual via WhatsApp (atendimento humano nesta fase, igual às notificações wa.me da Fase 1, ADR 0004) → cliente digita código → vincula `google_email` ↔ `whatsapp` na tabela `cliente`.
3. Segundo Google tentando o mesmo WhatsApp já vinculado → bloqueio tipado ("número já vinculado a outra conta Google").
4. Membro com módulo **Equipe** acessa `/admin/equipe/clientes/{whatsapp}` → botão "Desvincular Google" (edge case: vinculação errada).
5. JWT da sessão do cliente passa a carregar o `whatsapp` vinculado (ou `null` enquanto não vinculado).

> Referência de jornada: `fluxo-casos-uso.html` passo **4 — Acesso ao Site (com ou sem Google)**: "Primeiro Google a acessar vincula ao número do form. Outro Google → bloqueado. Admin pode desvincular Google no módulo Equipe."

---

## Decisões travadas

| Tema | Decisão |
| --- | --- |
| Coluna de vínculo | Adiciona `cliente.google_email` (varchar 255, **unique**). O `cliente.google_id` existente fica inerte nesta fase (não há flow que o popule). `google_email` é o que role detection lê e o que o admin vê/desvincula — bate com o AC literal. |
| Cliente precisa pré-existir | Vinculação **anexa** `google_email` a um `cliente` já criado por uma Solicitação (chave `whatsapp`). WhatsApp sem cliente cadastrado → `ClienteNaoEncontradoError` (cliente precisa ter feito ≥1 Solicitação). |
| Entrega do código | Fase manual: `iniciarVinculacao` gera código de **6 dígitos** e cria `notificacao_in_app` para o módulo **EQUIPE** (atendente lê e envia por WhatsApp). Tela do cliente também mostra link `wa.me` da empresa. Sem Cloud API (chega na Fase 4). |
| Armazenamento do código | Plano: código em texto puro + `expira_em` (curto, baixo risco, canal manual). Documentar; hashear é melhoria futura. |
| Expiração | Pendente válida por **15 min**. Expirada → `VinculacaoExpiradaError`. Uma pendente por `google_email` (re-iniciar substitui). |
| Concorrência (2º Google) | `cliente.google_email` **unique** → 2ª confirmação concorrente para o mesmo número cai em `23505` → `WhatsappJaVinculadoError` (mesmo padrão `ehViolacaoUnica` de `membro-repo-drizzle`). Checagem ansiosa no `iniciar` cobre o caso comum; o índice cobre a corrida. |
| Sessão pega o vínculo | `jwt` callback: quando `role === "cliente"` **e** `!token.whatsapp`, re-consulta `cliente.google_email`. Assim, logo após confirmar, a próxima request popula `token.whatsapp` sem `update()` explícito. Cliente já vinculado: 0 query extra (token já tem). |
| Gate de vinculação | Cliente logado **sem** `session.user.whatsapp` → redirect para `/portal/vincular`. Página inerte se já vinculado (redirect `/`). |
| Desvincular | Só módulo **EQUIPE** (`exigirEquipe`). Limpa `google_email`, grava log `DESVINCULADO`. Cliente pode então vincular novo Google. |
| Histórico | Tabela `vinculacao_google_log` (evento `VINCULADO`/`DESVINCULADO`, cliente, google_email, ator, timestamp) — atende "histórico preservado em log". |

---

## Reuso (Regra de Ouro §1)

- `detectRole` / role `cliente` — `src/auth/role-detection.ts` (não muda; cliente já é o default).
- Callbacks `jwt`/`session` e tipo `Session.user` — `src/auth.ts` (estender, não reescrever).
- `montarLinkWhatsApp` — `src/lib/whatsapp.ts` (link wa.me da empresa).
- Normalização de WhatsApp (só dígitos) — `src/lib/contato.ts` / `src/lib/whatsapp.ts` (reusar; não criar outra).
- `ehViolacaoUnica` (mapeia `23505` → erro tipado) — `src/db/client.ts`.
- `notificacaoInApp` (destinatário por módulo) — `src/db/schema.ts` (já existe; usar para o código manual).
- Padrão repo + erros tipados — espelhar `src/equipe/membro-repo.ts` + `membro-repo-drizzle.ts`.
- Guard de módulo — `src/app/admin/equipe/guard.ts` (`exigirEquipe`) e `src/auth/require-modulo.ts`.
- UI: `@/components/ui/{button,input,card,label}`; confirmação destrutiva via `ConfirmDialog`/`AlertDialog` (reusar `components/shared` se existir, senão inline).

---

## Arquitetura

```
iniciarVinculacao({ googleEmail, whatsapp }, repo)     ← valida número livre, gera código, grava pendente
confirmarVinculacao({ googleEmail, codigo }, repo)     ← valida código/expiração, persiste google_email, loga, limpa pendente
desvincular({ whatsapp, atorEmail }, repo)             ← limpa google_email, loga DESVINCULADO
        ↑
VinculacaoRepo (interface)  →  vinculacao-repo-drizzle (mapeia 23505 → WhatsappJaVinculadoError)
```

Núcleo de regra (validação de código/expiração/igualdade de número) extraído puro onde der, para teste sem DB; persistência fica no repo (integração `skipIf !DATABASE_URL`, como `equipe-repo.test.ts`).

### Interface (`src/cliente/vinculacao-repo.ts`)

```ts
export interface PendenteVinculacao {
  googleEmail: string;
  whatsapp: string;
  codigo: string;
  expiraEm: Date;
}

export interface VinculacaoRepo {
  buscarClientePorWhatsapp(whatsapp: string): Promise<{ id: string; googleEmail: string | null } | null>;
  buscarVinculoPorGoogleEmail(googleEmail: string): Promise<{ whatsapp: string } | null>;
  salvarPendente(p: PendenteVinculacao): Promise<void>;   // upsert por googleEmail
  buscarPendente(googleEmail: string): Promise<PendenteVinculacao | null>;
  removerPendente(googleEmail: string): Promise<void>;
  vincular(whatsapp: string, googleEmail: string): Promise<void>; // set google_email; 23505 → WhatsappJaVinculadoError
  desvincular(whatsapp: string): Promise<boolean>;
  registrarLog(e: { clienteId: string; googleEmail: string; whatsapp: string; evento: "VINCULADO" | "DESVINCULADO"; atorEmail: string }): Promise<void>;
  notificarEquipe(input: { whatsapp: string; codigo: string }): Promise<void>; // notificacao_in_app, módulo EQUIPE
}

export class WhatsappJaVinculadoError extends Error {}
export class ClienteNaoEncontradoError extends Error {}
export class CodigoInvalidoError extends Error {}
export class VinculacaoExpiradaError extends Error {}
```

---

## Schema (`src/db/schema.ts`) + migração

```ts
// cliente: + coluna
googleEmail: varchar("google_email", { length: 255 }),
// + uniqueIndex("cliente_google_email_uq").on(t.googleEmail)

export const eventoVinculacaoEnum = pgEnum("evento_vinculacao", ["VINCULADO", "DESVINCULADO"]);

export const vinculacaoGooglePendente = pgTable("vinculacao_google_pendente", {
  googleEmail: varchar("google_email", { length: 255 }).primaryKey(),
  whatsapp: varchar("whatsapp", { length: 20 }).notNull(),
  codigo: varchar("codigo", { length: 6 }).notNull(),
  expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow().notNull(),
});

export const vinculacaoGoogleLog = pgTable("vinculacao_google_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  clienteId: uuid("cliente_id").notNull().references(() => cliente.id, { onDelete: "cascade" }),
  googleEmail: varchar("google_email", { length: 255 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 20 }).notNull(),
  evento: eventoVinculacaoEnum("evento").notNull(),
  atorEmail: varchar("ator_email", { length: 255 }).notNull(),
  em: timestamp("em", { withTimezone: true }).defaultNow().notNull(),
});
```

Gerar com `pnpm db:generate` → `drizzle/00xx_*.sql`.

---

## Auth (`src/auth.ts`)

- Tipo: `Session.user` ganha `whatsapp?: string | null`.
- `lookupClienteVinculo(googleEmail) → { whatsapp } | null` (nova dep, igual `lookupMembro`).
- `jwt`: após `detectRole`, se `role === "cliente" && !token.whatsapp` → `token.whatsapp = (await lookupClienteVinculo(email))?.whatsapp ?? null`.
- `session`: `session.user.whatsapp = (token.whatsapp as string | null) ?? null`.
- Lógica pura testável extraída em helper (`enriquecerSessaoCliente`) para o ciclo unit.

---

## Rotas / UI

- **`/portal/vincular/page.tsx`** (cliente logado). Server Component: já vinculado → `redirect("/")`. Senão renderiza:
  - Passo 1 — `Input` WhatsApp → action `iniciarVinculacaoAction` (cria pendente + notifica Equipe + link `wa.me`).
  - Passo 2 — `Input` código → action `confirmarVinculacaoAction` → sucesso → `redirect("/")`.
  - Erros tipados mapeados em mensagem (número já vinculado, código inválido/expirado).
- **Gate**: cliente logado sem `whatsapp` em rotas do portal → redirect `/portal/vincular` (helper de página; middleware fica fora de escopo).
- **`/admin/equipe/clientes/[whatsapp]/page.tsx`** — `await exigirEquipe()`. Mostra `Card` com dados do cliente + status do vínculo. Se `googleEmail` → `Button` "Desvincular Google" dentro de `ConfirmDialog` → action `desvincularGoogleAction` (re-guard Equipe) → `revalidatePath`.

Aderência §2–§11 do CLAUDE.md: só `components/ui/*`, tokens semânticos, sem HTML cru, novo domínio em `src/cliente/` + UI de negócio em `features/`/`app` conforme §11.

---

## Artefatos

```
src/db/schema.ts                                   + google_email, evento_vinculacao, 2 tabelas, relations
drizzle/00xx_vinculacao_google.sql                 migração (pnpm db:generate)
src/cliente/CONTEXT.md                             glossário (Cliente, Vinculação, Código, Desvinculação)
src/cliente/vinculacao-repo.ts                     interface + erros tipados
src/cliente/vinculacao-repo-drizzle.ts             impl Drizzle (23505 → WhatsappJaVinculadoError)
src/cliente/vinculacao.ts                          iniciar / confirmar / desvincular (+ gerarCodigo puro)
src/auth.ts                                         lookupClienteVinculo + jwt/session.whatsapp + tipo
src/app/portal/vincular/page.tsx                   tela "Qual seu WhatsApp?" + código
src/app/portal/vincular/actions.ts                 iniciar/confirmar (server actions)
src/app/admin/equipe/clientes/[whatsapp]/page.tsx  detalhe + Desvincular
src/app/admin/equipe/clientes/[whatsapp]/actions.ts desvincular (guard Equipe)
tests/unit/cliente-vinculacao.test.ts              código/expiração/igualdade (puro)
tests/integration/cliente-vinculacao.test.ts       persistência + bloqueio + desvincular (skipIf !DATABASE_URL)
```

---

## Ciclos TDD (1 teste → 1 implementação)

| # | Tipo | Comportamento testado | Implementação mínima |
| --- | --- | --- | --- |
| 1 ⦿ | int | `iniciarVinculacao` com cliente existente + número livre → grava pendente, código 6 dígitos, `expiraEm` futuro | esqueleto: `gerarCodigo` + `salvarPendente` + `notificarEquipe` |
| 2 | int | `iniciarVinculacao` com WhatsApp já vinculado a OUTRO google → `WhatsappJaVinculadoError` (AC bloqueio) | checagem ansiosa de número ocupado |
| 3 | int | `iniciarVinculacao` com WhatsApp sem cliente cadastrado → `ClienteNaoEncontradoError` | guarda cliente inexistente |
| 4 | int | `confirmarVinculacao` código correto/válido → persiste `google_email`, log `VINCULADO`, remove pendente (AC persiste) | `vincular` + `registrarLog` + `removerPendente` |
| 5 | unit | código errado → `CodigoInvalidoError`; pendente permanece | validação de código (puro) |
| 6 | unit | pendente expirada → `VinculacaoExpiradaError` | comparação de `expiraEm` (puro) |
| 7 | int | número vinculado por outro entre iniciar e confirmar → `confirmarVinculacao` cai em `23505` → `WhatsappJaVinculadoError` (AC cliente B bloqueado) | `ehViolacaoUnica` no `vincular` |
| 8 | int | `desvincular` → limpa `google_email`, log `DESVINCULADO`; depois `iniciarVinculacao` volta a funcionar (AC desvincular + re-vincular) | `desvincular` + `registrarLog` |
| 9 | unit | `enriquecerSessaoCliente`: vinculado → `whatsapp` setado; não vinculado → `null` | helper puro do `jwt`/`session` |

⦿ = tracer bullet.

---

## Acceptance criteria (mapa)

- [ ] Login Google fora de `membro` → sessão `role=cliente` → já garantido por `detectRole`; coberto pela §validação visual
- [ ] Primeira sessão exige confirmar WhatsApp via código → gate `/portal/vincular` + ciclos 1, 4
- [ ] Vinculação persiste `google_email` em `cliente` → ciclo 4
- [ ] Segunda tentativa em WhatsApp ocupado → erro → ciclos 2, 7
- [ ] `/admin/equipe/clientes/{whatsapp}` mostra "Desvincular" só no módulo Equipe → página + `exigirEquipe`
- [ ] Desvincular limpa `google_email`, cliente pode revincular → ciclo 8
- [ ] Histórico de vinculação/desvinculação em log → ciclos 4, 8 (`vinculacao_google_log`)
- [ ] Teste: cliente A vincula Google X; cliente B tenta X com outro WhatsApp → bloqueia → ciclos 2, 7
- [ ] Teste: admin desvincula → cliente vincula novo Google → ciclo 8

---

## Validação visual obrigatória (§2.5 — há UI)

1. `pnpm dev` em background; aguardar `200`.
2. `.env.local`: `DEV_BYPASS_EMAIL` = e-mail **cliente** (com cliente semeado no banco) para `/portal/vincular`; e e-mail **admin/Equipe** para `/admin/equipe/clientes/{whatsapp}`.
3. Resoluções 390/768/1366/1920: sem scroll horizontal (`scrollWidth === clientWidth`); só `components/ui/*`; tokens semânticos; sem HTML cru.
4. Fluxos reais: iniciar → código → confirmar (verificar `google_email` no banco + `notificacao_in_app`); desvincular (verificar coluna limpa + log).
5. Semear mínimo (cliente + pendente) e **limpar tudo** ao final (linhas, `DEV_BYPASS_EMAIL`, processo `pnpm dev`).

---

## Fora de escopo

- Cloud API / envio automático do código (Fase 4) — aqui é manual via wa.me + notificação Equipe.
- Portal logado completo: histórico de OS, faturas, documentos (#39).
- Lista/busca de clientes em `/admin/equipe/clientes` (só a rota de detalhe é exigida) — opcional.
- Middleware global de auth — gate feito por página.
- Reagendamento/cancelamento/garantia por OAuth (slices posteriores).

---

## Validação final

`pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes + §2.5 (Playwright/devtools MCP) com evidências.
Branch: `feat/issue-38-google-oauth-cliente`. PR com `Closes #38`.
Possível ADR curto: "google_email em cliente + vinculação manual por código (Fase 3)".
