# DBG Elétrica e Pintura

Plataforma de gestão e contratação de serviços (elétrica, pintura, drywall).

## Setup

```bash
pnpm install
cp .env.example .env.local   # preencher (ver .env.example)
pnpm db:push                 # cria schema no Neon
pnpm dev
```

## Comandos

```bash
pnpm dev           # next dev --turbopack
pnpm build         # next build
pnpm lint          # eslint
pnpm typecheck     # tsc --noEmit
pnpm test          # testes
pnpm db:generate   # cria migration a partir do schema
pnpm db:migrate    # aplica migrations
pnpm db:push       # sync direto (dev)
pnpm db:studio     # UI do Drizzle
```
