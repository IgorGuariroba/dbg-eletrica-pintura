# AGENTS.md — Instruções para Agentes de IA

Este arquivo contém instruções operacionais, diretrizes de design e regras de desenvolvimento para agentes de IA que interagem com o repositório da **DBG Elétrica e Pintura**.

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
  - Seguir regras de responsividade, hierarquia e espaçamento do projeto.
  - Seguir padrões arquiteturais do projeto.
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
* **Layout:**
  - Sem scroll horizontal indesejado.
  - Sem elementos cortados.
  - Sem sobreposição de componentes.
  - Sem espaços vazios excessivos.
* **Hierarquia Visual:**
  - Apenas 1 CTA principal evidente por tela.
  - Apenas 1 elemento dominante por seção lógica.
  - Ações destrutivas não competem visualmente com o CTA principal.
  - Métricas e KPIs importantes posicionados acima da dobra.
  - Informações secundárias usando a classe `text-muted-foreground`.
* **Espaçamento e Densidade:**
  - Distâncias de seções e componentes seguindo a escala múltipla de 4px.
  - Densidade ideal da informação (conforme diretrizes de densidade).

#### Frontend Reviewer (Analisa Código e Acessibilidade):
* **Padrões de Código:**
  - Uso correto do Next.js, React, TypeScript e Tailwind.
  - Uso correto e aderência total de componentes do Design System (shadcn/ui).
  - Sem estilos inline proibidos.
* **Acessibilidade & Performance:**
  - Contraste de cores adequado conforme WCAG AA.
  - Área clicável mínima de `44x44px` para elementos interativos em mobile.
  - Estados de foco (`ring-ring`, etc.) visíveis para navegação por teclado.

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

---

## 3. Comandos Operacionais

Use estes comandos exatos do `pnpm` para validar e gerenciar o projeto:

