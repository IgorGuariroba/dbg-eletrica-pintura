---
name: refatorar-landing-dbg
description: Refatora a landing page da DBG (src/app/page.tsx + _landing/*) orientada à persona P1, com copy na voz do cliente, testes de conversão e guardrails de claim. Use ao melhorar/reescrever a landing, revisar copy/hero/CTA/seções, ou quando o usuário falar em conversão, persona, dores do cliente, ou "tornar a landing mais convincente".
---

# Refatorar a Landing da DBG

Procedimento auditável: dado o estado atual da landing, gera e executa um plano de refatoração seção a seção, orientado à persona P1 ("Sandra"), na voz do cliente, validado por testes de conversão e guardrails de integridade.

## Passo 0 — Carregar contexto (obrigatório, não pular)

Ler os arquivos de memória do projeto (em `~/.claude/projects/-home-movida-projetos-dbg/memory/`). São a fonte de verdade da persona — NÃO re-derivar:

- `project-persona-landing.md` — quem é (P1, residencial família, foco volume)
- `project-dores-persona.md` — 7 medos (gancho)
- `project-desejos-persona.md` — 7 sonhos (promessa)
- `project-objecoes-persona.md` — 10 "sim, mas..." (prova perto do CTA)
- `project-linguagem-persona.md` — Voice of Customer (palavras dela)
- `project-beneficios-persona.md` — característica→benefício ("E daí?")
- `project-servicos-buscados-persona.md` — termos que ela googla
- `project-posicionamento-landing.md` — inimigo = marido de aluguel que some

Depois ler a landing atual: `src/app/page.tsx` e todos os `src/app/_landing/*.tsx`.

## Passo 1 — Auditar o estado atual

Rodar os 6 testes de [TESTES-CONVERSAO.md](TESTES-CONVERSAO.md) contra a landing atual e emitir um relatório por teste (passa/falha + evidência):
1. Teste dos 5 segundos (hero responde 4 perguntas?)
2. Squint test (1 dominante + 1 CTA + dica de scroll por nível?)
3. Uma decisão por seção (cada seção pede 1 só "sim"?)
4. Teste do escaneamento (títulos vendem sozinhos?)
5. Teste do scroll (cada seção abre a próxima pergunta? ordem certa?)
6. Teste do CTA (uma ação repetida, não 5 destinos?)

## Passo 2 — Checar guardrails de integridade

Rodar [GUARDRAILS.md](GUARDRAILS.md): caçar claim proibida no código (preço fixo, antecedente verificado, preço imutável, KPI fabricado). Toda claim só entra se a operação/produto entrega de verdade. Verificar no código antes de prometer.

## Passo 3 — Gerar o plano seção a seção

Para CADA seção, produzir:
- **Decisão única** que ela deve tomar (ver tabela em TESTES-CONVERSAO.md).
- **Dor → desejo → objeção** que a seção endereça (dos arquivos de memória).
- **Copy nova na voz da Sandra** (aplicar [PRINCIPIOS-COPY.md](PRINCIPIOS-COPY.md): benefício não característica, PAS, mostrar-não-dizer).
- **Ajuste de hierarquia/CTA** (1 dominante, accent só no CTA).
- **Ordem** das seções pela escada de micro-sins.

Estrutura-alvo: Hero → Empatia → Diferenciais → Como funciona → Serviços → Portfólio → Equipe → Avaliações → FAQ → CTA final.

## Passo 4 — Executar no flow de UI obrigatório

Seguir o fluxo do projeto (CLAUDE.md §2): **Builder → UX Reviewer → Frontend Reviewer → Refactor**. Só componentes shadcn/ui, tokens semânticos, sem cor bruta. Validação visual com **Playwright MCP** nas 4 resoluções (390/768/1366/1920): sem scroll horizontal, imagens 200, fluxos reais exercitados. Rodar `pnpm lint && pnpm typecheck && pnpm test && pnpm build` + análise Fallow (§3.1) antes do PR.

## Regra de ouro

Copy não resolve o problema — produto + operação resolvem; copy comunica. **Só prometer o que é entregue.** Toda frase tem que caber num áudio de WhatsApp da Sandra pra comadre — se não cabe, é marketing, reescreve.
