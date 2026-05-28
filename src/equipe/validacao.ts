import { z } from "zod";
import { categoriaServicoEnum, moduloEnum } from "@/db/schema";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("e-mail inválido");

export const nomeMembroSchema = z.string().trim().min(1, "nome obrigatório");

const janelaSchema = z
  .object({
    inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "horário HH:MM"),
    fim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "horário HH:MM"),
  })
  .refine((j) => j.inicio < j.fim, "início deve ser antes do fim");

export const disponibilidadeSchema = z
  .object({
    dom: janelaSchema.nullish(),
    seg: janelaSchema.nullish(),
    ter: janelaSchema.nullish(),
    qua: janelaSchema.nullish(),
    qui: janelaSchema.nullish(),
    sex: janelaSchema.nullish(),
    sab: janelaSchema.nullish(),
  })
  .partial();

export const moduloSchema = z.enum(moduloEnum.enumValues);
export const categoriaSchema = z.enum(categoriaServicoEnum.enumValues);
