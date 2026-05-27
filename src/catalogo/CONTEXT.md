# Catálogo

Tabela de serviços pré-cadastrados com preços fixos. Fonte de verdade para orçamentos, landing pages e garantias. Admin (módulo Catálogo) gerencia; técnico consome no PWA offline.

## Language

**Serviço**:
Item vendável com preço fixo. Pertence a uma **Categoria**. Tem preço base, unidade de medida e prazo de garantia. Pode estar ativo ou inativo.
_Avoid_: Produto, item, oferta

**Categoria**:
Agrupador flat de **Serviços**. Três categorias iniciais: Elétrica, Pintura, Drywall. Sem hierarquia — sem subcategorias.
_Avoid_: Tipo, grupo, departamento

**Unidade de Medida**:
Define como o preço base é multiplicado no orçamento. Valores: por ponto, por m², por hora. Cada **Serviço** tem exatamente uma.
_Avoid_: Métrica, fator, base de cálculo

**Preço Base**:
Valor unitário do **Serviço**. Fixo, definido pelo admin. Técnico não inventa preço — seleciona serviço e quantidade. Total = preço base × quantidade.
_Avoid_: Tarifa, taxa, valor sugerido

**Prazo de Garantia**:
Meses de garantia de mão de obra por **Serviço**. Definido pelo admin. Ex: Elétrica 12 meses, Pintura 6 meses. Herdado pela OS ao concluir.
_Avoid_: Cobertura, warranty period

**Checklist Preventivo**:
Lista de itens de verificação por **Categoria**, usada em OS Preventiva. Admin define itens padrão (ex: Elétrica → verificar disjuntores, testar tomadas). Técnico segue + adiciona observações.
_Avoid_: Roteiro, protocolo, script de vistoria

## Relationships

- **Catálogo → Operação**: orçamento seleciona Serviços como itens (preço base × quantidade = total)
- **Catálogo → Financeiro**: assinante recebe desconto sobre Preço Base
- **Catálogo → Marketing**: landing pages geradas a partir de Serviços ativos
- **Catálogo → Operação (garantia)**: OS herda Prazo de Garantia do Serviço ao concluir

## Example Dialogue

> **Dev**: O técnico pode dar desconto no preço de um serviço?
>
> **Domain Expert**: Não. Preço Base é fixo, definido pelo admin no Catálogo. Técnico seleciona serviço e quantidade, total é calculado. Desconto só vem de Plano de Assinatura — e é automático, não negociável.
>
> **Dev**: E se um serviço de pintura tem variações (pintura interna vs externa)?
>
> **Domain Expert**: São dois Serviços separados no Catálogo, cada um com seu preço. Sem pricing engine, sem variações dentro de um serviço.
