import { expect, test } from "@playwright/test";

test.describe("Smoke", () => {
  test("home renderiza landing pública com CTA", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: /Serviço transparente, com preço fixo e garantia/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Solicitar orçamento/i }).first(),
    ).toBeVisible();
  });

  test("login expõe botão Google", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("button", { name: /Entrar com Google/i }),
    ).toBeVisible();
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

});
