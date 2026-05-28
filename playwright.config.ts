import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: process.env.CI
      ? `next build --webpack && next start --port ${PORT}`
      : `next dev --webpack --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      AUTH_TRUST_HOST: "true",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "ci-secret-ci-secret-ci-secret-ci-secret",
      AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID ?? "ci-id",
      AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET ?? "ci-secret",
      ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "admin@dbg.test",
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgres://ci:ci@localhost:5432/ci?sslmode=disable",
    },
  },
});
