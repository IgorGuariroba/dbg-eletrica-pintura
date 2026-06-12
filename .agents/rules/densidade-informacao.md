# Diretrizes de Densidade de Informação (UX/UI)

A densidade ideal varia conforme a categoria de tela e o dispositivo. Antes de renderizar ou revisar qualquer tela, classifique-a em uma destas quatro categorias:

## 1. Dashboard (Objetivo: Responder perguntas rapidamente - Evitar excesso de dados)

* **Regra de Ouro da Jornada:** Todos os fluxos de usuário devem levar a algum Dashboard específico (do cliente, do técnico ou do admin).
* **Desktop (Densidade Alta - Nível 4/5):**
  - Grid de até 4 colunas para KPIs.
  - Gráficos e painéis de ranking distribuídos horizontalmente em seções balanceadas.
  - **Obrigatório:** Uso de **Sidebar** (navegação lateral).
* **Mobile (Densidade Baixa - Nível 2/5):**
  - Layout estrito de 1 coluna.
  - Máximo de 4 KPIs visíveis inicialmente (demais ocultos sob scroll ou expansores).
  - Gráficos simplificados; esconder métricas secundárias.
  - **Obrigatório:** Uso de **Bottom Nav (barra inferior) flutuante com suporte a FAB (Floating Action Button)**.

## 2. Formulário (Objetivo: Facilidade de entrada de dados - Não velocidade de leitura)

* **Desktop (Densidade Média - Nível 3/5):**
  - Layout de 2 colunas para agrupar campos correlacionados lado a lado.
* **Mobile (Densidade Baixa - Nível 2/5):**
  - Layout estrito de 1 coluna, em ordem linear.
  - Labels sempre visíveis. Botões de ação ocupando largura total do viewport.

## 3. Tabela (Objetivo: Alta densidade de dados)

* **Desktop (Densidade Máxima - Nível 5/5):**
  - Formato tradicional de tabela para visualização rápida de várias colunas.
* **Mobile (Densidade Média - Nível 3/5):**
  - **Tabela Simples (até 4 colunas):** Mantém o formato de tabela tradicional no mobile se o conteúdo das linhas for legível.
  - **Tabela Complexa (mais de 4 colunas ou >20 linhas):** **NUNCA** encolher ou truncar colunas. Converta as linhas da tabela para **Lista de Cards** individuais contendo filtros e campo de busca.

## 4. Tela de Detalhes (Objetivo: Compreensão de dados e histórico)

* **Desktop (Densidade Alta - Nível 4/5):**
  - Layout de até 2 colunas lado a lado (ex: Dados à esquerda, Histórico/Observações à direita).
* **Mobile (Densidade Média - Nível 3/5):**
  - Seções empilhadas verticalmente (Dados → Histórico → Observações → Arquivos).

---

## Tabela de Escala de Densidade (1 = Muito Baixa | 5 = Muito Alta)

| Tipo de Tela | Mobile | Desktop |
| :--- | :---: | :---: |
| **Dashboard** | Nível 2 | Nível 4 |
| **Formulário**| Nível 2 | Nível 3 |
| **Detalhes**  | Nível 3 | Nível 4 |
| **Tabela**    | Nível 3 | Nível 5 |

---

## Checklist de Revisão de Densidade (Para Análise de Capturas de Tela / Code-Review)

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
