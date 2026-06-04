# Plano — Issue #50: Admin Garantias — decisão + OS Garantia + GARANTIA_ABERTA (Fase 4 / Slice 6)

## Context

A Fase 4 já entregou toda a base de garantia: acionamento pelo cliente (#49), certificado PDF (#48), infra PDF (#47), dispatcher de notificação (#46), WhatsApp Cloud API (#45).

Hoje o cliente abre um **chamado de garantia** (`garantia_chamado`, `status=pendente`) pelo portal ou via wa.me (atendimento humano registra em `/admin/garantias/registrar`). O chamado é criado com validação automática de prazo e flag de complementar rejeitado — mas **não tem efeito nenhum na OS**. Falta a **decisão do admin**.

Esta slice fecha o ciclo: tela `/admin/garantias` lista os chamados pendentes para o **Membro Interno** com módulo **Garantias**, que decide caso a caso:

- **Aplicar garantia** → cria **OS Garantia** (tipo `GARANTIA`, estado `AGENDADA`, sem custo) vinculada à OS original; a OS original transita para `GARANTIA_ABERTA` (terminal); notifica o cliente.
- **Rejeitar** → `status=rejeitada` + motivo obrigatório.
- **Override prazo** → aplicar mesmo fora do prazo, com justificativa obrigatória.

A OS Garantia depois segue o fluxo normal de campo (`AGENDADA → A_CAMINHO → NO_LOCAL → EM_EXECUÇÃO → CONCLUÍDA`) e, ao concluir, gera o **certificado de regarantia** preservando a data-fim da âncora — isso **já está implementado** (`planejarDocumentos` trata `CONCLUIDA + GARANTIA`).

Bloqueado por #49 — **já mergeado** (commit `a7c277d`).

### Regras de domínio aplicáveis (CONTEXT.md)

- **OS Garantia**: gerada quando admin aplica garantia válida. Vinculada à OS original paga (âncora de prazo). Sem custo. Prazo conta da OS original — **não reseta em regarantia**. Atribuição: **Técnico** original primeiro (se ativo + disponível); senão cai na fila filtrada por especialidade (`AGENDADA` sem técnico). Admin pode override de prazo caso a caso. OS original (ou OS Garantia anterior) transita para `GARANTIA_ABERTA` (terminal).
- **GARANTIA_ABERTA**: estado terminal. Transições de entrada: `PAGA → GARANTIA_ABERTA` (OS com custo: NORMAL/EXPRESS/COMPLEMENTAR) e `CONCLUIDA → GARANTIA_ABERTA` (regarantia de OS GARANTIA anterior). PREVENTIVA nunca abre garantia.
- **Correspondência complementar-rejeitado**: julgamento humano. O sistema só **sinaliza** (flag `temComplementarRejeitado` já gravada no chamado); a decisão é do admin.
- **Garantia de Mão de Obra**: não se aplica a OS Preventiva (inspeção). Aplica a NORMAL/EXPRESS/COMPLEMENTAR/GARANTIA.

## Método: TDD (red → green → refactor)

Cada etapa é um ciclo vertical (tracer bullet): **um teste que falha → implementação mínima → próximo teste**. Nunca escrever a bateria de testes toda antes da implementação (anti-pattern de fatia horizontal). Núcleo de domínio é puro (unit, rápido); I/O via repos Drizzle (integration, `describe.skipIf(!hasDb)`); server action e UI validadas na §"Validação Visual".

Vocabulário dos testes segue o glossário do CONTEXT.md: **Chamado**, **OS Garantia**, **âncora**, **regarantia**, `GARANTIA_ABERTA`, **Técnico original**, **Override de prazo**.

---

## Reuso (Regra de Ouro) — já existe, NÃO recriar

| Necessidade | Reusar |
| --- | --- |
| Resolver âncora (GARANTIA → `osPaiId` até a raiz paga) + flag complementar rejeitado | `GarantiaRepo.carregarAncora` / `temComplementarRejeitado` — `src/operacao/garantia/garantia-repo-drizzle.ts` |
| Avaliar prazo (dentro/fora, data fim) | `avaliarAcionamentoGarantia` — `src/operacao/garantia/avaliar-acionamento.ts` |
| Janela de regarantia (preserva âncora, não reseta) | `resolverJanelaGarantia` / `JanelaOriginal` — `src/documentos/janela-garantia.ts` |
| Máquina de estado (transição pura + persistência) | `transicionar` / `aplicarTransicao` — `src/operacao/maquina-estado.ts` |
| Certificado de regarantia ao CONCLUIR (já planejado) | `planejarDocumentos` (`CONCLUIDA + GARANTIA → certificado`) — `src/documentos/planejar-documentos.ts` (NÃO mexer) |
| Padrão de criar OS filha vinculada + atribuição atômica | `criarComplementar` / `ComplementarRepo.criarComplementarComOrcamento` — `src/operacao/complementar.ts` |
| Disparo de template WhatsApp (horário restrito + fila) | `enviarTemplate` — `src/notificacao/enviar-template.ts`; catálogo `src/notificacao/templates.ts` |
| Notificação por e-mail de transição | `notificarMudancaEstadoOs` / dispatcher — `src/notificacao/dispatcher.ts` |
| Guard de módulo admin (403) | `exigirGarantias()` — `src/app/admin/garantias/guard.ts` (`requireModulo("GARANTIAS", …)`) |
| Server action (try/catch + `revalidatePath` + `{erro?}`) | `registrarAcionamentoGarantiaAction` — `src/app/admin/garantias/actions.ts` |
| Especialidade/disponibilidade/ativo do técnico | `MembroRepo` (`especialidades`, `disponibilidade`, `ativo`) — `src/equipe/membro-repo.ts` |
| UI: Card, Dialog, Button, Textarea, Badge, Input, Select | `src/components/ui/*` (shadcn) |
| `tipo_os` tem `GARANTIA`; `modulo` tem `GARANTIAS`; `estado_os` tem `GARANTIA_ABERTA` | `src/db/schema.ts` (enums já existem) |

> **Já feito por #49, não duplicar:** tabela `garantia_chamado`, criação do chamado, validação de prazo no acionamento, detecção de complementar rejeitado, tela `/admin/garantias/registrar`, guard `exigirGarantias`.

---

## Mudanças de schema — `src/db/schema.ts`

A tabela `garantia_chamado` ganha o ciclo de decisão. O enum de status ganha os estados terminais e a tabela ganha colunas de resolução.

```ts
export const statusGarantiaChamadoEnum = pgEnum("status_garantia_chamado", [
  "pendente",
  "aplicada",   // admin gerou OS Garantia
  "rejeitada",  // admin recusou com motivo
]);

// novas colunas em garantiaChamado:
  osGarantiaId: uuid("os_garantia_id").references((): AnyPgColumn => ordemServico.id, {
    onDelete: "set null",
  }), // OS GARANTIA criada (preenchida ao aplicar)
  motivoRejeicao: text("motivo_rejeicao"),
  overridePrazo: boolean("override_prazo").notNull().default(false),
  justificativaOverride: text("justificativa_override"),
  decididoPor: varchar("decidido_por", { length: 255 }), // email do membro
  decididoEm: timestamp("decidido_em", { withTimezone: true }),
```

Gerar migração: `pnpm db:generate` → novo `drizzle/00XX_*.sql`. Rodar `db:migrate` só na execução (contra `.env.local`), nunca no plano.

> Enum existente em Postgres: adicionar valores a `status_garantia_chamado` exige `ALTER TYPE … ADD VALUE`. Conferir o SQL gerado pelo Drizzle e, se necessário, ajustar à mão (Drizzle às vezes recria o enum).

---

## Etapas (ciclos TDD)

### 1. Tracer bullet — máquina de estado: abertura de garantia (UNIT)

Prova o caminho ponta-a-ponta no núcleo puro mais barato. `src/operacao/maquina-estado.ts`.

**RED** — `tests/unit/operacao-maquina-estado.test.ts` (estender):
- `PAGA → GARANTIA_ABERTA` permitido para OS paga (`NORMAL`).
- `CONCLUIDA → GARANTIA_ABERTA` permitido para `GARANTIA` (regarantia).
- `CONCLUIDA → GARANTIA_ABERTA` **bloqueado** para `NORMAL` (paga termina em PAGA, não abre da CONCLUIDA).
- `PAGA → GARANTIA_ABERTA` **bloqueado** para `PREVENTIVA`/`GARANTIA` (não têm PAGA, e PREVENTIVA não tem garantia).
- `GARANTIA_ABERTA` é terminal: qualquer alvo a partir dele lança `TransicaoInvalidaError`.

**GREEN** — adicionar transição condicional (espelhando `bloqueiaPagamento`/`permiteExecucaoImediata`):
```ts
const TRANSICOES = {
  ...,
  CONCLUIDA: ["PAGA"],            // GARANTIA_ABERTA entra por permiteAberturaGarantia
  PAGA: ["GARANTIA_ABERTA"],     // só p/ tipos pagos (guard abaixo)
};

function permiteAberturaGarantia(ctx, alvo) {
  if (alvo !== "GARANTIA_ABERTA") return false;
  const pagos = ctx.tipo === "NORMAL" || ctx.tipo === "EXPRESS" || ctx.tipo === "COMPLEMENTAR";
  return (ctx.estado === "PAGA" && pagos) || (ctx.estado === "CONCLUIDA" && ctx.tipo === "GARANTIA");
}
```
Incluir `permiteAberturaGarantia` na cláusula `ok` de `transicionar`, e garantir que `PAGA → GARANTIA_ABERTA` para tipo pago não seja barrado por `bloqueiaPagamento` (esse só barra alvo `PAGA`). `GARANTIA_ABERTA` sem entrada em `TRANSICOES` ⇒ terminal automático.

> Critérios cobertos: estado terminal, caminhos `PAGA →` e `CONCLUIDA → GARANTIA_ABERTA`.

---

### 2. Núcleo puro — decisão de aplicar garantia (UNIT)

Novo usecase `aplicarGarantia` em `src/operacao/garantia/aplicar-garantia.ts`. Função pura sobre um repo injetável — sem tocar em UI/DB. Decide atribuição e orquestra criação + transição + notificação via deps.

Interface (deep module: interface pequena, lógica de regra dentro):
```ts
interface AplicarGarantiaInput {
  chamadoId: string;
  decididoPor: string;        // email do membro (Garantias)
  override?: { justificativa: string };  // aplicar fora do prazo
}
interface AplicarGarantiaDeps {
  repo: GarantiaDecisaoRepo;
  notificar?: (osGarantiaId: string) => Promise<void>; // garantia_acionada (default: real)
  agora?: Date;
}
// retorna { osGarantiaId, tecnicoAtribuido: boolean }
```

`GarantiaDecisaoRepo` (novo, ao lado de `GarantiaRepo`):
```ts
interface ChamadoDecisao {
  id: string;
  status: "pendente" | "aplicada" | "rejeitada";
  osOrigemId: string;          // OS que o cliente referenciou (vira osPaiId da nova)
  ancora: JanelaOriginal & { ancoraId: string; tipo: TipoOs };
  categoria: Categoria;
  tecnicoOriginalId: string | null;
  tecnicoOriginalDisponivel: boolean; // ativo + especialidade compatível
}
interface GarantiaDecisaoRepo {
  carregarChamado(chamadoId: string): Promise<ChamadoDecisao | null>;
  // atômico: cria OS GARANTIA (AGENDADA, osPaiId=osOrigemId, tecnico|null,
  // prazoGarantiaMeses=ancora.prazoMeses, categoria), transita osOrigem
  // PAGA/CONCLUIDA → GARANTIA_ABERTA, marca chamado aplicada + osGarantiaId.
  aplicar(dados: {
    chamadoId: string; osOrigemId: string; categoria: Categoria;
    prazoMeses: number; tecnicoId: string | null;
    decididoPor: string; override: { justificativa: string } | null;
  }): Promise<{ osGarantiaId: string }>;
  rejeitar(chamadoId: string, motivo: string, decididoPor: string): Promise<void>;
}
```

**Ciclos RED→GREEN** (um teste por vez), `tests/unit/garantia-aplicar.test.ts`:

1. Chamado inexistente → erro (`ChamadoInexistenteError`).
2. Chamado não-`pendente` → erro (`ChamadoJaDecididoError`) — idempotência.
3. Dentro do prazo + técnico original disponível → `repo.aplicar` chamado com `tecnicoId = original`; retorna `tecnicoAtribuido: true`.
4. Dentro do prazo + técnico original indisponível (inativo ou sem especialidade) → `tecnicoId = null`; `tecnicoAtribuido: false` (cai na fila por especialidade).
5. Fora do prazo **sem** override → lança `ForaDoPrazoError` (reusar de `acionar-garantia.ts`), nada criado.
6. Fora do prazo **com** override sem justificativa (`""`/whitespace) → `JustificativaObrigatoriaError`.
7. Fora do prazo **com** override + justificativa → `repo.aplicar` com `override` preenchido.
8. Após `repo.aplicar` → `deps.notificar(osGarantiaId)` é chamado (notificação cliente).

Avaliação de prazo reusa `avaliarAcionamentoGarantia({ agora, ancora, temComplementarRejeitado })`.

> Critérios cobertos: aplicar cria OS + atribuição condicional ao técnico original; override exige justificativa; notificação disparada.

---

### 3. Núcleo puro — rejeição (UNIT)

Mesmo arquivo de usecase, `rejeitarGarantia(input, deps)`.

**RED→GREEN** (`tests/unit/garantia-aplicar.test.ts`):
1. Motivo vazio/whitespace → `MotivoObrigatorioError`, `repo.rejeitar` não chamado.
2. Motivo válido + chamado pendente → `repo.rejeitar(chamadoId, motivo, decididoPor)`.
3. Chamado já decidido → `ChamadoJaDecididoError`.

> Critério coberto: rejeitar exige motivo, `status=rejeitada`.

---

### 4. Repo Drizzle — `GarantiaDecisaoRepo` (INTEGRATION)

`src/operacao/garantia/garantia-decisao-repo-drizzle.ts`. Testes `tests/integration/garantia-decisao-repo.test.ts` (`describe.skipIf(!hasDb)`), seguindo o seed de `garantia-acionamento-action.test.ts` (cliente → solicitação → OS → pagamento approved → chamado). Limpeza total no `afterEach`/`afterAll`.

**Ciclos RED→GREEN:**

1. **`carregarChamado`**: dado um chamado pendente sobre OS paga, resolve âncora (prazo, pagamentoEm), categoria, técnico original. Reusa a lógica de `carregarAncora` (walk de `osPaiId` até a raiz paga). `tecnicoOriginalDisponivel` = técnico `ativo` **e** especialidade ⊇ categoria.
2. **`aplicar` (caminho feliz, atômico)**: cria OS `tipo=GARANTIA`, `estado=AGENDADA`, `osPaiId=osOrigemId`, `prazoGarantiaMeses` = prazo da âncora, `categoria` herdada, `tecnicoId` = passado. OS original (`PAGA`) → `GARANTIA_ABERTA` (gravar histórico de transição via `transicao_repo`/padrão existente). Chamado → `aplicada` + `osGarantiaId` + `decididoPor`/`decididoEm`.
3. **`aplicar` em regarantia**: `osOrigemId` é uma OS `GARANTIA` em `CONCLUIDA` → transita `CONCLUIDA → GARANTIA_ABERTA`; nova OS GARANTIA aponta `osPaiId` para essa; âncora de prazo continua a raiz paga (prazo não reseta).
4. **`aplicar` com override**: grava `overridePrazo=true` + `justificativaOverride`.
5. **`rejeitar`**: chamado → `rejeitada` + `motivoRejeicao` + `decididoPor`/`decididoEm`; nenhuma OS criada, OS original intacta.
6. **Atomicidade**: forçar falha na transição (ex.: OS origem em estado inválido) ⇒ rollback, nenhuma OS GARANTIA órfã, chamado continua `pendente`.

> Critérios cobertos: OS GARANTIA `AGENDADA` + original `GARANTIA_ABERTA`; regarantia dentro do prazo; atribuição persistida.

---

### 5. Notificação — template `garantia_acionada` (UNIT + wiring)

A OS Garantia nasce em `AGENDADA` — nenhuma transição de estado dispara o aviso pelo `MAPA_EVENTOS`. Logo o `garantia_acionada` é disparado **diretamente** pelo usecase (não pelo dispatcher por-estado), reusando `enviarTemplate` (WhatsApp) + e-mail.

1. **RED** — `tests/unit/notificacao-templates.test.ts`: catálogo contém `garantia_acionada` com `ordemVariaveis` casando o corpo aprovado na Meta. **GREEN**: adicionar a `TEMPLATES_NOTIFICACAO` em `src/notificacao/templates.ts`:
   ```ts
   { nome: "garantia_acionada", rotulo: "Garantia Acionada",
     variaveisPadrao: { saudacao: "Olá", assinatura: "Equipe DBG Elétrica e Pintura" },
     ordemVariaveis: ["saudacao", "nome_cliente", "link", "assinatura"] }
   ```
2. **Notificador** `src/operacao/garantia/notificar-garantia-acionada.ts`: carrega cliente da OS Garantia (via solicitação), monta variáveis (`nome_cliente`, `link` = portal `/s/{token}`), chama `enviarTemplate`; e-mail opcional reusando o notificador. Cliente sem WhatsApp/e-mail válido → pula canal e loga (padrão do dispatcher, sem lançar). Esta é a função default de `deps.notificar` da §2.

> Critério coberto: notificação cliente via WhatsApp + e-mail.

---

### 6. Server actions — `aplicarGarantiaAction` / `rejeitarGarantiaAction` (INTEGRATION)

`src/app/admin/garantias/actions.ts` (estender). Padrão de #49: `"use server"`, `exigirGarantias()` no topo (403 via `ForbiddenError`), try/catch → `{ erro?: string }`, `revalidatePath("/admin/garantias")`.

```ts
export async function aplicarGarantiaAction(
  chamadoId: string, override?: { justificativa: string }
): Promise<{ osGarantiaId?: string; erro?: string }>;

export async function rejeitarGarantiaAction(
  chamadoId: string, motivo: string
): Promise<{ ok?: true; erro?: string }>;
```

**RED→GREEN** — `tests/integration/garantia-decisao-action.test.ts` (mock de `guard`, `enviar-template`/notificar, `next/cache`, como no teste de #49):
1. Membro **sem** módulo Garantias → `ForbiddenError` (403). (guard mockado para negar.)
2. `aplicarGarantiaAction` caminho feliz → retorna `osGarantiaId`; OS original `GARANTIA_ABERTA`; chamado `aplicada`.
3. `aplicarGarantiaAction` fora do prazo sem override → `{ erro }`, nada muda.
4. `rejeitarGarantiaAction` sem motivo → `{ erro }`.

> Critério coberto: 403 para membro sem módulo; ações expostas à UI.

---

### 7. UI — `/admin/garantias` lista + diálogos de decisão

Tela **nova** (raiz do módulo; hoje só existe `/admin/garantias/registrar`). Segue o fluxo obrigatório de UI do AGENTS.md (Builder → UX → Frontend → Refactor) e a §2.5 (validação Playwright/Chrome DevTools MCP).

**Arquivos:**
- `src/app/admin/garantias/page.tsx` (server): `exigirGarantias()` → 403; carrega chamados pendentes via repo; passa ao client.
- `src/app/admin/garantias/client-page.tsx` (client): lista + filtros + diálogos.
- Componentes de negócio em `src/features/garantias/components/` (novo domínio, conforme §11 — não jogar lógica em `app/`).

**Classificação de densidade (§10):** tela tipo **Detalhes/Lista de decisão**. Mobile nível 3 (cards empilhados), desktop nível 4. Como cada chamado tem foto + descrição + metadados, usar **Lista de Cards** (não tabela) em todas as larguras — densidade > 4 campos por linha.

**Cada card (Chamado):** cliente, OS original (tipo + categoria), descrição, foto (thumb), técnico original, **prazo restante** (ou "fora do prazo" em destaque), badge "Complementar rejeitado" quando `temComplementarRejeitado`. Ações: **Aplicar** (CTA primário único por card), **Rejeitar** (`variant="outline"`/ghost — ação não-destrutiva mas secundária), e quando fora do prazo, **Aplicar mesmo assim** abre diálogo de override.

**Filtros:** busca (cliente) + toggle "Só fora do prazo" + toggle "Com complementar rejeitado". Reusar `SearchBar`/padrão shared se existir.

**Diálogos (shadcn `Dialog`):**
- *Aplicar*: confirma, mostra atribuição prevista (técnico original ou "vai p/ fila"). Submete `aplicarGarantiaAction`.
- *Rejeitar*: `Textarea` motivo obrigatório → `rejeitarGarantiaAction`.
- *Override*: `Textarea` justificativa obrigatória → `aplicarGarantiaAction(id, { justificativa })`.

**Regras de design (§4–§9):** só componentes `src/components/ui/*` (sem HTML cru), cores só por tokens semânticos, sem inline style estético, escala de espaçamento 4px, 1 CTA primário por card, info secundária em `text-muted-foreground`.

**Repo de leitura** `listarChamadosPendentes()` no `garantia-decisao-repo-drizzle.ts`: join chamado → OS origem → solicitação → cliente, + técnico original, + cálculo de prazo restante (reusa `avaliarAcionamentoGarantia`). Filtros aplicados no client (volume baixo) ou no repo (preferir repo se crescer).

---

## Validação Visual Obrigatória (§2.5)

Rotas admin exigem sessão — usar **dev bypass** (`@/auth/dev-bypass`, `DEV_BYPASS_EMAIL` = e-mail admin no `.env.local`, nunca versionado).

1. `pnpm dev` em background; aguardar `200`.
2. Semear: cliente → solicitação → OS paga (com `prazoGarantiaMeses`) → pagamento approved → `garantia_chamado` pendente (um dentro do prazo, um fora, um com complementar rejeitado).
3. Abrir `/admin/garantias` nas 4 resoluções (`390`, `768`, `1366`, `1920`): confirmar `scrollWidth === clientWidth`, foto carrega (HTTP 200), cards legíveis.
4. **Fluxos reais** (não só layout):
   - Aplicar → confirmar no banco: OS GARANTIA `AGENDADA` criada, OS original `GARANTIA_ABERTA`, chamado `aplicada`, notificação logada.
   - Rejeitar com motivo → chamado `rejeitada`.
   - Override fora do prazo → aplica; sem justificativa → bloqueia.
   - Membro sem módulo Garantias → 403.
5. Screenshots anexados em `docs/pr-evidence/`. Remover seed (linhas + objetos R2 + `DEV_BYPASS_EMAIL`) e encerrar `pnpm dev` ao final — working tree limpo.

---

## Mapa de Acceptance Criteria → Etapas

| Critério (#50) | Etapa |
| --- | --- |
| `/admin/garantias` lista chamados pendentes com filtros | 7 |
| Membro sem módulo Garantias → 403 | 6, 7 |
| Botão "Aplicar" cria OS GARANTIA vinculada + original → `GARANTIA_ABERTA` | 1, 2, 4 |
| OS GARANTIA atribuída ao técnico original se ativo; senão `AGENDADA` sem técnico | 2, 4 |
| Notificação cliente via WhatsApp + e-mail | 5 |
| Rejeitar exige motivo, `status=rejeitada` | 3, 4, 6 |
| Override prazo permite aplicar fora do prazo com justificativa obrigatória | 2, 4 |
| `GARANTIA_ABERTA` é terminal | 1 |
| Teste: aplicar → OS GARANTIA `AGENDADA` + original `GARANTIA_ABERTA` | 4 |
| Teste: regarantia (`CONCLUIDA → GARANTIA_ABERTA`) dentro do prazo | 1, 4 |
| Teste: override aplica fora do prazo; sem override bloqueia | 2, 6 |

---

## Checklist final (§3, §3.1, §13)

- [ ] `pnpm lint && pnpm typecheck && pnpm test` verdes
- [ ] `pnpm build` ok
- [ ] `pnpm test:e2e` (se houver fluxo coberto)
- [ ] Validação visual MCP nas 4 resoluções + fluxos reais (screenshots em `docs/pr-evidence/`)
- [ ] Fallow pós-implementação: `dead-code`, `dupes`, `health`, `fix --dry-run` — tratar findings reais
- [ ] Migração `db:generate` revisada (atenção ao `ALTER TYPE` do enum)
- [ ] ADR? Não necessário — decisões já cobertas por `0007-fases-de-build.md` e CONTEXT.md. Avaliar registrar a regra de transição `GARANTIA_ABERTA` se surgir ambiguidade.
- [ ] Branch `feat/admin-garantias`; PR para `main` com `Closes #50` (keyword em inglês — ver memória)

## Ordem de execução sugerida

1 (máquina) → 2 (aplicar core) → 3 (rejeitar core) → 5 (template/notificador) → 4 (repo Drizzle) → 6 (server actions) → 7 (UI) → validação visual → fallow → PR.

Núcleo puro primeiro (feedback em ms), I/O depois, UI por último — cada camada já testada quando a de cima a consome.
