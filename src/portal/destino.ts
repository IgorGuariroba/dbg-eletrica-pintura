export type PortalSession = {
  user?: {
    role?: string | null;
    whatsapp?: string | null;
  } | null;
} | null;

export function destinoPortal(session: PortalSession) {
  if (!session?.user) return "/login";
  if (session.user.role !== "cliente") return "/painel";
  if (!session.user.whatsapp) return "/portal/vincular";
  return null;
}
