import { expect, test } from "@playwright/test";

test.describe("Slice 1 — smoke", () => {
  test("home renderiza heading + botão de login", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "DBG Elétrica e Pintura" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Entrar com Google/i })).toBeVisible();
  });

  test("manifest.webmanifest válido", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("DBG Elétrica e Pintura");
    expect(body.display).toBe("standalone");
    expect(body.theme_color).toBe("#0a0a0a");
    expect(Array.isArray(body.icons)).toBe(true);
    expect(body.icons.length).toBeGreaterThanOrEqual(2);
  });

  test("metadata aponta pro manifest", async ({ page }) => {
    await page.goto("/");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href).toBe("/manifest.webmanifest");
  });

  test("Auth.js provider Google registrado", async ({ request }) => {
    const res = await request.get("/api/auth/providers");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.google).toBeDefined();
    expect(body.google.type).toBe("oidc");
  });

  test("signin Google retorna redirect pra accounts.google.com", async ({ request }) => {
    const res = await request.get("/api/auth/signin/google", { maxRedirects: 0 });
    expect([302, 303, 307]).toContain(res.status());
    expect(res.headers()["location"] ?? "").toContain("accounts.google.com");
  });
});
