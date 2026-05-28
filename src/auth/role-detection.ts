export type Role = "admin_raiz" | "membro_interno" | "cliente";
export type Modulo =
  | "OPERACAO"
  | "FINANCEIRO"
  | "MARKETING"
  | "EQUIPE"
  | "GARANTIAS"
  | "CATALOGO";

export const TODOS_MODULOS: Modulo[] = [
  "OPERACAO",
  "FINANCEIRO",
  "MARKETING",
  "EQUIPE",
  "GARANTIAS",
  "CATALOGO",
];

export interface RoleResult {
  role: Role;
  modulos: Modulo[];
  isTecnico: boolean;
}

export interface MembroRecord {
  modulos: Modulo[];
  isTecnico: boolean;
  ativo: boolean;
}

export type MembroLookup = (email: string) => Promise<MembroRecord | null>;

export async function detectRole(
  email: string,
  adminEmail: string | undefined,
  lookupMembro: MembroLookup,
): Promise<RoleResult> {
  const normalized = email.toLowerCase();

  if (adminEmail && normalized === adminEmail.toLowerCase()) {
    return {
      role: "admin_raiz",
      modulos: [...TODOS_MODULOS],
      isTecnico: true,
    };
  }

  const membro = await lookupMembro(normalized);
  if (membro && membro.ativo) {
    return {
      role: "membro_interno",
      modulos: membro.modulos,
      isTecnico: membro.isTecnico,
    };
  }

  return { role: "cliente", modulos: [], isTecnico: false };
}
