# AGENTS.md — Instruções para Agentes de IA

Este arquivo contém instruções operacionais para agentes de IA que interagem com o repositório da **DBG Elétrica e Pintura**. As regras detalhadas de design, UX e arquitetura vivem em [`.agents/rules/`](./.agents/rules/) (ver §4). As diretrizes comportamentais que regem *como* trabalhar estão na §7.

---

## 1. Regra de Ouro (Reutilização de Código)

Antes de criar qualquer novo código ou componente:
1. **Procurar implementação existente.**
2. **Reutilizar.**
3. **Criar somente se não existir.**

---

## 2. Processo Obrigatório de Desenvolvimento (UI)

Toda alteração de interface de usuário (UI/UX) deve seguir estritamente o fluxo de papéis especializados:

```txt
Builder
   ↓
UX Reviewer
   ↓
Frontend Reviewer
   ↓
Refactor
   ↓
Aprovado
```

Nenhuma tarefa de UI pode ser considerada concluída sem passar por todas as etapas.

### 2.1. Builder
* **Objetivo:** Implementar a solução.
* **Responsabilidades:**
  - Implementar a funcionalidade solicitada.
  - Utilizar apenas componentes do Design System (`src/components/ui/*`).
  - Utilizar apenas tokens semânticos (configurados em `src/app/globals.css`).
  - Seguir as regras de design e arquitetura de [`.agents/rules/`](./.agents/rules/) (§4).
* **Proibido:**
  - Criar componentes duplicados.
  - Utilizar cores diretas/brutas do Tailwind (ex: `bg-blue-500`).
  - Ignorar componentes existentes do shadcn/ui.
  - Fazer otimizações visuais sem validação posterior.
* **Entrega:**
  - Código funcional.
  - Sem erros de linter (`pnpm lint`).
  - Sem erros de checagem de tipo (`pnpm typecheck`).
  - Compilação de produção funcionando (`pnpm build`).

### 2.2. UX Reviewer e Frontend Reviewer (Especialização do Review)
O agente deve agir como um **arquiteto e designer sênior** durante o review. Seu objetivo não é validar a implementação de forma passiva, mas sim **procurar falhas ativamente**. Presuma que existem problemas até provar o contrário.

A validação visual deve ser executada nas seguintes resoluções:
* **Mobile:** `390px`
* **Tablet:** `768px`
* **Desktop:** `1366px` e `1920px`

#### UX Reviewer (Analisa UX e Layout):
Valida a tela contra [`ux-ui-diretrizes.md`](./.agents/rules/ux-ui-diretrizes.md) (legibilidade, hierarquia, espaçamento, responsividade) e [`densidade-informacao.md`](./.agents/rules/densidade-informacao.md). Pontos críticos:
  - Sem scroll horizontal, elementos cortados, sobreposição ou espaços vazios excessivos.
  - Apenas 1 CTA principal evidente por tela; 1 elemento dominante por seção; ações destrutivas não competem com o CTA.
  - Métricas/KPIs importantes acima da dobra; informações secundárias com `text-muted-foreground`.
  - Espaçamento na escala múltipla de 4px; densidade conforme a categoria da tela.

#### Frontend Reviewer (Analisa Código e Acessibilidade):
Valida o código contra [`padroes-de-design.md`](./.agents/rules/padroes-de-design.md) e [`arquitetura-pastas.md`](./.agents/rules/arquitetura-pastas.md). Pontos críticos:
  - Uso correto do Next.js, React, TypeScript e Tailwind; aderência total ao Design System (shadcn/ui); sem estilos inline proibidos.
  - Contraste WCAG AA; área clicável mínima de `44x44px` em mobile; estados de foco (`ring-ring`, etc.) visíveis.

#### Saída Obrigatória do Review:
Se houver qualquer inconsistência, o Reviewer deve listar as falhas no seguinte formato de relatório:
```
Problema: [Descrição do problema]
Impacto: [O que acarreta na experiência/sistema]
Severidade: [Baixa / Média / Alta]
Sugestão: [Ação recomendada para correção]
```

