# Diretrizes de Organização e Arquitetura (Pastas e Componentes)

Para garantir escalabilidade, legibilidade e manutenibilidade do código, a estrutura de pastas e componentes do projeto deve seguir estritamente o padrão de organização e as regras abaixo:

## 1. Arquitetura de Diretórios (`src/`)

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

## 2. Responsabilidade das Pastas

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

## 3. Fluxo de Dependências Recomendado

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

## 4. Regras Operacionais para Agentes (Proibido)

* **Proibido:**
  - **Criar componentes de negócio dentro de `components/ui/`**.
  - **Criar lógica de negócio complexa dentro de `app/`**.
  - **Duplicar componentes existentes** (Sempre procurar, reutilizar e apenas criar se não existir).
  - **Criar wrappers desnecessários** (ex: `<AppButton />` que apenas encapsula `<Button />` sem adicionar novos comportamentos ou lógica). Isso apenas aumenta a complexidade.

## 5. Estratégia de Transição Gradual

A arquitetura do projeto atual está saudável e não exige uma refatoração em massa imediata de todos os arquivos. A migração deve ocorrer de forma orgânica e gradual:
1. Para quaisquer próximas funcionalidades ou novos componentes de negócio, começar a utilizar/criar as pastas `components/layout`, `components/shared` e `features/*`.
2. À medida que os módulos legados (`src/catalogo`, `src/equipe` e `src/operacao`) forem modificados ou expandidos, migrar as lógicas e componentes de negócio de forma incremental para dentro do diretório correspondente em `features/*`. Em poucas semanas, o projeto migrará naturalmente para o padrão sem necessidade de refatoração destrutiva imediata.
