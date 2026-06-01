let cached: string | null = null;

export function obrigatorioAdminEmail(): string {
  if (cached) return cached;
  const v = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!v) {
    throw new Error(
      "ADMIN_EMAIL não configurada — variável obrigatória pro role-detection",
    );
  }
  cached = v;
  return cached;
}
