import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/unit/**/*.test.tsx",
      "tests/integration/**/*.test.ts",
    ],
    globals: false,
    // Redireciona o driver Neon ao proxy local quando NEON_LOCAL_PROXY existe
    // (CI/docker); no-op caso contrário. Roda antes de cada arquivo de teste.
    setupFiles: ["./tests/setup/neon-proxy.ts", "./tests/setup/db-reset.ts"],
    // Varre lixo de seeds de runs anteriores antes de spawnar os workers,
    // evitando que a janela `limit` da fila caia em OS órfãs (ver global-setup).
    globalSetup: ["./tests/integration/global-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      // Mede só a camada de LÓGICA (domínio, repos, regras, libs).
      // A camada de UI/rotas (.tsx, app/, components/) é coberta por
      // Playwright (test:e2e), não por unit test — incluí-la aqui só
      // diluiria o número sem valor.
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.ts",
        // Componentes/UI React — cobertos via e2e.
        "src/**/*.tsx",
        "src/app/**", // route handlers, server actions finos (orquestração)
        "src/components/**",
        "src/hooks/**", // React hooks
        // Config de auth (NextAuth) — não unit-testável.
        "src/auth.ts",
        "src/auth-handlers.ts",
        // Portas (interfaces puras): só `export interface/type`, sem runtime.
        // 0% nelas é artefato de medição — não há o que executar.
        // (exceções com lógica real ficam de fora desta lista de propósito:
        //  features/campo/execucao-repo.ts e operacao/campo-repo.ts.)
        "src/equipe/membro-repo.ts",
        "src/cliente/vinculacao-repo.ts",
        "src/pagamento/pagamento-repo.ts",
        "src/pagamento/gateway.ts",
        "src/assinatura/assinatura-repo.ts",
        "src/assinatura/gateway.ts",
        "src/portal/historico-repo.ts",
        "src/catalogo/servico-repo.ts",
        "src/operacao/config-repo.ts",
        "src/operacao/presenca-repo.ts",
        "src/operacao/aprovacao-repo.ts",
        "src/operacao/fila-repo.ts",
        "src/operacao/transicao-repo.ts",
        "src/operacao/reativacao-repo.ts",
        "src/operacao/solicitacao-repo.ts",
        "src/operacao/orcamento-repo.ts",
        "src/operacao/cobertura-repo.ts",
        "src/operacao/garantia/garantia-repo.ts",
        "src/marketing/portfolio-repo.ts",
        // Adapters de I/O externo (SDKs Mercado Pago / R2-S3): fronteira,
        // testados via e2e/integração, não unit.
        "src/pagamento/mercadopago-client.ts",
        "src/assinatura/mercadopago-assinatura.ts",
        "src/catalogo/r2-client.ts",
        "src/marketing/copiador-r2.ts",
        // Orquestração de sync offline do PWA: usa APIs de browser
        // (FileReader/IndexedDB), não roda no ambiente node do vitest.
        "src/features/campo/sync-runner.ts",
        // Script de migração one-off (executado à mão, não é runtime de app).
        "src/db/migrate-slugs.ts",
        // Bypass de auth dev-only (duplo gate, inerte em produção).
        "src/auth/dev-bypass.ts",
        // Wiring do proxy Neon local (CI/docker), inerte em produção.
        "src/db/neon-local-proxy.ts",
      ],
      // Gate "ratchet": piso = cobertura que o CI mede de fato. CI quebra se
      // REGREDIR. Subir conforme novos testes entram.
      //
      // Os testes contra R2 real (documentos-pdf-r2, notificacao-email) skipam
      // no CI (sem credenciais R2 — são e2e/local-only), o que reduz ~3pts em
      // relação a um run local com .env.local. Estes pisos refletem o baseline
      // determinístico do CI (~81/73/84/83), não o número inflado local.
      thresholds: {
        lines: 82,
        functions: 82,
        branches: 72,
        statements: 80,
      },
    },
  },
});
