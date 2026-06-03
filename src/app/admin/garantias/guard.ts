import { auth } from "@/auth";
import { requireModulo } from "@/auth/require-modulo";

export async function exigirGarantias() {
  const session = await auth();
  requireModulo("GARANTIAS", session?.user ?? null);
  return session!.user;
}
