# Next.js CLI como Assistente de Diagnóstico em Tempo Real

Durante o desenvolvimento, a CLI do Next.js deve ser utilizada como uma ferramenta de auditoria contínua e assistente de diagnóstico em tempo real antes de realizar cada commit.

## Diretrizes de Auditoria Contínua:

1. **Uso do `--turbo`**:
   - Utilize a flag `--turbo` (ou o comando `pnpm dev --turbopack`) para acelerar as compilações e economizar tempo de espera durante o desenvolvimento.

2. **Linting de Código**:
   - Execute o comando de lint (ex: `pnpm lint`) antes de cada commit para garantir que o código está limpo, sem avisos (warnings) ou erros, e aderindo aos padrões do projeto.

3. **Validação do Build Local**:
   - Sempre execute o build local (`pnpm build`) antes de dar qualquer tarefa como concluída. 
   - Acompanhe o output do build para auditar o comportamento de renderização e verificar se as páginas foram compiladas corretamente como estáticas ou dinâmicas, de acordo com o planejado.
