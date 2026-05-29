import { z } from "zod";
import type { EnderecoCep } from "./cep";

const nominatimSchema = z.object({
  address: z
    .object({
      road: z.string().optional(),
      pedestrian: z.string().optional(),
      suburb: z.string().optional(),
      neighbourhood: z.string().optional(),
      city_district: z.string().optional(),
      city: z.string().optional(),
      town: z.string().optional(),
      village: z.string().optional(),
      municipality: z.string().optional(),
      state: z.string().optional(),
      "ISO3166-2-lvl4": z.string().optional(),
      postcode: z.string().optional(),
    })
    .optional(),
  error: z.string().optional(),
});

export class LocalizacaoIndisponivelError extends Error {
  constructor() {
    super("Não foi possível obter o endereço da sua localização");
    this.name = "LocalizacaoIndisponivelError";
  }
}

/**
 * Geocodificação reversa via Nominatim (OpenStreetMap, custo-zero — ADR-0003).
 * Converte coordenadas em um endereço parcial para pré-preencher o formulário.
 * Campos ausentes voltam como string vazia (o cliente completa).
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  fetcher: typeof fetch = fetch,
): Promise<EnderecoCep> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=pt-BR`;
  const res = await fetcher(url, {
    // Política de uso do Nominatim exige identificação.
    headers: { "User-Agent": "dbg-eletrica-pintura/1.0" },
  });
  if (!res.ok) throw new LocalizacaoIndisponivelError();
  const data = nominatimSchema.parse(await res.json());
  if (data.error || !data.address) throw new LocalizacaoIndisponivelError();

  const a = data.address;
  const uf = a["ISO3166-2-lvl4"]?.split("-")[1] ?? "";
  return {
    cep: (a.postcode ?? "").replace(/\D/g, ""),
    logradouro: a.road ?? a.pedestrian ?? "",
    bairro: a.suburb ?? a.neighbourhood ?? a.city_district ?? "",
    cidade: a.city ?? a.town ?? a.village ?? a.municipality ?? "",
    uf: uf.toUpperCase(),
  };
}
