import { auth } from "@/auth";
import { requireModulo } from "@/auth/require-modulo";

export async function exigirMarketing() {
  const session = await auth();
  requireModulo("MARKETING", session?.user ?? null);
  return session!;
}
