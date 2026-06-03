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
      ],
      // Gate "ratchet": piso = cobertura atual. CI quebra se REGREDIR.
      // Subir estes números conforme novos testes entram, rumo a 80%.
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 69,
        statements: 78,
      },
    },
  },
});
