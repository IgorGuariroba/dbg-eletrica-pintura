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

/**
 * Guard legado da vinculação (`/portal/vincular`). Mantém o comportamento
 * original (não-cliente → "/"); o portal logado usa `exigirPortal` acima, que
 * redireciona membros para "/painel". Os dois fluxos são intencionalmente
 * distintos — não unificar sem revisar os dois destinos.
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

  return session!.user;
}
