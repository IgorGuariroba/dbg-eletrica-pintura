# Plano de Implementação — Issue #39

**Fase 3 / Slice 6 — Portal cliente logado (histórico + documentos)**
Metodologia: TDD (red→green→refactor, fatias verticais). Pai #7. Bloqueado por #38 (mergeado — vínculo Google↔WhatsApp). Base do checkout consolidado (#42) e dashboards posteriores.

---

## Objetivo

`/portal` autenticado (sessão `role=cliente` com `whatsapp` vinculado, do #38). Cliente logado vê o **histórico completo** de tudo que é dele:

1. Lista de **todas as suas Solicitações**, mais recentes primeiro, paginada (20/página).
2. Cada Solicitação **expansível** → OS filhas com estado atual (rótulo do cliente), técnico (link perfil público), data agendada, valor.
3. Por OS: fotos antes/depois (URL assinada R2), tabela de orçamento (já existe), e **placeholders inativos** para fatura (Fase 3 #40), certificado de garantia (Fase 4 #48), "Acionar garantia" (Fase 4 #49) e link de indicação (Fase 5 #63) — visíveis com tooltip "em breve".
4. **Isolamento**: cliente só vê o que é dele — nem na lista, nem por URL direta de uma Solicitação de outro.
5. Membro (técnico OU com módulos) acessando `/portal` → redirect `/painel`.

> Referência de jornada: `fluxo-casos-uso.html` passo **14 — Portal — Histórico e Faturas**: "Fase 3+: área logada (Google OAuth) com histórico completo: lista de todas as solicitações (múltiplas simultâneas permitidas) com status individual, OS, fotos antes/depois, faturas (Fase 4+), certificados de garantia (Fase 4+), garantias ativas, link de indicação." Também passo **4** ("Com Google OAuth — portal completo").

---

## Decisões travadas

| Tema | Decisão |
| --- | --- |
| Sem schema novo | Slice **read-only** sobre tabelas existentes (`cliente`, `solicitacao`, `ordemServico`, `orcamento`, `orcamentoItem`, `servico`, `membro`). Sem migração. |
| Chave de identidade | Cliente identificado por `session.user.whatsapp` (vinculado no #38). Histórico = Solicitações cujo `cliente.whatsapp === whatsapp` da sessão. |
| Isolamento | Toda query do portal **filtra por `whatsapp` da sessão**. Detalhe por id (`/portal/solicitacao/[id]`) usa `carregarSolicitacaoDoCliente(id, whatsapp)` → `null` se não for do dono → `notFound()`. AC "URL direta" coberto no repo, não só na UI. |
| Redirect de membro | Guard do portal: sem sessão → `/login`; `role!=cliente` → `/painel`; cliente sem `whatsapp` → `/portal/vincular`. Lógica de destino extraída pura (`destinoPortal`) p/ teste. |
| Paginação | `limit=20`, `offset=(page-1)*20` via `?page=`. Repo devolve `{ itens, total }` (mesmo padrão de `MembroRepo.listar`). UI: Prev/Next + contagem. |
| Fotos | Antes/depois vivem no R2 por prefixo `os/{id}/{antes\|depois}/` — **não há coluna**. Listadas via `listarFotosOs` + `obterUrlLeituraAssinada` (`r2-privado.ts`). Carregadas **só no detalhe da OS** (não na lista — evita N×R2 na home). Porta injetável p/ testar sem R2. |
| Documentos PDF | Orçamento exibido como **tabela** (reuso do `/s/[token]`), não PDF — geração PDF é Fase 4 (#47/#48). Fatura idem (Fase 3 #40 / PDF Fase 4). Render de link de download **condicional**: aparece só se houver chave armazenada; senão placeholder "em breve". Nada quebra por ausência. |
| Placeholders inativos | "Acionar garantia" e "Link de indicação" = `Button` **disabled** com `Tooltip` "em breve". Sem rota, sem ação. |
| Expansível | Adicionar `accordion` (shadcn) via `npx shadcn add accordion`. Cada Solicitação = `AccordionItem`. |
| Reuso de montagem OS+orçamento | Mesma assembleia do `aprovacao-repo-drizzle.carregarPorToken` (OS → orçamento mais recente → itens → técnico). Espelhar; marcar como candidato a extrair helper compartilhado no refactor. |

---

## Reuso (Regra de Ouro §1)

- `rotularEstadoCliente` — `src/operacao/rotulo-estado.ts` (estados em linguagem de cliente).
- `formatBRL`, `cn` — `src/lib/utils.ts`.
- Assembleia OS+orçamento+técnico — espelhar `src/operacao/aprovacao-repo-drizzle.ts`.
- `obterUrlLeituraAssinada`, `listarFotosOs` — `src/operacao/r2-privado.ts` (URLs assinadas privadas).
- `Badge` + `VARIANTE_ESTADO`, `Avatar`, `buttonVariants`, `LABEL_CATEGORIA` — `src/app/s/[token]/page.tsx` (extrair o que repetir).
- Guard de sessão — `src/auth.ts` `auth()`, padrão de `src/portal/guard.ts` (`exigirCliente`).
- `SiteHeader`/`SiteFooter` — `src/app/_landing/*` (moldura do portal).
- Paginação `{ limit, offset }`→`{ itens, total }` — `src/equipe/membro-repo.ts`.
- UI: `components/ui/{accordion(novo),card,badge,button,avatar,tooltip,separator,skeleton}`.

---

## Arquitetura

```
listarHistoricoCliente(whatsapp, { limit, offset }, repo)   ← lista paginada de Solicitações do dono
carregarSolicitacaoDoCliente(solId, whatsapp, repo)         ← detalhe, null se não for do dono (isolamento)
montarFotosOs(osId, fotosPort)                              ← chaves R2 → URLs assinadas (antes/depois)
destinoPortal(session)                                      ← '/login' | '/painel' | '/portal/vincular' | null (puro)
        ↑
HistoricoRepo (interface)  →  historico-repo-drizzle (queries scoped por whatsapp)
FotosOsPort (interface)    →  wrapper sobre r2-privado (listar + assinar)
```

### Interface (`src/portal/historico-repo.ts`)

```ts
export interface OsHistorico {
  id: string;
  categoria: Categoria;
  estado: EstadoOs;
  agendadoPara: Date | null;
  tecnico: { id: string; nome: string; fotoUrl: string | null; slug: string | null } | null;
  orcamento: { total: string; totalDeslocamento: string; validoAte: Date; itens: ItemView[] } | null;
}
export interface SolicitacaoHistorico {
  id: string;
  protocolo: string;       // token.slice(0,8).toUpperCase()
  criadoEm: Date;
  cidade: string | null;
  uf: string | null;
  ordens: OsHistorico[];
}
export interface PaginaHistorico { itens: SolicitacaoHistorico[]; total: number; }

export interface HistoricoRepo {
  listar(whatsapp: string, p: { limit: number; offset: number }): Promise<PaginaHistorico>;
  carregarSolicitacao(solId: string, whatsapp: string): Promise<SolicitacaoHistorico | null>;
}

export interface FotosOsPort {
  listarChaves(osId: string, tipo: "ANTES" | "DEPOIS"): Promise<string[]>;
  urlLeitura(chave: string): Promise<string>;
}
```

---

## Rotas / UI

- **`/portal/page.tsx`** — Server Component. `const cliente = await exigirPortal()` (aplica `destinoPortal`). `?page` → `listarHistoricoCliente`. Renderiza `Accordion` de Solicitações; cada item mostra OS (estado, técnico, valor, data). Paginação Prev/Next. `EmptyState` se 0.
- **`/portal/solicitacao/[id]/page.tsx`** — detalhe; `carregarSolicitacaoDoCliente(id, whatsapp)` → `notFound()` se `null`. Por OS: fotos antes/depois (URLs assinadas), tabela de orçamento, e seção "Documentos" com placeholders (fatura/certificado/garantia/indicação inativos + tooltip).
- **`src/portal/guard.ts`** — adicionar `exigirPortal()` (redireciona membro→`/painel`); manter `exigirCliente` p/ `/portal/vincular`. `destinoPortal` puro testável.
- Layout do portal (`/portal/layout.tsx`) opcional com `SiteHeader`/`SiteFooter`.

Aderência CLAUDE.md §2–§11: só `components/ui/*`, tokens semânticos, sem HTML cru, densidade de **Tela de Detalhes** (§10.4) — mobile empilhado, desktop 2 colunas; sem scroll horizontal.

---

## Artefatos

```
src/portal/historico-repo.ts                       interface + tipos (OsHistorico, SolicitacaoHistorico, FotosOsPort)
src/portal/historico-repo-drizzle.ts               queries scoped por whatsapp + paginação
src/portal/historico.ts                            listarHistoricoCliente, carregarSolicitacaoDoCliente, montarFotosOs
src/portal/destino.ts                              destinoPortal (puro) + exigirPortal (guard)
src/portal/guard.ts                                + exigirPortal
src/app/portal/page.tsx                            lista paginada (Accordion)
src/app/portal/solicitacao/[id]/page.tsx           detalhe + fotos + documentos/placeholders
src/app/portal/layout.tsx                          (opcional) moldura SiteHeader/Footer
src/components/ui/accordion.tsx                     npx shadcn add accordion
tests/unit/portal-historico.test.ts                montarFotosOs (port fake) + destinoPortal + placeholders
tests/integration/portal-historico.test.ts         listar/isolamento/paginação/detalhe (skipIf !DATABASE_URL)
```

Sem migração (read-only).

---

## Ciclos TDD (1 teste → 1 implementação)

| # | Tipo | Comportamento testado | Implementação mínima |
| --- | --- | --- | --- |
| 1 ⦿ | int | `listar(whatsapp)` → Solicitações do cliente, mais recentes primeiro, com OS filhas (estado, categoria) | esqueleto repo: join cliente→solicitacao→OS, scope whatsapp, order desc |
| 2 | int | cliente A não recebe Solicitação do cliente B na lista (AC isolamento) | filtro `cliente.whatsapp = whatsapp` |
| 3 | int | `carregarSolicitacao(id, whatsapp)`: dono → retorna; outro cliente → `null` (AC URL direta) | guarda de posse no detalhe |
| 4 | int | 25 Solicitações, `limit 20` → itens=20, total=25; `offset 20` → 5 (AC >20) | paginação limit/offset + count |
| 5 | int | OS com técnico → nome/slug/foto; com orçamento → total/itens; estado presente | join membro + orçamento mais recente + itens |
| 6 | unit | `montarFotosOs(osId)`: chaves R2 (antes/depois) → URLs assinadas, via `FotosOsPort` fake | assembleia pura sobre a porta |
| 7 | unit | `destinoPortal`: sem sessão→`/login`; membro→`/painel`; cliente sem whatsapp→`/portal/vincular`; cliente ok→`null` (AC redirect) | mapeamento puro de destino |
| 8 | unit | flags de documento/placeholder: fatura/certificado ausentes → "em breve"; garantia/indicação sempre inativos | mapeamento puro de placeholders |

⦿ = tracer bullet.

---

## Acceptance criteria (mapa)

- [ ] `/portal` requer sessão cliente → `exigirPortal` + ciclo 7
- [ ] Lista Solicitações com OS filhas + estados + dados → ciclos 1, 5
- [ ] Fotos antes/depois com URL assinada R2 → ciclo 6 (UI no detalhe)
- [ ] PDF orçamento/fatura com link de download → orçamento como tabela; link condicional + placeholder → ciclo 8
- [ ] Acionar garantia + link indicação visíveis mas inativos c/ tooltip "em breve" → ciclo 8 (UI)
- [ ] Cliente não vê dados de outros clientes → ciclos 2, 3
- [ ] Paginação se > 20 Solicitações → ciclo 4
- [ ] Membro (técnico OU módulos) → redirect `/painel` → ciclo 7
- [ ] Teste: cliente A não acessa Solicitação de B por URL direta → ciclo 3

---

## Validação visual obrigatória (§2.5 — há UI)

1. `pnpm dev` em background; aguardar `200`.
2. `.env.local`: `DEV_BYPASS_EMAIL` = e-mail de **cliente** com `whatsapp` vinculado e ≥1 Solicitação semeada (com OS, orçamento e, idealmente, fotos no R2). Validar também redirect: setar e-mail de **membro** → `/portal` deve cair em `/painel`.
3. Resoluções 390/768/1366/1920: sem scroll horizontal (`scrollWidth === clientWidth`); fotos carregam (HTTP 200 nas URLs assinadas); só `components/ui/*`; tokens semânticos; sem HTML cru.
4. Fluxos reais: expandir Solicitação (accordion), abrir detalhe, ver fotos antes/depois, confirmar placeholders desabilitados com tooltip, paginar (semear 21+ p/ ver Prev/Next), tentar abrir `/portal/solicitacao/{id}` de outro cliente → 404.
5. Semear mínimo e **limpar tudo** ao final (Solicitações/OS/orçamentos, objetos R2, `DEV_BYPASS_EMAIL`, processo `pnpm dev`).

---

## Fora de escopo

- Geração de PDF (orçamento/fatura/certificado) — Fase 4 (#47/#48).
- Acionamento de garantia funcional — Fase 4 (#49); aqui só placeholder.
- Link de indicação funcional — Fase 5 (#63); aqui só placeholder.
- Pagamento/checkout no portal — #40/#42.
- Perfil público do técnico (a rota `/tecnico/{slug}` já existe do slice de perfil) — só linkar.
- Reagendamento/cancelamento via portal — #43.

---

## Validação final

`pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes + §2.5 (Playwright/devtools MCP) com evidências (screenshots das 4 resoluções + fluxos exercitados).
Branch: `feat/issue-39-portal-cliente-logado`. PR com `Closes #39`.
