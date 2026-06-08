import { desc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { assinatura, cliente, plano } from "@/db/schema";
import type { StatusAssinatura } from "./assinatura-repo";

export interface AssinaturaCliente {
  id: string;
  planoNome: string;
  planoSlug: string | null;
  preco: string;
  status: StatusAssinatura;
  criadoEm: Date;
}

/**
 * Assinaturas de um cliente identificado pelo WhatsApp (todos os canais
 * vinculam a assinatura ao cliente via WhatsApp). Alimenta a seção "Minhas
 * assinaturas" do portal. Mais recentes primeiro.
 */
export async function listarAssinaturasCliente(
  whatsapp: string,
  db: DB,
): Promise<AssinaturaCliente[]> {
  const rows = await db
    .select({
      id: assinatura.id,
      planoNome: plano.nome,
      planoSlug: plano.slug,
      preco: plano.preco,
      status: assinatura.status,
      criadoEm: assinatura.criadoEm,
    })
    .from(assinatura)
    .innerJoin(cliente, eq(assinatura.clienteId, cliente.id))
    .innerJoin(plano, eq(assinatura.planoId, plano.id))
    .where(eq(cliente.whatsapp, whatsapp))
    .orderBy(desc(assinatura.criadoEm));
  return rows;
}
