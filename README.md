# DBG Elétrica e Pintura

Plataforma de gestão e contratação de serviços (elétrica, pintura, drywall). Next.js 16 App Router (PWA) + Neon Postgres + Auth.js v5 + Cloudflare R2.

## Stack

- **Next.js 16** App Router + TypeScript + Tailwind v4
- **PWA**: Serwist (`@serwist/next`) + manifest + ícones
- **Banco**: Neon Postgres + Drizzle ORM
- **Auth**: Auth.js v5 + Google OAuth + role detection
- **Storage**: Cloudflare R2 (público + privado)
- **Deploy**: Vercel

## Setup

```bash
pnpm install
cp .env.example .env.local   # preencher
pnpm db:push                  # cria schema no Neon
pnpm dev
```

## Configuração do Cloudflare R2 (CORS)

Como o upload de fotos é feito diretamente do navegador do cliente para o Cloudflare R2 usando URLs assinadas, ambos os buckets (`dbg-public` e `dbg-private`) precisam ter uma política de **CORS** configurada para permitir requisições de origem cruzada (CORS) a partir do seu domínio local e de produção.

### Passo a passo para configurar no painel da Cloudflare:

1. Acesse o **Cloudflare Dashboard** -> **R2** -> **Buckets**.
2. Selecione o bucket (faça isso para `dbg-private` e `dbg-public`).
3. Vá na aba **Settings** (Configurações).
4. Role até a seção **CORS Policy** e clique em **Add CORS policy** (ou Edit).
5. Cole a seguinte configuração JSON (ajustando os domínios se necessário):

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://dbg-eletrica-pintura.vercel.app"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3000
  }
]
```

6. Salve as alterações.

## Variáveis de ambiente

Ver [`.env.example`](.env.example). Resumo:

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | Connection string Neon (`?sslmode=require`) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth (Cloud Console → Credentials) |
| `ADMIN_EMAIL` | E-mail Google do admin raiz (Diego) — recebe todos os módulos + flag técnico |
| `R2_PUBLIC_*` | Bucket público (catálogo, perfil técnico) |
| `R2_PRIVATE_*` | Bucket privado (fotos antes/depois de OS) |

## Role detection

No callback `signIn`/`jwt` (`src/auth.ts`):

1. `email === ADMIN_EMAIL` → `role=admin_raiz`, todos os módulos, `isTecnico=true`.
2. E-mail está em `membro` e ativo → `role=membro_interno`, módulos do banco, `isTecnico` da flag.
3. Caso contrário → `role=cliente`.

A session JWT inclui `role`, `modulos`, `isTecnico`.

## Schema inicial

Tabelas (`src/db/schema.ts`):

- `cliente`, `membro`, `servico`
- `solicitacao`, `ordem_servico`
- `orcamento`, `orcamento_item`

Enums: `categoria_servico`, `unidade_medida`, `tipo_os`, `estado_os`, `modulo`.

## Comandos

```bash
pnpm dev           # next dev --turbopack
pnpm build         # next build
pnpm typecheck     # tsc --noEmit
pnpm db:generate   # cria migration a partir do schema
pnpm db:migrate    # aplica migrations
pnpm db:push       # sync direto (dev)
pnpm db:studio     # UI do Drizzle
```

## Estrutura

```
src/
  app/              # Next.js App Router (rotas, layout, sw.ts)
  auth.ts           # Auth.js v5 config
  db/               # Drizzle client + schema
  catalogo/         # bounded context (CONTEXT.md + futuro código)
  equipe/
  financeiro/
  marketing/
  notificacao/
  operacao/
  portal/
```

Cada `src/<contexto>/CONTEXT.md` define linguagem ubíqua daquele bounded context.

## Workflow

Ver `.claude/CLAUDE.md` — branch por feature, code-review obrigatório, PR pro `main`.
