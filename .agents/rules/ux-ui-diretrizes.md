# Diretrizes de UX/UI — Legibilidade, Hierarquia, Espaçamento e Responsividade

## 1. Legibilidade

Para garantir uma interface limpa, acessível e fácil de ler, siga estes padrões de legibilidade:

* **Contraste mínimo WCAG AA:** Todos os elementos de texto devem possuir contraste em relação ao fundo em conformidade com o padrão WCAG AA (mínimo de 4.5:1 para texto normal e 3:1 para texto grande).
* **Texto principal entre 16px e 18px:** O texto do corpo principal deve utilizar tamanhos confortáveis (usando classes como `text-base` ou `text-lg` do Tailwind).
* **Line-height entre 1.4 e 1.7:** Garanta espaçamento vertical adequado para evitar cansaço visual (ex: classes `leading-relaxed` ou `leading-loose`).
* **Máximo de 80 caracteres por linha:** Imponha limites de largura máxima para blocos de leitura de texto (ex: classe `max-w-prose` ou limitadores como `max-w-2xl` / `max-w-3xl`).
* **Não usar mais de 3 níveis de tamanho de texto por seção:** Limite a hierarquia visual por agrupamento para evitar poluição (ex: título, subtítulo e corpo).
* **Evitar blocos longos sem agrupamento visual:** Divida parágrafos longos em blocos menores e utilize espaçadores, listas com marcadores ou cards para segmentação.

## 2. Hierarquia Visual

Para estruturar telas equilibradas e intuitivas para o usuário, observe os seguintes critérios de hierarquia:

* **Apenas 1 CTA principal por tela:** Evite colocar múltiplos botões em destaque visual máximo (ex: botão preenchido/primary). Outras ações devem usar variantes secundárias, outline ou ghost.
* **Apenas 1 elemento dominante por seção:** Cada bloco lógico da página deve ter um único ponto focal claro (como um título marcante, um elemento gráfico destacado ou uma métrica grande).
* **Ações destrutivas nunca competem visualmente com CTA principal:** Botões de exclusão ou cancelamento devem usar variantes mais leves (como outline destrutiva ou link) e só receber o preenchimento vermelho forte em popovers/diálogos de confirmação final.
* **Métricas importantes devem aparecer acima da dobra:** Indicadores fundamentais (ex: resumo financeiro, status crítico da OS) devem ficar na parte superior da visualização, sem exigir rolagem.
* **Informações secundárias devem usar `text-muted-foreground`:** Textos explicativos, metadados, datas e detalhes adicionais devem vir com menor contraste usando `text-muted-foreground`.

## 3. Espaçamento e Layout

Para garantir harmonia visual e um layout balanceado, aplique as seguintes regras de espaçamento:

* **Usar escala múltipla de 4px:** Todo espaçamento (padding, margin, gaps) deve seguir a escala de múltiplos de 4px do Tailwind (ex: `p-1` [4px], `p-2` [8px], `p-4` [16px], `p-6` [24px], `p-8` [32px], `p-12` [48px], `p-16` [64px]).
* **Distância entre seções:** Seções maiores da página devem ser separadas por espaçamentos de 32px a 64px (ex: classes `space-y-8` a `space-y-16`, ou margens equivalentes).
* **Distância entre componentes relacionados:** Elementos relacionados dentro de uma mesma seção devem ter distância de 16px a 24px (ex: classes `space-y-4` a `space-y-6`, ou gaps correspondentes).
* **Distância interna de cards:** O preenchimento interno (*padding*) de cards e caixas de informação deve ser de 16px a 24px (ex: `p-4` a `p-6`).
* **Nunca usar espaçamentos arbitrários:** Evite classes com valores customizados ou inline no formato `mt-[13px]`, `p-[19px]`, etc. Utilize exclusivamente a escala padrão de utilitários do Tailwind. Sempre prefira valores da escala (ex: `gap-4`, `gap-6`, `gap-8`, `gap-12`) e evite definir valores arbitrários (ex: `gap-[13px]`, `gap-[17px]`).

## 4. Responsividade

Para garantir uma interface fluida em qualquer dispositivo, siga estas regras de responsividade:

* **Dispositivos Móveis (Mobile):**
  - Layouts devem colapsar para 1 coluna (`grid-cols-1`).
  - A barra lateral (Sidebar) deve virar um painel deslizante (Drawer/Sheet) em páginas internas/formulários, mas em **todos os Dashboards** ela deve ser substituída por uma **Bottom Nav (barra inferior) flutuante com suporte a FAB (Floating Action Button)**.
  - Tabelas devem ser convertidas/reestruturadas para o formato de Cards caso o espaço seja insuficiente para colunas legíveis.

* **Tablets:**
  - Layouts de grade de até 2 colunas (`md:grid-cols-2`).

* **Computadores (Desktop):**
  - Layouts de grade de até 4 colunas (`lg:grid-cols-4` ou `xl:grid-cols-4`).

* **NUNCA permitir:**
  - Rolagem horizontal (*scroll horizontal*) na página principal ou em elementos que contenham texto corrido.
  - Texto cortado ou truncado sem tratamento visual (sem elipse ou quebra adequada).
  - Overflow visível que quebre os limites de layout ou cartões (*cards*).
