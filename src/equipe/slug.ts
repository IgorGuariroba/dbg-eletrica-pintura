/**
 * Gera um slug kebab-case e garante sua unicidade consultando a função existeSlug.
 */
export async function gerarSlugUnico(
  nome: string,
  existeSlug: (slug: string) => Promise<boolean>,
): Promise<string> {
  // 1. Normaliza o nome para kebab-case sem acentos e caracteres especiais
  const normalized = nome
    .normalize("NFD") // Decompõe acentos (ex: João -> Jo~ao)
    .replace(/[\u0300-\u036f]/g, "") // Remove marcas de acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // Substitui sequências não alfanuméricas por hifens
    .replace(/^-+|-+$/g, ""); // Remove hífens sobressalentes no início e fim

  const baseSlug = normalized || "tecnico";

  let slug = baseSlug;
  let counter = 1;

  // 2. Resolve colisões incrementando um sufixo numérico
  while (await existeSlug(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
