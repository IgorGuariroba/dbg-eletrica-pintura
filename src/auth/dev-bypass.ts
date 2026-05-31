import type { Session } from "next-auth";
import { detectRole, type MembroLookup } from "./role-detection";

/**
 * ⚠️ SOMENTE DESENVOLVIMENTO/TESTE — NUNCA PRODUÇÃO.
 *
 * Gera uma sessão sintética para validar rotas privadas (admin, PWA) sem
 * passar pelo Google OAuth. Blindado por DUPLO gate, ambos obrigatórios:
 *
 *   1. `process.env.NODE_ENV !== "production"`  → inerte em qualquer deploy
 *      (Vercel/produção sempre define NODE_ENV=production).
 *   2. `process.env.DEV_BYPASS_EMAIL` definido   → opt-in explícito por ambiente.
 *
 * O papel e os módulos vêm do `detectRole` real: a sessão sintética respeita
 * `ADMIN_EMAIL` e a tabela `membro` — não inventa permissões.
 *
 * Para ativar localmente, defina em `.env.local` (NUNCA em `.env` versionado):
 *   DEV_BYPASS_EMAIL=dono@dbg.com.br
 */
export function devBypassAtivo(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    Boolean(process.env.DEV_BYPASS_EMAIL)
  );
}

let avisado = false;

export async function sessaoDevBypass(
  adminEmail: string | undefined,
  lookup: MembroLookup,
): Promise<Session | null> {
  if (!devBypassAtivo()) return null;

  const email = process.env.DEV_BYPASS_EMAIL as string;
  if (!avisado) {
    console.warn(
      `\n⚠️  AUTH DEV BYPASS ATIVO — sessão sintética para ${email}. ` +
        `Jamais deve aparecer em produção.\n`,
    );
    avisado = true;
  }

  const detected = await detectRole(email, adminEmail, lookup);
  return {
    user: {
      email,
      name: "Dev Bypass",
      role: detected.role,
      modulos: detected.modulos,
      isTecnico: detected.isTecnico,
    },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  } as Session;
}
