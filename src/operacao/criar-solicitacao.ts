import { randomBytes } from "node:crypto";
import { z } from "zod";
import { categoriaServicoEnum } from "@/db/schema";
import type {
  CriarSolicitacaoInput,
  ResultadoCriacao,
  SolicitacaoRepo,
} from "./solicitacao-repo";

const whatsappRegex = /^\+?[0-9]{10,15}$/;

const enderecoSchema = z.object({
  logradouro: z.string().trim().min(1, "logradouro obrigatório"),
  numero: z.string().trim().optional(),
  complemento: z.string().trim().optional(),
  bairro: z.string().trim().optional(),
  cidade: z.string().trim().min(1, "cidade obrigatória"),
  uf: z.string().trim().length(2, "UF tem 2 letras"),
  cep: z.string().trim().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const criarSolicitacaoSchema = z.object({
  cliente: z.object({
    nome: z.string().trim().min(1, "nome obrigatório"),
    whatsapp: z
      .string()
      .trim()
      .transform((v) => v.replace(/\D/g, ""))
      .pipe(z.string().regex(whatsappRegex, "WhatsApp inválido")),
    email: z.string().email().nullish(),
    endereco: enderecoSchema.nullish(),
  }),
  solicitacao: z.object({
    categorias: z
      .array(z.enum(categoriaServicoEnum.enumValues))
      .min(1, "selecione ao menos uma categoria"),
    descricao: z.string().trim().nullish(),
    fotosUrls: z
      .array(z.string().trim().min(1, "foto inválida"))
      .max(5, "máximo de 5 fotos")
      .default([]),
    endereco: enderecoSchema,
    dataDesejada: z.date().nullish(),
    duracaoEstimada: z.string().trim().nullish(),
    lgpdAceito: z
      .boolean()
      .refine((v) => v === true, "é necessário aceitar a LGPD"),
    origem: z.enum(["FORMULARIO", "EXPRESS", "MANUAL"]).default("FORMULARIO"),
  }),
});

export type CriarSolicitacaoInputBruto = z.input<typeof criarSolicitacaoSchema>;

export function gerarTokenSolicitacao(): string {
  return randomBytes(24).toString("base64url");
}

export async function criarSolicitacao(
  input: CriarSolicitacaoInputBruto,
  repo: SolicitacaoRepo,
  tokenGen: () => string = gerarTokenSolicitacao,
): Promise<ResultadoCriacao> {
  const parsed = criarSolicitacaoSchema.parse(input);
  const token = tokenGen();
  const completo: CriarSolicitacaoInput & { token: string } = {
    cliente: {
      nome: parsed.cliente.nome,
      whatsapp: parsed.cliente.whatsapp,
      email: parsed.cliente.email ?? null,
      endereco: parsed.cliente.endereco ?? null,
    },
    solicitacao: {
      ...parsed.solicitacao,
      descricao: parsed.solicitacao.descricao ?? null,
      dataDesejada: parsed.solicitacao.dataDesejada ?? null,
      duracaoEstimada: parsed.solicitacao.duracaoEstimada ?? null,
      fotosUrls: parsed.solicitacao.fotosUrls ?? [],
    },
    token,
  };
  return repo.criarComOrdens({
    cliente: completo.cliente,
    solicitacao: { ...completo.solicitacao, token: completo.token },
  });
}
