# Testes de Conversão (auditoria da landing)

Rodar todos contra a landing atual. Cada um emite passa/falha + evidência + correção.

## 1. Teste dos 5 segundos (hero)

Em 5s a Sandra lê só o **H1 + botões**. O H1 sozinho tem que responder:
1. O que a empresa faz? (eletricista/pintor pra casa)
2. Pra quem? ("pra sua casa")
3. Que problema resolve? (de confiança, preço antes, garantia)
4. Qual a próxima ação? (1 CTA óbvio)

Falha se ela precisa **ler o parágrafo** pra entender = esforço demais. H1 carrega o sentido; parágrafo é bônus.

## 2. Squint test (hierarquia / funil de atenção)

Desfocar: deve saltar **1 título dominante + 1 CTA + dica de scroll**. Falha se a cor `accent` está em 10 lugares (badge, palavras do H1, ícones, KPIs, CTA) → nada salta. **Reservar o accent só pro CTA.** Hierarquia = tamanho + contraste + espaço + posição; cor é holofote, usar escasso. Um vencedor por nível. (Regra do projeto: `densidade-informacao.md` — "1 elemento dominante por seção; 1 CTA principal".)

## 3. Uma decisão por seção (escada de micro-sins)

Cada seção pede UM "sim". A maioria é **sim interno** (sem botão); só Hero e CTA final colhem a ação. Cada "sim" pequeno torna o próximo mais fácil; o clique final é o último sim pequeno.

| Seção | Decisão única | Botão? |
|---|---|---|
| Hero | "é pra mim, continuo" (+ pedir) | 1 CTA |
| Empatia | "me entendem, baixo a guarda" | não |
| Diferenciais | "resolvem meu medo" | não |
| Como funciona | "é simples, eu consigo" | não |
| Serviços | "fazem o MEU problema" | não |
| Portfólio | "trabalho é bom de verdade" | não |
| Equipe | "têm rosto, dá pra confiar" | não |
| Avaliações | "outras como eu confiaram" | não |
| FAQ | "minha última dúvida caiu" | não |
| CTA final | "pedir orçamento agora" | 1 CTA |

## 4. Teste do escaneamento

Ela escaneia, não lê. Lendo **só títulos/subtítulos/botões**, a página faz sentido e fecha no CTA? Falha se títulos são **rótulos** ("O que dizem", "Conheça nossa equipe", "Elétrica") em vez de **mensagens**. Todo título vira mensagem na voz dela: "O que dizem"→"Quem já confiou e deu certo"; "Conheça nossa equipe"→"Conheça quem vai entrar na sua casa".

## 5. Teste do scroll

O fim de cada seção deve levantar a **próxima pergunta** que a seção seguinte responde. Valida a ORDEM:
```
Hero "de confiança" → prova! → Empatia/Diferenciais
Diferenciais → "como na prática?" → Como funciona
Como funciona → "fazem o meu?" → Serviços
Serviços → "trabalho é bom?" → Portfólio
Portfólio → "quem faz?" → Equipe
Equipe → "outros confiaram?" → Avaliações
Avaliações → "última dúvida..." → FAQ
FAQ → "como peço?" → CTA
```
Onde a fronteira não dispara a pergunta certa, a ordem está errada. (Erro atual: Portfólio antes de Serviços; Como funciona fora de lugar; falta Empatia e FAQ.)

## 6. Teste do CTA

Contar CTAs. O erro não é o número, é a **variedade**: repetir "Pedir orçamento" 5x é bom; misturar pedir + ver serviços + WhatsApp + ver técnico + ver todos = 5 decisões = dispersa. **Uma ação primária repetida** ("Pedir orçamento grátis"); WhatsApp = secundário único; o resto perde estilo de botão.