### 2.3. Refactor
* **Objetivo:** Corrigir apenas os problemas identificados no relatório do Reviewer.
* **Responsabilidades:**
  - Corrigir os problemas e falhas reportadas.
  - Preservar o comportamento e as funcionalidades existentes.
  - Não introduzir mudanças não solicitadas ou escopos extras.
* **Proibido:**
  - Criar novos componentes sem real necessidade.
  - Alterar regras de negócio do domínio.
  - Ignorar ou pular qualquer feedback fornecido pelo Reviewer.

### 2.4. Critérios de Aprovação (Definição de Done)
A tarefa de UI somente poderá ser dada como concluída quando atingir as seguintes avaliações:
* **Layout:** `≥ 8/10`
* **Responsividade:** `≥ 8/10`
* **Acessibilidade:** `≥ 8/10`
* **Consistência Visual:** `≥ 8/10`
* **Design System:** `100% aderente`

### 2.5. Validação Visual Obrigatória (Playwright MCP)

Nenhuma tarefa de UI é considerada concluída só com `lint`/`typecheck`/`test`/`build` verdes. O Reviewer **deve abrir a tela no navegador** via **Playwright MCP** e validar de verdade (não presumir pelo código).

* **Ferramenta:** usar o **Playwright MCP** (`mcp__playwright__*`) — padrão para navegação, fluxos e screenshots (validação visual). O `chrome-devtools` MCP **não é equivalente** (foco em diagnóstico, não em ação): serve como fallback aceitável se for o único carregado na sessão — registrar no relatório qual foi usado.
* **Quando usar o `chrome-devtools` MCP por preferência:** tarefas de **diagnóstico** — análise de performance (trace, Web Vitals/LCP/INP/CLS, Lighthouse), investigação de erros de console e inspeção de rede (waterfall, request/response bodies). Para esses casos ele é a escolha certa; o Playwright MCP não expõe esses recursos nativamente.
* **Subir o app:** `pnpm dev` em background; aguardar o servidor responder `200` antes de navegar.
* **Resoluções:** validar nas 4 da §2.2 (`390`, `768`, `1366`, `1920`). Em cada uma, confirmar via script: `document.documentElement.scrollWidth === clientWidth` (sem scroll horizontal) e que as imagens carregam (HTTP 200).
* **Fluxos, não só layout:** exercitar as ações reais (aprovar/rejeitar, toggles, diálogos, submits) e confirmar o efeito (estado no banco, `revalidatePath`, objeto no R2), não apenas o render estático.
* **Regras de design (`.agents/rules/`):** a validação visual deve confirmar, na tela renderizada, a aderência às rules da §4 — em especial [`padroes-de-design.md`](./.agents/rules/padroes-de-design.md): uso de componentes shadcn/ui (sem HTML cru para botões/inputs/modais), cores exclusivamente via tokens semânticos (sem hex/RGB/HSL nem cores brutas do Tailwind), ausência de inline styles estéticos e estilização só com Tailwind. Cada violação encontrada entra no relatório de review no formato da §2.2.
* **Rotas privadas (admin/PWA):** exigem sessão autenticada (Google OAuth), não acessíveis headless. Usar o **dev bypass de auth** (`@/auth/dev-bypass`) — blindado por duplo gate (`NODE_ENV !== production` **E** `DEV_BYPASS_EMAIL`), inerte em produção. Definir `DEV_BYPASS_EMAIL` no `.env.local` (NUNCA no `.env` versionado): e-mail admin para módulos administrativos, e-mail de técnico cadastrado para o PWA de campo.
* **Dados de teste:** quando a tela precisar de dados (fila de portfólio, galeria, etc.), semear o mínimo necessário (banco + R2) e **remover tudo ao final** (linhas, objetos R2, `DEV_BYPASS_EMAIL`, processo `pnpm dev`), deixando o working tree limpo.
* **Evidência:** anexar screenshots das resoluções no relatório de review e descrever os fluxos exercitados.

---

## 3. Comandos Operacionais

Use estes comandos exatos do `pnpm` para validar e gerenciar o projeto:

