export const WHATSAPP_NUMERO = process.env.NEXT_PUBLIC_WHATSAPP ?? "5511999999999";

/**
 * Texto público da área de cobertura (fallback quando não há bairros
 * cadastrados). Sobrescrever via env na Vercel com a região real.
 */
export const REGIAO_ATENDIMENTO =
  process.env.NEXT_PUBLIC_REGIAO_ATENDIMENTO ?? "São Paulo e região";

export function urlWhatsApp(mensagem?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMERO}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}
