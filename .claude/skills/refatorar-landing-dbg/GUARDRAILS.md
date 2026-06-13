# Guardrails de Claim (integridade)

Regra mãe: **copy só promete o que produto + operação entregam de verdade.** Claim falsa mata a confiança da Sandra — exatamente o oposto do objetivo. Verificar no código/domínio ANTES de escrever. Toda claim abaixo já apareceu na landing e é PROIBIDA até virar verdade entregue.

## Claims proibidas (caçar e remover/corrigir)

| Claim proibida | Por quê | Usar no lugar |
|---|---|---|
| **"preço fixo"** | Preço do catálogo é base/referência; final sai de orçamento. Claim falsa, banida pelo dono (2026-06-11), risco CDC. | "preço **justo**", "você aprova antes", "sem cobrança extra no final" |
| **"antecedente verificado" / "selo de verificação"** | NÃO existe no código — `membro-repo` só tem `fotoUrl`, `bio`, `especialidades`. Sem campo de verificação/antecedente. | "técnico **identificado** / com nome, foto e avaliação" |
| **"preço imutável" / "preço nunca muda"** | Orçamento complementar existe (serviço extra achado na hora). Vai por aprovação, mas o valor pode somar. | "o que você aprovar é o que paga; extra só com sua aprovação" |
| **KPI fabricado ("15k+ atendimentos", "4.9/5")** | `hero.tsx` chumba esses números como fallback quando não há dado real (`osConcluidas > 0 ? real : "15k+"`). Inventa prova social. | mostrar métrica real ou esconder (como `diferenciais.tsx` já faz abaixo de 10 OS / 3 avaliações) |

## Como auditar no código

```bash
# claim de preço fixo na copy pública
grep -rniE "preço fixo|preco fixo" src/app src/marketing

# verificação de técnico (deve NÃO existir como entrega)
grep -rniE "verifica|antecedent|selo" src/equipe/membro-repo.ts

# KPI fabricado (fallback chumbado)
grep -nE "15k|4\.9|: \"[0-9]" src/app/_landing/hero.tsx
```

## Claims VERDADEIRAS a explorar (entregues de fato)

- **"Sem adiantamento — paga só na conclusão"** (Pagamento no Local). Verdade estrutural que mata o trauma "pediu adiantado e sumiu". Killer honesto.
- **Garantia formal + certificado PDF** — existe.
- **Fotos antes/depois no WhatsApp** — existe (PWA obrigatório).
- **Técnico com nome, foto, bio, avaliação** — existe.
- **Orçamento aprovado antes (assinatura digital)** — existe.

Quando uma claim hoje proibida virar entrega real (ex: implementar verificação de antecedentes), atualizar esta tabela.
