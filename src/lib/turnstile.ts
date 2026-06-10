const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface VerificacaoTurnstile {
  valido: boolean;
}

/**
 * Valida o token do widget Turnstile no siteverify da Cloudflare.
 * Sem TURNSTILE_SECRET_KEY configurada o captcha fica desligado (dev/test):
 * tudo passa. Com a secret, token ausente ou reprovado bloqueia.
 */
export async function verificarTurnstile(
  token: string | null,
  deps?: { secret?: string; ip?: string; fetchFn?: typeof fetch },
): Promise<VerificacaoTurnstile> {
  const secret = deps?.secret ?? process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { valido: true };
  if (!token) return { valido: false };

  const fetchFn = deps?.fetchFn ?? fetch;
  const body = new URLSearchParams({ secret, response: token });
  if (deps?.ip) body.set("remoteip", deps.ip);

  try {
    const res = await fetchFn(SITEVERIFY_URL, { method: "POST", body });
    if (!res.ok) return { valido: false };
    const json = (await res.json()) as { success?: boolean };
    return { valido: json.success === true };
  } catch {
    // Indisponibilidade da Cloudflare não pode derrubar o formulário público.
    return { valido: true };
  }
}
