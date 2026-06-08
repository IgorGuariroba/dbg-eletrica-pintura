# Stack de infraestrutura custo zero

Banco: Neon Postgres (512 MB free). Storage: Cloudflare R2 (10 GB free, zero egress). E-mail: Resend (3.000/mês free). Hosting: Vercel Hobby. Pagamento: Mercado Pago (sem mensalidade). Auth: Auth.js v5. WhatsApp: wa.me + Cloud API (1.000 conversas/mês free).

Decidimos assim porque: (1) DBG é microempresa, custo mensal zero é requisito; (2) Neon sobre Supabase porque Supabase pausa projeto free após 1 semana de inatividade — fatal pra DBG que pode ter semanas sem OS; (3) R2 sobre Vercel Blob porque 10 GB vs 1 GB (10x mais fotos grátis); (4) todos os serviços escalam sem trocar infra — preços baixos no tier pago.

## Considered Options

- **Supabase**: auth built-in e storage integrado, mas pausa por inatividade é deal-breaker.
- **Vercel Blob**: integração nativa, mas 1 GB é pouco pra fotos (~5.000 vs ~50.000 no R2).
- **AWS S3**: padrão de mercado, mas free tier expira em 12 meses.
