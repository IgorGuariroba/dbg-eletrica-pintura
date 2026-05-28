import { auth } from "@/auth";
import { requireModulo } from "@/auth/require-modulo";

export async function exigirCatalogo() {
  const session = await auth();
  requireModulo("CATALOGO", session?.user ?? null);
}
