import { carregarAgendaAction } from "./actions";
import { AgendaTecnicoClient } from "./agenda-client";

export const metadata = {
  title: "Agenda — DBG Campo",
};

export default async function CampoAgendaPage() {
  const itensIniciais = await carregarAgendaAction();

  return (
    <div className="space-y-4 pb-8">
      <h1 className="text-xl font-bold tracking-tight">Minha Agenda</h1>
      <AgendaTecnicoClient itensIniciais={itensIniciais} />
    </div>
  );
}
