import { categoriaServicoEnum } from "@/db/schema";
import type { Categoria, EnderecoSolicitacao } from "@/operacao/solicitacao-repo";

/**
 * Parsers de FormData compartilhados pelas actions de criação de solicitação
 * (formulário público, manual no painel e express no campo).
 */

export function lerEnderecoForm(form: FormData): EnderecoSolicitacao {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const num = (k: string) => {
    const v = form.get(k);
    return v ? Number(v) : undefined;
  };
  return {
    logradouro: get("end_logradouro"),
    numero: get("end_numero") || undefined,
    complemento: get("end_complemento") || undefined,
    bairro: get("end_bairro") || undefined,
    cidade: get("end_cidade"),
    uf: get("end_uf").toUpperCase(),
    cep: get("end_cep") || undefined,
    lat: num("end_lat"),
    lng: num("end_lng"),
  };
}

export function lerCategoriasForm(form: FormData): Categoria[] {
  const parsed = form.getAll("categorias").map((v) => String(v));
  if (parsed.includes("OUTRO")) {
    return ["ELETRICA", "PINTURA", "DRYWALL"];
  }
  return parsed.filter((v): v is Categoria =>
    categoriaServicoEnum.enumValues.includes(v as Categoria),
  );
}

export function lerFotosKeysForm(form: FormData): string[] {
  return form
    .getAll("fotosKeys")
    .map((v) => String(v).trim())
    .filter(Boolean);
}

export function lerDataDesejadaForm(form: FormData): Date | null {
  const raw = String(form.get("dataDesejada") ?? "").trim();
  return raw ? new Date(raw) : null;
}
