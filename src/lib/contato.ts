export const WHATSAPP_NUMERO = process.env.NEXT_PUBLIC_WHATSAPP ?? "5511999999999";

export function urlWhatsApp(mensagem?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMERO}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}
