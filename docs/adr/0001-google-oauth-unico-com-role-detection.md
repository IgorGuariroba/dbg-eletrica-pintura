# Google OAuth único com role detection por banco

Todos os atores (cliente, técnico, admin) usam Google OAuth como mecanismo de autenticação. Diferenciação de role acontece por lookup no banco: e-mail cadastrado na tabela de membros → técnico/admin com módulos. Senão → cliente. Admin raiz definido via .env (único por instalação). Implementação via Auth.js v5 com Google provider.

Decidimos assim porque: (1) um mecanismo de auth elimina tela de login separada, gestão de senha e magic links; (2) role detection por banco permite gestão em runtime sem redeploy; (3) Auth.js é free e sem vendor lock-in vs Clerk que adicionaria dependência + custo futuro.

## Considered Options

- **Auth separada por role** (Google pra cliente, e-mail/senha pra interno): mais complexo, dois fluxos de manutenção.
- **Clerk**: mais rápido de implementar, mas vendor lock-in e custo após 10K MAUs.
- **Magic link**: sem senha mas exige acesso ao e-mail toda vez.

## Consequences

- Clientes sem Google acessam via link com token (sem login). Google é upgrade opcional pro portal completo.
- Técnico sem Gmail não consegue logar. Na prática, todo brasileiro tem Gmail — risco aceito.
