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
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globals: false,
    // Varre lixo de seeds de runs anteriores antes de spawnar os workers,
    // evitando que a janela `limit` da fila caia em OS órfãs (ver global-setup).
    globalSetup: ["./tests/integration/global-setup.ts"],
  },
});
