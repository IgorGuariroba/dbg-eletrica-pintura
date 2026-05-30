export interface Dimensoes {
  largura: number;
  altura: number;
}

/**
 * Calcula as dimensões de destino limitando o lado maior a `max`, preservando
 * a proporção. Nunca amplia: imagens menores que `max` ficam intactas.
 */
export function calcularDimensoesFoto(
  largura: number,
  altura: number,
  max: number,
): Dimensoes {
  const ladoMaior = Math.max(largura, altura);
  if (ladoMaior <= max) return { largura, altura };
  const fator = max / ladoMaior;
  return {
    largura: Math.round(largura * fator),
    altura: Math.round(altura * fator),
  };
}

export const QUALIDADE_JPEG = 0.8;
export const LADO_MAXIMO = 1600;

export interface FotoComprimida {
  blob: Blob;
  largura: number;
  altura: number;
  /** Tamanho final em bytes (para exibir ao técnico). */
  bytes: number;
}

/**
 * Comprime um arquivo de imagem no browser: redimensiona via canvas para no
 * máximo {@link LADO_MAXIMO}px no lado maior e re-codifica como JPEG a
 * {@link QUALIDADE_JPEG}. Só roda no cliente (usa Image/canvas/Blob).
 */
export async function comprimirFoto(
  arquivo: Blob,
  max = LADO_MAXIMO,
  qualidade = QUALIDADE_JPEG,
): Promise<FotoComprimida> {
  const bitmap = await createImageBitmap(arquivo);
  const { largura, altura } = calcularDimensoesFoto(
    bitmap.width,
    bitmap.height,
    max,
  );

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d indisponível");
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", qualidade),
  );
  if (!blob) throw new Error("falha ao codificar JPEG");

  return { blob, largura, altura, bytes: blob.size };
}
