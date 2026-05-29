import { auth } from "@/auth";
import { requireModulo } from "@/auth/require-modulo";

export async function exigirOperacao() {
  const session = await auth();
  requireModulo("OPERACAO", session?.user ?? null);
}
