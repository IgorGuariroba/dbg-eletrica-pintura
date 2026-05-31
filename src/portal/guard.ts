import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Exige que a sessão ativa seja de um cliente.
 * Se o cliente logado não possuir um WhatsApp vinculado, redireciona-o para a página de vinculação.
 */
export async function exigirCliente() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login" as any);
  }
  
  if (session.user.role !== "cliente") {
    redirect("/" as any);
  }

  if (!session.user.whatsapp) {
    redirect("/portal/vincular" as any);
  }

  return session.user;
}
