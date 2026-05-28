import { z } from "zod";

export const precoBaseSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, "preço inválido")
  .refine((v) => Number(v) > 0, "preço deve ser maior que zero");

export const prazoGarantiaSchema = z
  .number()
  .int()
  .min(0, "prazo de garantia não pode ser negativo");

export const nomeServicoSchema = z.string().trim().min(1, "nome obrigatório");
