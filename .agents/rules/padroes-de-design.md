# Padrões de Interface (UI Rules + Design Tokens)

Para garantir a consistência visual, acessibilidade e manutenção do design system da DBG Elétrica e Pintura, as seguintes regras de UI devem ser rigorosamente seguidas:

## Diretrizes de Desenvolvimento de UI

1. **Sempre usar shadcn/ui**:
   - Dê preferência absoluta aos componentes existentes no diretório `src/components/ui/`.
   - Se for necessário um novo componente base de interface, adicione-o usando a CLI do shadcn (`npx shadcn add <componente>`) ao invés de implementar do zero — a CLI está configurada no projeto via [components.json](../../components.json).

2. **NUNCA usar elementos HTML puros para botões, modais ou inputs**:
   - Sempre utilize os componentes correspondentes da pasta `@/components/ui` (como `Button`, `Dialog`, `Input`, `Select`, `Textarea`, etc.).
   - Evite tags HTML nativas puras (ex: `<button>`, `<input>`, `<textarea>`, ou divs/dialogs nativos para modais) que não herdem a estilização e acessibilidade do design system.

3. **Nunca criar botão customizado sem necessidade**:
   - Utilize sempre o componente `@/components/ui/button` configurado no projeto. Evite tags `<button>` puras com estilos próprios.

4. **Componentes visuais ficam em `src/components/*`**:
   - Todo componente visual criado deve ser organizado sob `src/components/` (como componente utilitário, ou na subpasta `src/components/ui/` para primitivos do shadcn).

5. **Não usar inline styles**:
   - Evite a prop `style={{ ... }}` para fins de estilização estética ou de layout.
   - Estilos inline são permitidos unicamente para valores dinâmicos calculados em runtime (como posições de scroll ou animações dinâmicas).

6. **Tailwind apenas**:
   - Toda estilização deve ser feita exclusivamente utilizando as classes utilitárias do Tailwind CSS v4 integradas no projeto.

7. **Regra Global de Fluxo e Navegação (Dashboards)**:
   - Todos os fluxos de usuário devem levar a algum Dashboard específico.
   - Todos os dashboards do projeto devem, obrigatoriamente, seguir a regra de navegação adaptativa: **Sidebar** (navegação lateral completa) em Desktop, e **Bottom Nav (barra inferior) flutuante com suporte a FAB (Floating Action Button)** em Mobile.

## Design Tokens

* **Fonte de verdade:** [src/app/globals.css](../../src/app/globals.css) — todas as definições de cores, fontes, espaçamentos e variáveis temáticas devem ser manipuladas exclusivamente neste arquivo.

* **Toda cor deve vir de tokens semânticos CSS:**
  - `bg-primary` / `bg-secondary` / `bg-accent` / `bg-destructive`
  - `text-foreground` / `text-muted-foreground`
  - `border-border` / `border-input`
  - `ring-ring`

* **Nunca declarar cores diretas:**
  - Hexadecimais (ex: `#3CAAF0`), RGB ou HSL diretamente no código dos componentes.
  - Classes utilitárias de cores brutas do Tailwind: `bg-blue-*`, `text-blue-*`, `border-gray-*`, `text-red-*`, `bg-green-*`, etc.

* **Antes de criar um novo token:**
  1. Adicionar o valor padrão em `:root`.
  2. Adicionar o valor correspondente em `.dark`.
  3. Mapear a variável em `@theme inline` para habilitá-la no compilador do Tailwind.
