# Plano de Implementação — Issue #35

**Fase 3 / Slice 2 — Slot engine (cálculo de slots disponíveis)**
Metodologia: TDD (red→green→refactor, fatias verticais). Depende de #34 (mergeado). Desbloqueia #36 (UI Instant Booking).

---

## Objetivo

Núcleo do Instant Booking. Função pura recebe `(inicio, fim, categoria)` + técnicos e
devolve lista ordenada de **Slots** disponíveis `(inicio, duração, técnico_sugerido)`.

Slots **não** são persistidos — calculados sob demanda. Reservar = inserir/atualizar OS
para `AGENDADA` + `tecnico_id` + `agendado_para`. Concorrência resolvida no servidor:
duas reservas no mesmo slot → última perde com erro tipado.

---

## Decisões travadas

| Tema | Decisão |
| --- | --- |
| Duração do slot | **Fixa 60min**, parametrizável (`duracaoMin?`, default 60). OS não tem coluna de duração; Catálogo modela `unidade` (PONTO/M2/HORA), não duração de execução. Futuro: derivar de catálogo/orçamento. **Documentar no PR (exigido pelo AC).** |
| Concorrência | **Índice único parcial** `(tecnico_id, agendado_para) WHERE estado IN (ativos)`. Client é **neon-http** → sem transação interativa (só `db.batch()`), logo `SELECT … FOR UPDATE` não é opção. 2ª reserva concorrente → `23505` → `SlotIndisponivelError`. |
| Estados que ocupam slot | `AGENDADA, A_CAMINHO, NO_LOCAL, EM_EXECUCAO`. Não `APROVADA` (sem slot ainda); não `CONCLUIDA/PAGA/CANCELADA`. |
| Pureza | Função núcleo recebe técnicos **já carregados** (especialidades + disponibilidade + ocupações). Casca fina (loader) faz as queries. Núcleo testável sem DB, sobrevive a refactor de query. |
| Prioridade assinante | Param `assinante?` **aceito sem efeito** nesta fase (Fase 5 ativa de fato). |

---

## Reuso (Regra de Ouro §1)

- `HorarioComercial`, `HORARIO_COMERCIAL_PADRAO`, shape de janela — `horario-comercial.ts` (#34).
- Lógica de interseção comercial ∩ disponibilidade — base em `disponibilidadeDentroDoComercial`.
- `OperacaoConfigRepo.obter().horarioComercial` — `config-repo.ts` (#34).
- `membro` schema — `especialidades: Categoria[]`, `disponibilidade`, `isTecnico`, `ativo`.
- `ordemServico` — `tecnicoId`, `estado`, `categoria`, `agendadoPara`.
- Padrão `db.batch([...])` + histórico em `transicao_os` — `reagendamento-repo-drizzle.ts`.
- Padrão de mapeamento `23505` → erro tipado — `membro-repo-drizzle.ts` (`ehViolacaoUnica`).

---

## Arquitetura

```
calcularSlotsDisponiveis(input)   ← núcleo PURO (unit) — recebe técnicos já carregados
        ↑
listarSlotsDisponiveis(deps)      ← caso de uso: carrega técnicos+ocupações, chama o puro
reservarSlot(...)                 ← reserva: update→AGENDADA; índice parcial = exclusão mútua
```

### Interface do núcleo puro (`src/operacao/slots.ts`)

```ts
interface TecnicoAgendavel {
  id: string;
  especialidades: Categoria[];
  disponibilidade: DisponibilidadeSemanal | null;
  ocupacoes: Date[];          // inícios de OS AGENDADA+ pré-CONCLUÍDA
}
interface SlotDisponivel { inicio: Date; duracaoMin: number; tecnicoId: string }

function calcularSlotsDisponiveis(input: {
  inicio: Date; fim: Date; categoria: Categoria;
  horarioComercial: HorarioComercial;
  tecnicos: TecnicoAgendavel[];
  duracaoMin?: number;        // default 60
  assinante?: boolean;        // aceito, sem efeito (Fase 5)
}): SlotDisponivel[]
```

### Algoritmo (núcleo)

1. Filtra técnicos: `especialidades ⊇ categoria`.
2. Por técnico/dia no range `[inicio, fim]`: janela = `comercial[dia] ∩ disponibilidade[dia]`.
3. Quebra janela em slots de `duracaoMin`.
4. Remove slots que colidem com `ocupacoes`.
5. `assinante` aceito sem efeito.
6. Ordena por `inicio`.

---

## Artefatos

```
src/operacao/slots.ts                    + calcularSlotsDisponiveis + tipos   [puro]
src/operacao/slots-loader.ts             + listarSlotsDisponiveis (carrega técnicos+ocupações)
src/operacao/reserva-slot.ts             + reservarSlot + SlotIndisponivelError + interface repo
src/operacao/reserva-slot-repo-drizzle.ts  update batch; mapeia 23505 → erro tipado
src/db/schema.ts                         + índice único parcial (tecnico_id, agendado_para) WHERE estado IN (...)
drizzle/xxxx_slot_uq.sql                 migração (pnpm db:generate)
tests/unit/operacao-slots.test.ts        núcleo puro
tests/integration/operacao-reserva-slot.test.ts   reserva + race (skipIf !DATABASE_URL)
```

---

## Ciclos TDD (1 teste → 1 implementação)

| # | Tipo | Comportamento testado | Implementação mínima |
| --- | --- | --- | --- |
| 1 ⦿ | unit | técnico ativo + especialidade + comercial seg 8–18 → 10 slots de 60min (8h…17h) | esqueleto do núcleo: janela comercial → slots |
| 2 | unit | técnico sem especialidade da categoria → não aparece (AC) | filtro de especialidade |
| 3 | unit | disponibilidade individual estreita a janela (∩ comercial) | interseção comercial ∩ disponibilidade |
| 4 | unit | dia fechado (domingo) → sem slots (AC) | guarda dia fechado |
| 5 | unit | OS agendada às 10h → slot das 10h some (AC) | subtração de `ocupacoes` |
| 6 | unit | multi-técnico → slots ordenados por data (AC) | merge + sort |
| 7 | int | `reservarSlot` grava `AGENDADA` + técnico + `agendadoPara` + histórico | repo batch + caso de uso |
| 8 | int | race: 2 reservas mesmo (técnico, slot) → 1 vence, outra `SlotIndisponivelError` (AC) | índice parcial + mapeamento 23505 |

⦿ = tracer bullet.

---

## Acceptance criteria (mapa)

- [ ] `calcularSlotsDisponiveis(inicio, fim, categoria)` retorna lista ordenada → ciclos 1, 6
- [ ] Slots respeitam horário comercial + disponibilidade técnico → ciclos 1, 3, 4
- [ ] Slots ocupados (OS AGENDADA+ pré-CONCLUÍDA) excluídos → ciclo 5
- [ ] Filtro por especialidade → ciclo 2
- [ ] Reserva valida disponibilidade na transação (RC) → ciclos 7, 8
- [ ] Documentação no PR: decisão sobre duração padrão e fonte → seção "Decisões travadas"
- [ ] Teste: técnico sem especialidade não aparece → ciclo 2
- [ ] Teste: OS agendada ocupa slot e ele some → ciclo 5
- [ ] Teste: race condition, 1 falha com erro tipado → ciclo 8
- [ ] Teste: horário fechado (domingo) não gera slots → ciclo 4

---

## Validação final

`pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes.
Slice sem UI (núcleo + reserva) → §2.5 (Playwright) não se aplica aqui; UI vem no #36.
Branch: `feat/issue-35-slot-engine`. PR com `Closes #35`.
