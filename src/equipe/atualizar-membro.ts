import { z } from "zod";
import type {
  AtualizacaoMembro,
  Membro,
  MembroRepo,
} from "./membro-repo";
import { EmailDuplicadoError } from "./membro-repo";
import {
  categoriaSchema,
  disponibilidadeSchema,
  emailSchema,
  moduloSchema,
  nomeMembroSchema,
} from "./validacao";

export const atualizacaoMembroSchema = z.object({
  nome: nomeMembroSchema.optional(),
  email: emailSchema.optional(),
  modulos: z.array(moduloSchema).optional(),
  isTecnico: z.boolean().optional(),
  fotoUrl: z.string().url().nullable().optional(),
  bio: z.string().nullable().optional(),
  especialidades: z.array(categoriaSchema).optional(),
  disponibilidade: disponibilidadeSchema.nullable().optional(),
  ativo: z.boolean().optional(),
});

export async function atualizarMembro(
  id: string,
  input: z.input<typeof atualizacaoMembroSchema>,
  repo: MembroRepo,
): Promise<Membro | null> {
  const parsed: AtualizacaoMembro = atualizacaoMembroSchema.parse(input);

  const efetivo = { ...parsed };
  if (efetivo.modulos !== undefined || efetivo.isTecnico !== undefined) {
    const atual = await repo.buscarPorId(id);
    if (!atual) return null;
    const modulos = efetivo.modulos ?? atual.modulos;
    const isTecnico = efetivo.isTecnico ?? atual.isTecnico;
    if (modulos.length === 0 && !isTecnico) {
      throw new Error("membro precisa de ao menos um módulo OU ser técnico");
    }
  }

  if (efetivo.email) {
    const dono = await repo.buscarPorEmail(efetivo.email);
    if (dono && dono.id !== id) throw new EmailDuplicadoError(efetivo.email);
  }

  return repo.atualizar(id, efetivo);
}
