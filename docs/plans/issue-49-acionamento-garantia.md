# Plano — Issue #49: Acionamento de garantia + validação automática (Fase 4 / Slice 5)

## Context

Fase 4 já entregou a base: certificado de garantia PDF (#48), infra PDF (#47), dispatcher de notificação (#46), WhatsApp Cloud API (#45). Falta o **acionamento** da garantia pelo cliente.

Hoje o cliente vê a OS no portal mas não tem como abrir um chamado de garantia. Esta slice cria o **registro de chamado** (`garantia_chamado`) com **validação automática de prazo** e **detecção de complementar rejeitado**, por dois caminhos: portal (Google logado) e wa.me (atendimento humano registra em `/admin/garantias/registrar`).

Escopo fechado por #49: **só cria o chamado** (`status=pendente`), **sem efeito automático na OS**. A decisão (gerar OS GARANTIA, transitar para `GARANTIA_ABERTA`) é a slice #6 (#50). Bloqueado por #48 (já mergeado).

Regras do `fluxo-casos-uso.html` (caso "11. Recebe Garantia Formal" + sub-fluxo "Garantia" G1 + máquina de estados):
- Botão "Acionar Garantia" visível na OS finalizada (CONCLUÍDA/PAGA) **enquanto prazo válido**; requer Google OAuth (não por token).
- Sem Google → wa.me pro número da empresa; humano aciona no sistema.
- Mini-form: descrição obrigatória (mín. 20 chars) + foto obrigatória (R2 privado).
- Prazo validado contra a **data de pagamento da OS original paga (âncora)** — **prazo NÃO reseta em regarantia**.
- Se a OS original tem Orçamento Complementar **rejeitado** → sinaliza flag pro admin (correspondência = julgamento humano, slice #6).

## Método: TDD (red → green → refactor)

Cada etapa abaixo é um ciclo: escrever teste que falha → implementação mínima → refatorar. Núcleo de domínio é puro (unit), I/O via repos (integration, `describe.skipIf(!hasDb)`).

---

## Reuso (Regra de Ouro) — já existe, NÃO recriar

| Necessidade | Reusar |
| --- | --- |
| Resolver janela de garantia + âncora regarantia (prazo não reseta) | `resolverJanelaGarantia` / `JanelaOriginal` em `src/documentos/janela-garantia.ts` |
| Padrão de resolução de âncora (GARANTIA → `osPaiId`, pagamento approved mais recente) | lógica privada `montarJanelaInput` / `carregarPagamento` em `src/documentos/gerar-documentos-os.ts:255-296` (replicar o padrão no repo novo) |
| Upload foto R2 privado (data URL base64 → objeto) | padrão `uploadFotoOsR2()` em `src/operacao/r2-privado.ts:80-99` |
| Guard de módulo admin | `requireModulo("GARANTIAS", session?.user)` — `src/auth/require-modulo.ts` + padrão `src/app/admin/*/guard.ts` |
| Guard portal (Google logado) | `exigirPortal()` — `src/portal/guard.ts` |
| Server action portal (try/catch + revalidatePath + `{erro?}`) | `src/app/portal/os/[id]/actions.ts` |
| Render da OS no portal (onde entra o botão) | `src/app/portal/solicitacao/[id]/page.tsx` (card por OS, ~linha 94-128) |
| UI: Dialog, Textarea, Button | `src/components/ui/*` (shadcn) |
| `tipo_os` já tem `GARANTIA`; `modulo` já tem `GARANTIAS`; `estado_os` já tem `GARANTIA_ABERTA` | `src/db/schema.ts:35-74` |

---

## Etapas

### 1. Schema + migração — `garantia_chamado`

`src/db/schema.ts` — nova tabela:

```ts
export const canalGarantiaEnum = pgEnum("canal_garantia", ["PORTAL", "WHATSAPP"]);
export const statusGarantiaChamadoEnum = pgEnum("status_garantia_chamado", [
  "pendente", // slice #6 adiciona: aprovado | invalido | ...
]);

export const garantiaChamado = pgTable("garantia_chamado", {
  id: uuid("id").defaultRandom().primaryKey(),
  osOrigemId: uuid("os_origem_id").notNull()
    .references(() => ordemServico.id, { onDelete: "restrict" }), // = âncora
  descricao: text("descricao").notNull(),
  fotoUrl: text("foto_url").notNull(),          // chave R2 privado
  criadoPor: varchar("criado_por", { length: 255 }).notNull(), // email cliente (portal) ou membro (wa.me)
  canal: canalGarantiaEnum("canal").notNull(),
  status: statusGarantiaChamadoEnum("status").notNull().default("pendente"),
  temComplementarRejeitado: boolean("tem_complementar_rejeitado").notNull().default(false),
  acionamentoInvalido: boolean("acionamento_invalido").notNull().default(false), // fora do prazo, registrado por admin
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow().notNull(),
});
```

Gerar migração: `pnpm db:generate` → novo `drizzle/00XX_*.sql`. (Não rodar `db:migrate` no plano — só na execução, contra `.env.local`.)

### 2. Núcleo puro — avaliação do acionamento (UNIT)

Teste primeiro: `tests/unit/garantia-avaliar-acionamento.test.ts`
- dentro do prazo → `dentroDoPrazo=true`, `fim` correto
- fora do prazo (`agora` > `pagamentoEm` + prazo) → `dentroDoPrazo=false`
- **regarantia**: usa janela da âncora (prazo não reseta) — passa se dentro do prazo *original*
- flag complementar rejeitado propagada

Implementação: `src/operacao/garantia/avaliar-acionamento.ts`
```ts
export function avaliarAcionamentoGarantia(input: {
  agora: Date;
  ancora: JanelaOriginal;            // { prazoMeses, pagamentoEm }
  temComplementarRejeitado: boolean;
}): { dentroDoPrazo: boolean; fim: Date; temComplementarRejeitado: boolean }
```
Reusa `resolverJanelaGarantia({ tipo: "GARANTIA", original: input.ancora, prazoMeses: 0, pagamentoEm: input.agora })` → `fim`; `dentroDoPrazo = input.agora <= fim`.

### 3. Repo — âncora + complementar rejeitado + criar chamado (INTEGRATION)

Teste primeiro: `tests/integration/garantia-acionamento.test.ts` (`skipIf(!hasDb)`, seed/cleanup como `operacao-complementar.test.ts`):
- âncora de OS paga direta → `{ prazoMeses, pagamentoEm }`
- âncora de OS GARANTIA → segue `osPaiId` (prazo/pagamento originais)
- `temComplementarRejeitado`: âncora com filha COMPLEMENTAR de orçamento rejeitado → `true`
- `criarChamado` insere linha com flags corretas

Interfaces: `src/operacao/garantia/garantia-repo.ts`
```ts
export interface GarantiaRepo {
  carregarAncora(osId: string): Promise<{ ancoraId: string; prazoMeses: number; pagamentoEm: Date } | null>;
  temComplementarRejeitado(ancoraId: string): Promise<boolean>;
  criarChamado(dados: NovoChamado): Promise<{ id: string }>;
}
```
Impl Drizzle: `src/operacao/garantia/garantia-repo-drizzle.ts`
- `carregarAncora`: se OS é GARANTIA usa `osPaiId`; busca `prazoGarantiaMeses` da âncora + pagamento `status='approved'` mais recente (replica padrão `gerar-documentos-os.ts:255-296`).
- `temComplementarRejeitado`: OS `tipo=COMPLEMENTAR` com `osPaiId=ancoraId` cujo `orcamento.rejeitadoEm IS NOT NULL` (ou OS em estado `REJEITADA`).

### 4. Caso de uso (orquestração) — `acionarGarantia` (INTEGRATION/UNIT com fakes)

Teste primeiro: validações + os 3 testes de aceite da issue:
- OS fora do prazo **bloqueia portal** (`canal=PORTAL` → lança `ForaDoPrazoError`)
- OS com complementar rejeitado **seta flag** no chamado
- regarantia dentro do prazo original **passa**
- descrição < 20 chars → erro; sem foto → erro
- admin (`canal=WHATSAPP`) fora do prazo → registra com `acionamentoInvalido=true` (não bloqueia)

Impl: `src/operacao/garantia/acionar-garantia.ts`
```ts
export class ForaDoPrazoError extends Error {}
export async function acionarGarantia(
  input: { osId; descricao; fotoDataUrl; criadoPor; canal: "PORTAL"|"WHATSAPP" },
  deps: { repo: GarantiaRepo; upload: { enviarFoto(...) }; agora?: Date },
): Promise<{ chamadoId: string }>
```
Fluxo: valida desc≥20 + foto → `carregarAncora` → `avaliarAcionamentoGarantia` → se `!dentroDoPrazo`: PORTAL lança `ForaDoPrazoError`, WHATSAPP segue com `acionamentoInvalido=true` → upload foto R2 → `criarChamado`.

### 5. Server actions

- `src/app/portal/os/[id]/actions.ts` → `acionarGarantiaPortalAction(osId, descricao, fotoDataUrl)`: `exigirPortal()` (criadoPor = email Google), `canal: "PORTAL"`, `revalidatePath("/portal/...")`, retorna `{erro?}` (mensagem amigável p/ `ForaDoPrazoError`).
- `src/app/admin/garantias/actions.ts` → `registrarAcionamentoGarantiaAction(...)`: `requireModulo("GARANTIAS", ...)` (criadoPor = email do membro), `canal: "WHATSAPP"`.

### 6. UI (segue fluxo Builder → UX → Frontend → Refactor da CLAUDE.md §2)

**Portal** (`src/app/portal/solicitacao/[id]/page.tsx`):
- Por OS, calcular elegibilidade: OS paga/concluída com garantia + dentro do prazo (server-side, via repo). Passar flag pro card.
- Componente novo (feature) `AcionarGarantiaDialog`: `Dialog` + `Textarea` (descrição, contador 20) + upload de foto (input file → data URL) + submit chamando a action.
- Botão "Acionar Garantia" (`variant outline/secondary` — não competir com CTA "Pagar Serviços", §7) quando dentro do prazo.
- Botão "Acionar via WhatsApp" (`buttonVariants`, link `wa.me`) com mensagem pré-preenchida contendo o id da OS — fallback sem Google / sempre disponível conforme fluxo.

**Admin** (`src/app/admin/garantias/registrar/page.tsx` + `guard.ts` com `requireModulo("GARANTIAS")`):
- Form: OS id (do texto wa.me) + WhatsApp do cliente + descrição + foto. Reusa Dialog/Form shadcn. (Listagem/decisão de chamados = slice #6, fora do escopo.)

### 7. Pós-implementação (CLAUDE.md §3.1 + §13)
- `pnpm lint && pnpm typecheck && pnpm test`
- `npx fallow dead-code | dupes | health`
- Validação visual Playwright/chrome-devtools MCP nas 4 resoluções (390/768/1366/1920) com dev bypass (`DEV_BYPASS_EMAIL` no `.env.local`), exercitando o fluxo real (abrir dialog, submeter, conferir linha no DB + objeto no R2), limpando seed ao final.

---

## Arquivos

**Novos**
- `src/operacao/garantia/avaliar-acionamento.ts` (puro)
- `src/operacao/garantia/garantia-repo.ts` (interfaces)
- `src/operacao/garantia/garantia-repo-drizzle.ts`
- `src/operacao/garantia/acionar-garantia.ts` (use-case)
- `src/app/admin/garantias/registrar/page.tsx` + `guard.ts` + `actions.ts`
- `src/components/.../acionar-garantia-dialog.tsx` (feature/shared)
- Testes: `tests/unit/garantia-avaliar-acionamento.test.ts`, `tests/integration/garantia-acionamento.test.ts`
- Migração: `drizzle/00XX_*.sql` (via `db:generate`)

**Modificados**
- `src/db/schema.ts` (tabela + enums)
- `src/app/portal/solicitacao/[id]/page.tsx` (botões + elegibilidade)
- `src/app/portal/os/[id]/actions.ts` (action portal)

## Verificação (mapeia aos acceptance criteria de #49)
1. `pnpm test` — unit (prazo dentro/fora, regarantia não reseta) + integration (flag complementar rejeitado, bloqueio portal, regarantia passa, criação `status=pendente` sem efeito na OS).
2. MCP browser: portal logado → OS dentro do prazo mostra botão → dialog valida desc≥20 + foto → submit cria chamado (conferir linha no DB + objeto R2); OS fora do prazo → sem botão / mensagem "fora do prazo".
3. MCP browser: `/admin/garantias/registrar` como membro GARANTIAS → registra acionamento wa.me; fora do prazo grava `acionamento_invalido=true`.
4. Confirmar que nenhuma OS muda de estado (sem efeito automático).
