import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { destinoPortal } from "./destino";

/**
 * Exige que a sessão ativa seja de um cliente.
 * Se o cliente logado não possuir um WhatsApp vinculado, redireciona-o para a página de vinculação.
 */
export async function exigirPortal() {
  const session = await auth();
  const destino = destinoPortal(session);
  if (destino) redirect(destino as any);
  return session!.user;
}
