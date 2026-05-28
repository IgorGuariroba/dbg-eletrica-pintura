import { z } from "zod";
import {
  EmailDuplicadoError,
  type Membro,
  type MembroRepo,
  type NovoMembro,
} from "./membro-repo";
import {
  categoriaSchema,
  disponibilidadeSchema,
  emailSchema,
  moduloSchema,
  nomeMembroSchema,
} from "./validacao";

export const novoMembroSchema = z
  .object({
    nome: nomeMembroSchema,
    email: emailSchema,
    modulos: z.array(moduloSchema),
    isTecnico: z.boolean(),
    fotoUrl: z.string().url().nullable(),
    bio: z.string().nullable(),
    especialidades: z.array(categoriaSchema),
    disponibilidade: disponibilidadeSchema.nullable(),
    ativo: z.boolean(),
  })
  .refine(
    (m) => m.modulos.length > 0 || m.isTecnico,
    "membro precisa de ao menos um módulo OU ser técnico",
  );

export type CriarMembroInput = z.input<typeof novoMembroSchema>;

export async function criarMembro(
  input: CriarMembroInput,
  repo: MembroRepo,
): Promise<Membro> {
  const parsed: NovoMembro = novoMembroSchema.parse(input);
  const existente = await repo.buscarPorEmail(parsed.email);
  if (existente) throw new EmailDuplicadoError(parsed.email);
  return repo.inserir(parsed);
}
