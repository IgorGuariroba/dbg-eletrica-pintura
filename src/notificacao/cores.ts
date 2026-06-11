/**
 * Espelho dos tokens semânticos de `src/app/globals.css` convertidos de oklch → sRGB hex.
 *
 * React Email (HTML de e-mail) e React PDF renderizam fora do browser e NÃO têm acesso
 * às CSS custom properties (`var(--primary)` etc.). Por isso os valores precisam ser
 * hardcodeados aqui — mas devem permanecer fiéis aos tokens. Ao alterar um token em
 * globals.css, reconverter e atualizar o valor correspondente abaixo.
 */
export const CORES = {
  fundo: "#FFFFFF", // --background / --card
  texto: "#111111", // --foreground
  primaria: "#3CAAF0", // --primary
  primariaTexto: "#FFFFFF", // --primary-foreground
  mutedBg: "#ECF3F9", // --muted / --secondary
  mutedTexto: "#616E78", // --muted-foreground
  acento: "#FF6900", // --accent
  borda: "#E2E8F0", // --border
  destrutiva: "#EF4444", // --destructive
} as const;
