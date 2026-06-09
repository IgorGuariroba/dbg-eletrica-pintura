import { z } from "zod";

export const nomePlanoSchema = z.string().trim().min(1, "nome obrigatório");

export const precoPlanoSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, "preço inválido")
  .refine((v) => Number(v) >= 0, "preço não pode ser negativo");

export const percentualDescontoSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, "percentual inválido")
  .refine(
    (v) => Number(v) >= 0 && Number(v) <= 100,
    "percentual de desconto deve estar entre 0 e 100",
  );

export const preventivasPorAnoSchema = z
  .number()
  .int()
  .min(0, "número de preventivas não pode ser negativo");

export const categoriasPreventivaSchema = z
  .array(z.enum(["ELETRICA", "PINTURA", "DRYWALL"]))
  .min(1, "informe ao menos uma categoria");
