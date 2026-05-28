import type { Role } from "@/auth/role-detection";

export interface BloqueioAdminInput {
  emailTentado: string;
  emailAlvoAtual?: string;
  editorRole: Role;
  adminEmail: string;
}

export type BloqueioAdminResultado =
  | { tipo: "ok" }
  | { tipo: "alvo_eh_admin"; mensagem: string }
  | { tipo: "tentando_virar_admin"; mensagem: string };

const norm = (s: string) => s.trim().toLowerCase();

export function avaliarBloqueioAdmin({
  emailTentado,
  emailAlvoAtual,
  editorRole,
  adminEmail,
}: BloqueioAdminInput): BloqueioAdminResultado {
  const admin = norm(adminEmail);
  if (!admin) return { tipo: "ok" };
  const ehAdmin = editorRole === "admin_raiz";

  if (emailAlvoAtual && norm(emailAlvoAtual) === admin && !ehAdmin) {
    return {
      tipo: "alvo_eh_admin",
      mensagem: "apenas o admin raiz pode editar o próprio cadastro",
    };
  }

  if (norm(emailTentado) === admin && !ehAdmin) {
    return {
      tipo: "tentando_virar_admin",
      mensagem: "e-mail reservado ao admin raiz",
    };
  }

  return { tipo: "ok" };
}
