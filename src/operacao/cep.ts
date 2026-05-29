import { z } from "zod";

const viaCepRespSchema = z.object({
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  localidade: z.string().optional(),
  uf: z.string().optional(),
  erro: z.union([z.boolean(), z.string()]).optional(),
});

export interface EnderecoCep {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  complemento?: string;
}

export class CepInvalidoError extends Error {
  constructor() {
    super("CEP inválido ou não encontrado");
    this.name = "CepInvalidoError";
  }
}

export async function buscarCep(
  cep: string,
  fetcher: typeof fetch = fetch,
): Promise<EnderecoCep> {
  const digitos = cep.replace(/\D/g, "");
  if (digitos.length !== 8) throw new CepInvalidoError();
  const res = await fetcher(`https://viacep.com.br/ws/${digitos}/json/`);
  if (!res.ok) throw new CepInvalidoError();
  const data = viaCepRespSchema.parse(await res.json());
  if (data.erro) throw new CepInvalidoError();
  return {
    cep: digitos,
    logradouro: data.logradouro ?? "",
    bairro: data.bairro ?? "",
    cidade: data.localidade ?? "",
    uf: data.uf ?? "",
    complemento: data.complemento,
  };
}
