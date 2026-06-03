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
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.{ts,tsx}",
        // Primitivos shadcn/ui — não testados por unidade.
        "src/components/ui/**",
        // RSC pages/layouts — cobertos via Playwright (test:e2e), não unit.
        "src/app/**/layout.tsx",
        "src/app/**/page.tsx",
      ],
      // Gate "ratchet": piso = cobertura atual. CI quebra se REGREDIR.
      // Subir estes números conforme novos testes entram, rumo a 80%.
      thresholds: {
        lines: 40,
        functions: 39,
        branches: 33,
        statements: 40,
      },
    },
  },
});