* **Desenvolvimento:** `pnpm dev`
* **Compilação de Produção:** `pnpm build`
* **Análise Estática (Linter):** `pnpm lint`
* **Checagem de Tipos (TypeScript):** `pnpm typecheck`
* **Testes de Unidade / Integração:** `pnpm test` (ou `pnpm test:watch` em desenvolvimento)
* **Testes E2E (Playwright):** `pnpm test:e2e`
* **Validação Visual Interativa:** abrir o app via **Playwright MCP** e validar a tela conforme a §2.5 (obrigatório para qualquer alteração de UI; rotas privadas usam o dev bypass de `@/auth/dev-bypass`).
* **Detecção de Duplicação de Código:** `npx fallow dupes` (identifica lógica repetida entre arquivos — clone groups e clone families. Rodar antes/depois de refatorações para medir o impacto na taxa de duplicação).
* **Criar/Adicionar Componentes (Shadcn CLI):** `npx shadcn add <componente>` (a CLI está configurada localmente no projeto através do arquivo [components.json](./components.json)).

### 3.1. Análise Obrigatória Pós-Implementação (Fallow)

**Sempre** rodar estes comandos ao concluir uma implementação, antes de abrir PR. Servem para encontrar problemas introduzidos pela mudança (código morto, lógica duplicada, complexidade). Falsos positivos conhecidos já estão tratados em [`.fallowrc.json`](./.fallowrc.json).

```bash
npx fallow dead-code          # Candidatos a limpeza (arquivos/exports/deps não usados)
npx fallow dupes              # Lógica repetida (clone groups e clone families)
npx fallow health             # Complexidade e alvos de refatoração
npx fallow fix --dry-run      # Preview da limpeza automática (não aplica nada)
```

Avaliar cada finding antes de agir: confirmar que é problema real (não falso positivo) e, quando for, corrigir ou registrar a exceção no [`.fallowrc.json`](./.fallowrc.json). `fix --dry-run` apenas previsualiza — nunca aplicar automático sem revisar o diff proposto.

---

## 4. Regras de Design e Arquitetura (`.agents/rules/`)

As regras detalhadas estão em [`.agents/rules/`](./.agents/rules/). **Ler as rules relevantes antes de implementar ou revisar** — elas têm a mesma força normativa deste arquivo:

| Rule | Conteúdo | Quando ler |
| :--- | :--- | :--- |
| [`padroes-de-design.md`](./.agents/rules/padroes-de-design.md) | shadcn/ui obrigatório, proibição de HTML cru, design tokens, Tailwind apenas, navegação de dashboards | Qualquer trabalho de UI |
| [`ux-ui-diretrizes.md`](./.agents/rules/ux-ui-diretrizes.md) | Legibilidade (WCAG AA), hierarquia visual, espaçamento (escala 4px), responsividade | Criar/revisar telas |
| [`densidade-informacao.md`](./.agents/rules/densidade-informacao.md) | Densidade por categoria de tela (Dashboard, Formulário, Tabela, Detalhes) e checklist de revisão | Criar/revisar telas |
| [`arquitetura-pastas.md`](./.agents/rules/arquitetura-pastas.md) | Estrutura `src/`, responsabilidade das pastas, fluxo de dependências, transição para `features/*` | Criar arquivos/componentes |
| [`nextjs-cli.md`](./.agents/rules/nextjs-cli.md) | Next.js CLI como auditoria contínua (lint e build antes de commit) | Antes de commitar |

---

## 5. Referências Importantes

Para entender o domínio de negócios e a estrutura visual:
* **Regras de Negócio e Domínio:** Comece por [CONTEXT-MAP.md](./CONTEXT-MAP.md) (índice dos 7 contextos + relacionamentos) → glossário raiz em [CONTEXT.md](./CONTEXT.md) → linguagem ubíqua de cada domínio em `src/<contexto>/CONTEXT.md`.
* **Decisões Arquiteturais:** Veja os ADRs em [docs/adr/](./docs/adr/) (o *porquê* de decisões já tomadas — guardrails contra regressão).
* **Tokens de Design:** Veja [src/app/globals.css](./src/app/globals.css) (fonte de verdade de cores, fontes e espaçamentos).

---

## 6. Workflow de Mudanças

