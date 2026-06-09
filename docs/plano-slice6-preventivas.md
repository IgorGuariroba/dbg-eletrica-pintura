# Plano de Implementação — Fase 5 / Slice 6 (#60)

Geração automática OS Preventiva + relatório PDF + OS Complementar.
Metodologia: TDD vertical (tracer bullets, um teste → uma implementação).

## 1. Estado atual (reuso — Regra de Ouro)

| Peça | Já existe? | Onde |
|------|-----------|------|
| Tipo `PREVENTIVA` + estado machine sem `PAGA` | ✅ | `src/operacao/maquina-estado.ts` (`bloqueiaPagamento`) |
| Caminho AGENDADA→A_CAMINHO→NO_LOCAL→EM_EXECUCAO→CONCLUIDA | ✅ | `TRANSICOES` (genérico p/ todo tipo) |
| `planejarDocumentos` (PREVENTIVA nunca gera certificado) | ✅ | `src/documentos/planejar-documentos.ts` |
| Cancelamento de preventivas futuras | ✅ | `src/assinatura/cancelar-preventivas-futuras.ts` + `preventiva-repo-drizzle.ts` |
| Geração de PREVENTIVA (cron) | ❌ | **construir** |
| Checklist preventivo (template + resultado) | ✅ | `osChecklistResultado`, `checklist-conclusao.ts`, `catalogo/checklist-*` |
| `avaliarConclusao` (foto obrigatória em PROBLEMA) | ✅ | `src/operacao/checklist-conclusao.ts` |
| Geração PDF + email Resend por transição | ✅ | `src/documentos/gerar-documentos-os.ts` ← `notificacao/dispatcher.ts` |
| PDF base (react-pdf, salvar R2) | ✅ | `src/documentos/pdf/` (#47) |
| OS Complementar (técnico em campo) | ✅ | `src/operacao/complementar.ts` (#27) |
| Relatório PDF preventiva | ❌ | **construir** |
| Botão "Criar Complementar" no PWA | ❌ | **construir (UI; lógica já existe)** |
| Infra de cron (vercel.json + CRON_SECRET) | ❌ | **construir** |

## 2. Decisões documentadas (delegadas ao agente por #60)

- **Atribuição:** admin agenda manual. Cron cria OS em `AGENDADA`, `tecnicoId=null`,
  `agendadoPara = data devida`. Sem acoplar fila/disponibilidade. (Unique index
  `tecnico+agendadoPara` não conflita com `tecnicoId` null.)
- **Categoria:** uma OS PREVENTIVA por categoria coberta pelo plano (checklist #59 é
  por categoria; técnico tem especialidade).

## 3. Lacuna de modelagem (Slice 0)

`plano` não declara categorias cobertas. Adicionar coluna
`categoriasPreventiva jsonb` (`categoria_servico[]`), default `['ELETRICA','PINTURA']`.
Migração Drizzle + expor no form admin de plano.

## 4. Portas novas (interfaces — testáveis, deep modules)

```ts
// src/assinatura/preventiva-geracao.ts  (domínio puro + caso de uso)
interface AssinaturaDevida {
  assinaturaId: string;
  clienteId: string;
  inicio: Date;
  preventivasPorAno: number;
  categorias: Categoria[];
  ultimaPreventivaEm: Date | null; // por categoria, ver repo
}

interface PreventivaGeracaoRepo {
  listarAtivasComPlano(): Promise<AssinaturaDevida[]>;
  ultimaPreventivaPorCategoria(assinaturaId): Promise<Map<Categoria, Date>>;
  existeAbertaNoCiclo(assinaturaId, categoria, desde: Date): Promise<boolean>; // idempotência
  criarOsPreventiva(dados): Promise<{ osId: string }>; // solicitacao snapshot + ordemServico, atômico (db.batch)
}
```

Domínio puro:
```ts
cadenciaMeses(preventivasPorAno): number          // 4 → 3, 2 → 6, 0 → ∞
proximaPreventivaDevida(inicio, ultima, cadencia, hoje): Date | null
```

## 5. Slices TDD (RED → GREEN, um de cada vez)

> Cada slice: escreve UM teste que falha → código mínimo p/ passar. Nunca refatora em RED.

### S0 — coluna `categoriasPreventiva` no plano
- RED: teste repo plano lê/grava `categorias`. GREEN: migração + map drizzle + validação zod.

### S1 — cadência (puro) — **tracer bullet**
- RED `tests/unit/preventiva-cadencia.test.ts`: `cadenciaMeses(4) === 3`; Premium 4/ano,
  última há 3 meses → `proximaPreventivaDevida` retorna hoje (devida). GREEN: funções puras.
- Cobre AC: "Premium (4/ano) gera próxima ~3 meses após última".

### S2 — idempotência (puro/guard)
- RED: assinatura com PREVENTIVA já aberta no ciclo atual → não devida. GREEN: guard via
  `existeAbertaNoCiclo`. Cobre AC: "cron 2x no mesmo dia não duplica".

### S3 — caso de uso geração (integração, `skipIf(!DATABASE_URL)`)
- RED `tests/integration/preventiva-geracao.test.ts`: seed cliente+plano(4/ano,
  [ELETRICA,PINTURA])+assinatura ATIVA com última há 3m → `gerarPreventivasDevidas(repo, hoje)`
  cria **2** OS (ELETRICA+PINTURA), tipo PREVENTIVA, estado AGENDADA, `tecnicoId=null`,
  `assinaturaId` setado, sem orçamento. Rodar 2x → continua 2.
- GREEN: `criarPreventivaGeracaoRepoDrizzle` + caso de uso. Insert solicitacao(snapshot
  endereço cliente) + ordemServico atômico (`db.batch`).
- Cobre AC: gera por data devida; tipo/estado/sem custo; idempotência.

### S4 — máquina de estado (regressão)
- RED `tests/unit/maquina-preventiva.test.ts`: PREVENTIVA percorre AGENDADA→…→CONCLUIDA;
  CONCLUIDA→PAGA lança `TransicaoInvalidaError`. (Confirma comportamento já existente —
  guardrail.) GREEN: nenhum código (já passa) ou ajuste mínimo.
- Cobre AC: "caminho respeitado (sem PAGA)", "não gera certificado garantia"
  (`planejarDocumentos` já testado).

### S5 — rota cron protegida
- RED `tests/integration/cron-preventivas-route.test.ts`: GET sem `Authorization: Bearer
  $CRON_SECRET` → 401; com secret → 200 + invoca geração. GREEN:
  `src/app/api/cron/preventivas/route.ts` + `vercel.json` (`crons: [{path, schedule:"0 6 * * *"}]`)
  + `CRON_SECRET` no `.env.example`.
- Cobre AC: "cron diário gera OS".

### S6 — planejamento do relatório (puro)
- RED: estender `planejarDocumentos` → `{ fatura, certificado, relatorio }`. PREVENTIVA +
  CONCLUIDA → `relatorio:true`. GREEN: adiciona flag. (Ajustar `documentos-planejar.test.ts`.)

### S7 — dados + PDF do relatório (puro/componente)
- RED `tests/unit/relatorio-preventiva-pdf.test.tsx`: `montarDadosRelatorio(osId)` lista itens
  do `osChecklistResultado` (status, observação, fotoUrl) + observações gerais; render react-pdf
  não quebra. GREEN: `src/documentos/relatorio-preventiva.tsx` + `dados-relatorio.ts` +
  `chaveRelatorio` em `chaves.ts`.

### S8 — geração + email do relatório (integração)
- RED: estender `gerar-documentos-os.ts`; transição PREVENTIVA→CONCLUIDA gera relatório no R2 +
  email Resend ao cliente (mock). Cliente sem email → skip, PDF persiste. GREEN: wire no
  `gerarDocumentosOs` (reusa dispatcher existente — já chamado por transição).
- Cobre AC: "concluir gera relatório PDF", "enviado por email".

### S9 — portal cliente mostra relatórios
- RED `tests/integration/portal-relatorio-preventiva.test.ts`: `historico.ts` expõe link do
  relatório p/ OS PREVENTIVA concluída. GREEN: estende `portal/historico.ts` (já usa
  `planejarDocumentos`) + UI no portal (shadcn, tokens semânticos — §UI AGENTS.md).
- Cobre AC: "portal mostra relatórios". UI segue fluxo Builder→Review→Refactor (§2 AGENTS.md).

### S10 — botão "Criar Complementar" no PWA
- RED `tests/unit/checklist-tem-problema.test.ts`: `temItensProblema(respostas)` → true se
  algum status PROBLEMA. GREEN: helper puro + UI no PWA campo (concluir checklist com PROBLEMA
  → CTA "Criar Orçamento Complementar?" → `criarComplementar` existente).
- Cobre AC: "botão aparece se há itens PROBLEMA", "Complementar é paga e tem garantia"
  (lógica #27 já garante).

## 6. Mapa AC → Slice

| AC | Slice |
|----|-------|
| Cron diário gera PREVENTIVA por data devida | S3, S5 |
| Tipo PREVENTIVA, AGENDADA, sem custo | S3 |
| Caminho da máquina sem PAGA | S4 |
| Concluir gera relatório PDF (react-pdf #47) | S6, S7, S8 |
| Relatório (checklist+fotos+obs) por email | S8 |
| Portal mostra relatórios | S9 |
| Botão Complementar se há PROBLEMA | S10 |
| Idempotência cron 2x | S2, S3 |
| Premium 4/ano → próxima ~3m | S1 |
| PREVENTIVA não gera certificado | S4 |
| Complementar da PREVENTIVA é paga c/ garantia | S10 |

## 7. Refactor (após verde)

- `npx fallow dupes` antes/depois (geração de OS pode duplicar com complementar/solicitacao-repo).
- Deepen: esconder snapshot de solicitacao atrás de helper único reusado por complementar+preventiva.

## 8. Validação final (workflow §13 AGENTS.md)

```
pnpm lint && pnpm typecheck && pnpm test
npx fallow dead-code && npx fallow dupes && npx fallow health
pnpm build
```
UI (S9, S10): validação visual Playwright MCP nas 4 resoluções + dev bypass (§2.5).
Branch `feat/slice6-preventivas` → PR → checks + Gemini review.
