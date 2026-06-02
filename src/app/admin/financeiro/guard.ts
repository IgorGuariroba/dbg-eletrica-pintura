import { auth } from "@/auth";
import { requireModulo } from "@/auth/require-modulo";

export async function exigirFinanceiro() {
  const session = await auth();
  requireModulo("FINANCEIRO", session?.user ?? null);
}