Toda alteração de código deve seguir estritamente estes passos:
1. **Preparar branch:** `git checkout main && git pull` → `git switch -c <tipo>/<nome-descritivo>` (tipos permitidos: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`).
2. **Desenvolver:** commits incrementais organizados.
3. **Validar localmente:** rodar lint, typecheck e testes (`pnpm lint && pnpm typecheck && pnpm test`).
4. **Analisar (Fallow):** rodar a análise pós-implementação da §3.1 (`dead-code`, `dupes`, `health`, `fix --dry-run`) e tratar os findings reais.
5. **Revisar:** executar `/code-review` se aplicável e corrigir inconformidades.
6. **Finalizar:** Fazer push da branch e abrir PR para a `main`. Nunca commitar diretamente na branch `main`.
7. **Pós-Push e Gemini Code Review:** Após realizar o push para um PR aberto, deve-se:
   - Verificar se os checks do CI/GitHub Actions passaram e se o Gemini Code Review deu veredicto aprovado.
   - Caso o Gemini retorne `MUDANÇAS NECESSÁRIAS ❌`, devemos analisar os achados:
     - Se for realmente um problema crítico, devemos corrigir o problema e reiniciar o processo de validação local e push.
     - Se for um problema mais simples (não crítico), o agente deve perguntar ao usuário se deseja corrigir o problema ou apenas responder/comentar no review do Gemini explicando a decisão.

---

## 7. Diretrizes Comportamentais (Reduzir Erros Comuns de LLM)

**Tradeoff:** estas diretrizes priorizam cautela sobre velocidade. Para tarefas triviais, use julgamento.

### 7.1. Pensar Antes de Codificar

**Não presuma. Não esconda confusão. Exponha tradeoffs.**

Antes de implementar:
- Declare suas premissas explicitamente. Se incerto, pergunte.
- Se existem múltiplas interpretações, apresente-as — não escolha silenciosamente.
- Se existe abordagem mais simples, diga. Conteste quando justificado.
- Se algo está obscuro, pare. Nomeie o que confunde. Pergunte.

### 7.2. Simplicidade Primeiro

**Mínimo de código que resolve o problema. Nada especulativo.**

- Sem funcionalidades além do pedido.
- Sem abstrações para código de uso único.
- Sem "flexibilidade" ou "configurabilidade" não solicitadas.
- Sem tratamento de erro para cenários impossíveis.
- Se escreveu 200 linhas e poderiam ser 50, reescreva.

Pergunte-se: "Um engenheiro sênior diria que isto está supercomplicado?" Se sim, simplifique.

### 7.3. Mudanças Cirúrgicas

**Toque apenas no necessário. Limpe apenas a própria bagunça.**

Ao editar código existente:
- Não "melhore" código, comentários ou formatação adjacentes.
- Não refatore o que não está quebrado.
- Siga o estilo existente, mesmo que fizesse diferente.
- Se notar código morto não relacionado, mencione — não delete.

Quando suas mudanças criarem órfãos:
- Remova imports/variáveis/funções que **suas** mudanças tornaram não usados.
- Não remova código morto pré-existente sem que seja pedido.

O teste: cada linha alterada deve rastrear diretamente ao pedido do usuário.

### 7.4. Execução Orientada a Objetivo

**Defina critérios de sucesso. Itere até verificar.**

Transforme tarefas em objetivos verificáveis:
- "Adicionar validação" → "Escrever testes para entradas inválidas e fazê-los passar"
- "Corrigir o bug" → "Escrever um teste que o reproduza e fazê-lo passar"
- "Refatorar X" → "Garantir testes passando antes e depois"

Para tarefas multi-etapa, declare um plano breve:

```
1. [Etapa] → verificar: [checagem]
2. [Etapa] → verificar: [checagem]
3. [Etapa] → verificar: [checagem]
```

Critérios de sucesso fortes permitem iterar com autonomia. Critérios fracos ("faça funcionar") exigem esclarecimento constante.

---

**Estas diretrizes estão funcionando se:** menos mudanças desnecessárias nos diffs, menos retrabalho por supercomplicação, e perguntas de esclarecimento vêm antes da implementação — não depois dos erros.
