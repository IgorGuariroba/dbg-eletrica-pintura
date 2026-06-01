import { db } from "@/db/client";
import { exigirOperacao } from "../guard";
import { ordemServico, solicitacao, cliente, membro } from "@/db/schema";
import { gte, asc, eq } from "drizzle-orm";
import { AdminAgendaView } from "./agenda-view";

export const metadata = {
  title: "Agenda de Operações — DBG Admin",
};

export default async function AdminAgendaPage() {
  await exigirOperacao();

  const dataInicio = new Date();
  dataInicio.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      osId: ordemServico.id,
      estado: ordemServico.estado,
      agendadoPara: ordemServico.agendadoPara,
      categoria: ordemServico.categoria,
      clienteNome: cliente.nome,
      clienteWhatsapp: cliente.whatsapp,
      tecnicoNome: membro.nome,
      solicitacaoId: ordemServico.solicitacaoId,
    })
    .from(ordemServico)
    .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
    .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
    .leftJoin(membro, eq(ordemServico.tecnicoId, membro.id))
    // Agenda é date-only: lista apenas OS com horário marcado (>= hoje). OS
    // APROVADA (sem `agendadoPara`) é tratada na fila/painel, não aqui — por
    // isso `agendadoPara` nunca é null nas linhas e o `!` abaixo é seguro.
    .where(gte(ordemServico.agendadoPara, dataInicio))
    .orderBy(asc(ordemServico.agendadoPara));

  // Serialize dates for Client Component
  const itens = rows.map((r) => ({
    osId: r.osId,
    estado: r.estado,
    agendadoParaISO: r.agendadoPara!.toISOString(),
    categoria: r.categoria,
    clienteNome: r.clienteNome,
    clienteWhatsapp: r.clienteWhatsapp,
    tecnicoNome: r.tecnicoNome ?? "Não atribuído",
    solicitacaoId: r.solicitacaoId,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agenda de Visitas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie e reagende visitas técnicas e ordens de serviço futuras.
        </p>
      </div>
      <AdminAgendaView itensIniciais={itens} />
    </div>
  );
}
