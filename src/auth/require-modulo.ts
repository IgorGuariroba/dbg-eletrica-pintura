import type { Modulo, Role } from "./role-detection";

export interface SessionAuthz {
  role: Role;
  modulos: Modulo[];
}

export function podeAcessarModulo(
  modulo: Modulo,
  sess: SessionAuthz | null | undefined,
): boolean {
  if (!sess) return false;
  if (sess.role === "admin_raiz") return true;
  if (sess.role !== "membro_interno") return false;
  return sess.modulos.includes(modulo);
}

export const FORBIDDEN_DIGEST_PREFIX = "FORBIDDEN_MODULO_";

export class ForbiddenError extends Error {
  readonly status = 403;
  readonly digest: string;
  constructor(public readonly modulo: Modulo) {
    super(`Acesso negado ao módulo ${modulo}`);
    this.name = "ForbiddenError";
    this.digest = `${FORBIDDEN_DIGEST_PREFIX}${modulo}`;
  }
}

export function requireModulo(
  modulo: Modulo,
  sess: SessionAuthz | null | undefined,
): asserts sess is SessionAuthz {
  if (!podeAcessarModulo(modulo, sess)) {
    throw new ForbiddenError(modulo);
  }
}
