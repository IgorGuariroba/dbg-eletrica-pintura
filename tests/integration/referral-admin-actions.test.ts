import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { ForbiddenError } from "@/auth/require-modulo";
import { salvarConfigReferralAction } from "@/app/admin/marketing/referral/actions";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("Referral Admin Actions Integration (Slice 6)", () => {
  beforeEach(async () => {
    if (schema.configReferral) {
      await db.delete(schema.configReferral);
    }
  });

  afterEach(async () => {
    if (schema.configReferral) {
      await db.delete(schema.configReferral);
    }
  });

  it("deve lancar ForbiddenError se o usuario nao tiver o modulo MARKETING", async () => {
    const { auth } = await import("@/auth");

    vi.mocked(auth).mockResolvedValue({
      user: {
        role: "membro_interno",
        modulos: ["FINANCEIRO"],
      },
    } as any);

    const formData = new FormData();
    formData.append("ativo", "true");
    formData.append("valorPremio", "45.00");

    await expect(salvarConfigReferralAction({}, formData)).rejects.toThrow(ForbiddenError);
  });

  it("deve salvar a configuracao com sucesso se o usuario for MARKETING", async () => {
    const { auth } = await import("@/auth");

    vi.mocked(auth).mockResolvedValue({
      user: {
        role: "membro_interno",
        modulos: ["MARKETING"],
      },
    } as any);

    const formData = new FormData();
    formData.append("ativo", "true");
    formData.append("valorPremio", "45.00");

    const res = await salvarConfigReferralAction({}, formData);
    expect(res.ok).toBe(true);

    const [config] = await db
      .select()
      .from(schema.configReferral)
      .where(eq(schema.configReferral.id, "default"))
      .limit(1);

    expect(config).toBeDefined();
    expect(config.ativo).toBe(true);
    expect(config.valorPremio).toBe("45.00");
  });

  it("deve desativar a configuracao e salvar valor com sucesso", async () => {
    const { auth } = await import("@/auth");

    vi.mocked(auth).mockResolvedValue({
      user: {
        role: "membro_interno",
        modulos: ["MARKETING"],
      },
    } as any);

    const formData = new FormData();
    formData.append("ativo", "false");
    formData.append("valorPremio", "20.00");

    const res = await salvarConfigReferralAction({}, formData);
    expect(res.ok).toBe(true);

    const [config] = await db
      .select()
      .from(schema.configReferral)
      .where(eq(schema.configReferral.id, "default"))
      .limit(1);

    expect(config).toBeDefined();
    expect(config.ativo).toBe(false);
    expect(config.valorPremio).toBe("20.00");
  });
});