* **Desenvolvimento:** `pnpm dev`
* **Compilação de Produção:** `pnpm build`
* **Análise Estática (Linter):** `pnpm lint`
* **Checagem de Tipos (TypeScript):** `pnpm typecheck`
* **Testes de Unidade / Integração:** `pnpm test` (ou `pnpm test:watch` em desenvolvimento)
* **Testes E2E (Playwright):** `pnpm test:e2e`
* **Criar/Adicionar Componentes (Shadcn CLI):** `npx shadcn add <componente>` (a CLI está configurada localmente no projeto através do arquivo [components.json](file:///home/movida/projetos/dbg/components.json)).

---

## 4. Diretrizes de UI (UI Rules)

Todos os componentes visuais da aplicação devem seguir estritamente estes padrões:

* **Ficar em `src/components/*`:** Todo componente visual criado deve ser organizado sob o diretório `src/components/` (seja como componente utilitário ou na subpasta `src/components/ui/` para primitivos do shadcn).
* **Usar shadcn/ui:** Dê preferência absoluta aos componentes existentes em `src/components/ui/`. A CLI do shadcn está totalmente configurada e disponível para consultar e adicionar novos componentes primitivos rodando: `npx shadcn add <componente>`.
* **NUNCA usar elementos HTML puros:** Não utilize tags nativas cruas para botões, modais ou inputs (como `<button>`, `<input>`, `<textarea>` ou `<dialog>`). Sempre utilize os componentes correspondentes de `src/components/ui/` (ex: `Button`, `Input`, `Dialog`, `Textarea`).
* **Usar Tailwind CSS:** Toda a estilização do projeto deve ser feita exclusivamente utilizando Tailwind CSS v4.
* **Usar tokens semânticos (CSS):** Toda cor, espaçamento ou raio deve vir de tokens semânticos CSS (como `bg-primary`, `text-foreground`, `border-border`). Nunca hardcodeie cores hexadecimais (ex: `#3CAAF0`) nos estilos ou classes utilitárias de cor bruta (ex: `bg-blue-500`) se houver um token semântico correspondente.
* **Não usar inline styles:** Estilos inline (`style={{ ... }}`) são proibidos, exceto para valores calculados dinamicamente em runtime (ex: animações complexas ou scroll).
* **Nunca criar botões customizados sem necessidade:** Utilize sempre a estrutura configurada no componente `@/components/ui/button`.

---

## 5. Design Tokens

* **Fonte de verdade:** [src/app/globals.css](file:///home/movida/projetos/dbg/src/app/globals.css) (Todas as definições de cores, fontes, espaçamentos e variáveis temáticas devem ser manipuladas exclusivamente neste arquivo).

* **Nunca utilizar classes utilitárias de cores brutas:**
  - `bg-blue-*`
  - `text-blue-*`
  - `border-gray-*`
  - `text-red-*`
  - `bg-green-*`

* **Sempre utilizar tokens semânticos:**
  - `bg-primary` / `bg-secondary` / `bg-accent` / `bg-destructive`
  - `text-foreground` / `text-muted-foreground`
  - `border-border` / `border-input`
  - `ring-ring`

* **Antes de criar um novo token:**
  1. Adicionar o valor padrão em `:root`.
  2. Adicionar o valor correspondente em `.dark`.
  3. Mapear a variável em `@theme inline` para habilitá-la no compilador do Tailwind.

---

## 6. Diretrizes de Legibilidade (UX/UI)

Para garantir uma interface limpa, acessível e fácil de ler, siga estes padrões de legibilidade:

* **Contraste mínimo WCAG AA:** Todos os elementos de texto devem possuir contraste em relação ao fundo em conformidade com o padrão WCAG AA (mínimo de 4.5:1 para texto normal e 3:1 para texto grande).
* **Texto principal entre 16px e 18px:** O texto do corpo principal deve utilizar tamanhos confortáveis (usando classes como `text-base` ou `text-lg` do Tailwind).
* **Line-height entre 1.4 e 1.7:** Garanta espaçamento vertical adequado para evitar cansaço visual (ex: classes `leading-relaxed` ou `leading-loose`).
* **Máximo de 80 caracteres por linha:** Imponha limites de largura máxima para blocos de leitura de texto (ex: classe `max-w-prose` ou limitadores como `max-w-2xl` / `max-w-3xl`).
* **Não usar mais de 3 níveis de tamanho de texto por seção:** Limite a hierarquia visual por agrupamento para evitar poluição (ex: título, subtítulo e corpo).
* **Evitar blocos longos sem agrupamento visual:** Divida parágrafos longos em blocos menores e utilize espaçadores, listas com marcadores ou cards para segmentação.

---

## 7. Diretrizes de Hierarquia Visual (UX/UI)

Para estruturar telas equilibradas e intuitivas para o usuário, observe os seguintes critérios de hierarquia:

* **Apenas 1 CTA principal por tela:** Evite colocar múltiplos botões em destaque visual máximo (ex: botão preenchido/primary). Outras ações devem usar variantes secundárias, outline ou ghost.
* **Apenas 1 elemento dominante por seção:** Cada bloco lógico da página deve ter um único ponto focal claro (como um título marcante, um elemento gráfico destacado ou uma métrica grande).
* **Ações destrutivas nunca competem visualmente com CTA principal:** Botões de exclusão ou cancelamento devem usar variantes mais leves (como outline destrutiva ou link) e só receber o preenchimento vermelho forte em popovers/diálogos de confirmação final.
* **Métricas importantes devem aparecer acima da dobra:** Indicadores fundamentais (ex: resumo financeiro, status crítico da OS) devem ficar na parte superior da visualização, sem exigir rolagem.
* **Informações secundárias devem usar `text-muted-foreground`:** Textos explicativos, metadados, datas e detalhes adicionais devem vir com menor contraste usando `text-muted-foreground`.

---

## 8. Diretrizes de Espaçamento e Layout (UX/UI)

Para garantir harmonia visual e um layout balanceado, aplique as seguintes regras de espaçamento:

* **Usar escala múltipla de 4px:** Todo espaçamento (padding, margin, gaps) deve seguir a escala de múltiplos de 4px do Tailwind (ex: `p-1` [4px], `p-2` [8px], `p-4` [16px], `p-6` [24px], `p-8` [32px], `p-12` [48px], `p-16` [64px]).
* **Distância entre seções:** Seções maiores da página devem ser separadas por espaçamentos de 32px a 64px (ex: classes `space-y-8` a `space-y-16`, ou margens equivalentes).
* **Distância entre componentes relacionados:** Elementos relacionados dentro de uma mesma seção devem ter distância de 16px a 24px (ex: classes `space-y-4` a `space-y-6`, ou gaps correspondentes).
* **Distância interna de cards:** O preenchimento interno (*padding*) de cards e caixas de informação deve ser de 16px a 24px (ex: `p-4` a `p-6`).
* **Nunca usar espaçamentos arbitrários:** Evite classes com valores customizados ou inline no formato `mt-[13px]`, `p-[19px]`, etc. Utilize exclusivamente a escala padrão de utilitários do Tailwind. Sempre prefira valores da escala (ex: `gap-4`, `gap-6`, `gap-8`, `gap-12`) e evite definir valores arbitrários (ex: `gap-[13px]`, `gap-[17px]`).

---

## 9. Diretrizes de Responsividade (UX/UI)

Para garantir uma interface fluida em qualquer dispositivo, siga estas regras de responsividade:

* **Dispositivos Móveis (Mobile):**
  - Layouts devem colapsar para 1 coluna (`grid-cols-1`).
  - A barra lateral (Sidebar) deve virar um painel deslizante (Drawer/Sheet).
  - Tabelas devem ser convertidas/reestruturadas para o formato de Cards caso o espaço seja insuficiente para colunas legíveis.

* **Tablets:**
  - Layouts de grade de até 2 colunas (`md:grid-cols-2`).

* **Computadores (Desktop):**
  - Layouts de grade de até 4 colunas (`lg:grid-cols-4` ou `xl:grid-cols-4`).

* **NUNCA permitir:**
  - Rolagem horizontal (*scroll horizontal*) na página principal ou em elementos que contenham texto corrido.
  - Texto cortado ou truncado sem tratamento visual (sem elipse ou quebra adequada).
  - Overflow visível que quebre os limites de layout ou cartões (*cards*).

---

## 10. Diretrizes de Densidade de Informação (UX/UI)

A densidade ideal varia conforme a categoria de tela e o dispositivo. Antes de renderizar ou revisar qualquer tela, classifique-a em uma destas quatro categorias:

### 10.1. Dashboard (Objetivo: Responder perguntas rapidamente - Evitar excesso de dados)
* **Desktop (Densidade Alta - Nível 4/5):**
  - Grid de até 4 colunas para KPIs.
  - Gráficos e painéis de ranking distribuídos horizontalmente em seções balanceadas.
* **Mobile (Densidade Baixa - Nível 2/5):**
  - Layout estrito de 1 coluna.
  - Máximo de 4 KPIs visíveis inicialmente (demais ocultos sob scroll ou expansores).
  - Gráficos simplificados; esconder métricas secundárias.

### 10.2. Formulário (Objetivo: Facilidade de entrada de dados - Não velocidade de leitura)
* **Desktop (Densidade Média - Nível 3/5):**
  - Layout de 2 colunas para agrupar campos correlacionados lado a lado.
* **Mobile (Densidade Baixa - Nível 2/5):**
  - Layout estrito de 1 coluna, em ordem linear.
  - Labels sempre visíveis. Botões de ação ocupando largura total do viewport.

### 10.3. Tabela (Objetivo: Alta densidade de dados)
* **Desktop (Densidade Máxima - Nível 5/5):**
  - Formato tradicional de tabela para visualização rápida de várias colunas.
* **Mobile (Densidade Média - Nível 3/5):**
  - **Tabela Simples (até 4 colunas):** Mantém o formato de tabela tradicional no mobile se o conteúdo das linhas for legível.
  - **Tabela Complexa (mais de 4 colunas ou >20 linhas):** **NUNCA** encolher ou truncar colunas. Converta as linhas da tabela para **Lista de Cards** individuais contendo filtros e campo de busca.

### 10.4. Tela de Detalhes (Objetivo: Compreensão de dados e histórico)
* **Desktop (Densidade Alta - Nível 4/5):**
  - Layout de até 2 colunas lado a lado (ex: Dados à esquerda, Histórico/Observações à direita).
* **Mobile (Densidade Média - Nível 3/5):**
  - Seções empilhadas verticalmente (Dados → Histórico → Observações → Arquivos).

---

### Tabela de Escala de Densidade (1 = Muito Baixa | 5 = Muito Alta)

| Tipo de Tela | Mobile | Desktop |
| :--- | :---: | :---: |
| **Dashboard** | Nível 2 | Nível 4 |
| **Formulário**| Nível 2 | Nível 3 |
| **Detalhes**  | Nível 3 | Nível 4 |
| **Tabela**    | Nível 3 | Nível 5 |

---

### Checklist de Revisão de Densidade (Para Análise de Capturas de Tela / Code-Review)
* **Dashboard:** Existe informação visual demais? O KPI principal é óbvio no primeiro olhar?
* **Formulário:** Existem muitos campos aglomerados? Estão devidamente agrupados por relevância?
* **Tabela:** Está legível? Existe excesso de colunas horizontais espremidas?
* **Detalhes:** A informação está estruturalmente agrupada? Existe uma hierarquia visual de leitura clara?

**Prioridade de Decisão:**
1. **Clareza** (Sempre a prioridade principal)
2. **Legibilidade**
3. **Densidade**

> [!IMPORTANT]
> *NUNCA* sacrifique a clareza ou a legibilidade visual para tentar exibir mais informações em uma mesma tela. Interfaces excelentes não são as que exibem mais informação; são as que exibem a informação certa no momento certo.

---

## 11. Diretrizes de Organização e Arquitetura (Pastas e Componentes)

Para garantir escalabilidade, legibilidade e manutenibilidade do código, a estrutura de pastas e componentes do projeto deve seguir estritamente o padrão de organização e as regras abaixo:

### 11.1. Arquitetura de Diretórios (`src/`)

```txt
src/
├── app/            # Apenas páginas, layouts e route handlers (composição de telas).
├── components/     # Componentes globais e reutilizáveis (divididos em ui, layout e shared).
│   ├── ui/         # Apenas componentes base do shadcn/ui ou pequenas extensões genéricas.
│   ├── layout/     # Header, Sidebar, Footer, Breadcrumbs e estruturas globais de layout.
│   └── shared/     # Componentes de negócio reutilizáveis e independentes de domínio.
├── features/       # Componentes e lógica específicos agrupados por domínio de negócio (futuro).
│   ├── catalogo/
│   ├── equipe/
│   └── operacao/
├── catalogo/       # Legado/Atual: Domínio e lógica do Catálogo de Serviços.
├── equipe/         # Legado/Atual: Domínio e lógica de Membros da Equipe.
├── operacao/       # Legado/Atual: Domínio e lógica das Operações e Ordens de Serviço.
├── db/             # Cliente do banco de dados (Drizzle ORM) e conexão.
├── auth/           # Configurações de autenticação e permissões de acesso.
├── lib/            # Utilitários compartilhados e integrações de APIs externas.
└── hooks/          # React Hooks globais não atrelados a um domínio.
```

### 11.2. Responsabilidade das Pastas

1. **`components/ui` (Design System):**
   - Apenas componentes base do shadcn/ui ou pequenas customizações/extensões desde que continuem sendo componentes genéricos (ex: `button.tsx`, `input.tsx`, `card.tsx`, `dialog.tsx`, `table.tsx` ou um `<StatusBadge status="..." />` genérico).

2. **`components/layout` (Estruturas de Layout):**
   - Estruturas de layout reaproveitáveis globais (ex: `<AppSidebar />`, `<AppHeader />`, `<PageContainer />`, `<PageTitle />`).

3. **`components/shared` (Componentes Compartilhados):**
   - Componentes reutilizáveis independentes de domínio (ex: `<EmptyState />`, `<SearchBar />`, `<ConfirmDialog />`). Eles não pertencem a uma feature específica.

4. **`features/*` (Domínio de Negócio):**
   - Componentes e lógicas específicas de negócio de um domínio específico (Forms, Tables, Filters, Row Actions, Dialogs de negócio). Exemplo: `features/customers/components/customer-form.tsx`.

5. **`app/` (Páginas e Rotas):**
   - Apenas páginas, layouts e route handlers. Não deve conter lógicas de negócio pesadas ou declarações diretas de formulários extensos.

### 11.3. Fluxo de Dependências Recomendado

A árvore de dependências deve fluir de baixo nível (genérico) para alto nível (páginas/negócio):
```txt
ui (design system)
   ↓
shared / layout
   ↓
feature (domínio específico)
   ↓
page (composição de rota)
```
*Exemplo real:* Um componente `<CustomerTable />` (de `features/customers/components/`) usa componentes de `<Table />`, `<Button />` e `<Badge />` vindos de `components/ui`.

### 11.4. Regras Operacionais para Agentes (Proibido)

* **Proibido:**
  - **Criar componentes de negócio dentro de `components/ui/`**.
  - **Criar lógica de negócio complexa dentro de `app/`**.
  - **Duplicar componentes existentes** (Sempre procurar, reutilizar e apenas criar se não existir).
  - **Criar wrappers desnecessários** (ex: `<AppButton />` que apenas encapsula `<Button />` sem adicionar novos comportamentos ou lógica). Isso apenas aumenta a complexidade.

### 11.5. Estratégia de Transição Gradual

A arquitetura do projeto atual está saudável e não exige uma refatoração em massa imediata de todos os arquivos. A migração deve ocorrer de forma orgânica e gradual:
1. Para quaisquer próximas funcionalidades ou novos componentes de negócio, começar a utilizar/criar as pastas `components/layout`, `components/shared` e `features/*`.
2. À medida que os módulos legados (`src/catalogo`, `src/equipe` e `src/operacao`) forem modificados ou expandidos, migrar as lógicas e componentes de negócio de forma incremental para dentro do diretório correspondente em `features/*`. Em poucas semanas, o projeto migrará naturalmente para o padrão sem necessidade de refatoração destrutiva imediata.

---

## 12. Referências Importantes

Para entender o domínio de negócios e a estrutura visual:
* **Regras de Negócio e Domínio:** Veja o arquivo [CONTEXT.md](file:///home/movida/projetos/dbg/CONTEXT.md).
* **Guia Visual e Tokens de Design:** Veja o arquivo [design-system.html](file:///home/movida/projetos/dbg/design-system.html).

---

## 13. Workflow de Mudanças

Toda alteração de código deve seguir estritamente estes passos:
1. **Preparar branch:** `git checkout main && git pull` → `git switch -c <tipo>/<nome-descritivo>` (tipos permitidos: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`).
2. **Desenvolver:** commits incrementais organizados.
3. **Validar localmente:** rodar lint, typecheck e testes (`pnpm lint && pnpm typecheck && pnpm test`).
4. **Revisar:** executar `/code-review` se aplicável e corrigir inconformidades.
5. **Finalizar:** Fazer push da branch e abrir PR para a `main`. Nunca commitar diretamente na branch `main`.
