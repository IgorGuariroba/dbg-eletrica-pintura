import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { ordemServico, solicitacao, cliente } from "@/db/schema";
import { eq } from "drizzle-orm";
import { exigirPortal } from "@/portal/guard";
import { dentroDaJanelaCliente } from "@/operacao/reagendamento";
import { urlWhatsApp } from "@/lib/contato";

export interface OsAgendadaPortal {
  id: string;
  estado: string;
  agendadoPara: Date;
  solicitacaoId: string;
  clienteWhatsapp: string;
  categoria: string | null;
}

/**
 * Fluxo compartilhado pelas páginas de cancelar/reagendar do portal:
 * exige sessão (senão redireciona ao WhatsApp), valida propriedade da OS,
 * garante que está AGENDADA e calcula se está dentro da janela restrita
 * (< 24h). Em qualquer condição inválida, dispara redirect/notFound.
 *
 * @param acaoSubstantivo texto da ação na mensagem de WhatsApp sem sessão
 *   (ex.: "cancelamento", "reagendamento").
 */
export async function carregarOsAgendadaPortal(
  id: string,
  acaoSubstantivo: string,
): Promise<{ os: OsAgendadaPortal; restrito: boolean }> {
  // 1. Sem sessão Google: redirect direto para wa.me
  const session = await auth();
  if (!session?.user) {
    const link = urlWhatsApp(
      `Olá! Gostaria de solicitar o ${acaoSubstantivo} da Ordem de Serviço #${id.slice(0, 8)}.`,
    );
    redirect(link as Route);
  }

  // 2. Se logado, exige portal (valida WhatsApp etc.)
  const user = await exigirPortal();

  // 3. Carrega OS e valida propriedade
  const [os] = await db
    .select({
      id: ordemServico.id,
      estado: ordemServico.estado,
      agendadoPara: ordemServico.agendadoPara,
      solicitacaoId: ordemServico.solicitacaoId,
      clienteWhatsapp: cliente.whatsapp,
      categoria: ordemServico.categoria,
    })
    .from(ordemServico)
    .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
    .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
    .where(eq(ordemServico.id, id))
    .limit(1);

  if (!os || os.clienteWhatsapp !== user.whatsapp) {
    notFound();
  }

  // Se não estiver agendada, volta ao portal
  if (os.estado !== "AGENDADA" || !os.agendadoPara) {
    redirect(`/portal/solicitacao/${os.solicitacaoId}` as Route);
  }

  const agora = new Date();
  const restrito = dentroDaJanelaCliente(new Date(os.agendadoPara), agora);

  return { os: { ...os, agendadoPara: new Date(os.agendadoPara) }, restrito };
}
