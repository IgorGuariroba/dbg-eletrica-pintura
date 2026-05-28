import { auth } from "@/auth";
import { requireModulo } from "@/auth/require-modulo";

export async function exigirEquipe() {
  const session = await auth();
  requireModulo("EQUIPE", session?.user ?? null);
  return session!;
}
