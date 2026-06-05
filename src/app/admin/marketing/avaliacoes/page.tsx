import { Star } from "lucide-react";
import { db } from "@/db/client";
import { criarAlertaAvaliacaoRepoDrizzle } from "@/marketing/alerta-avaliacao-repo-drizzle";
import { criarNotaTecnicoRepoDrizzle } from "@/marketing/nota-tecnico-repo-drizzle";
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";
import { exigirMarketing } from "../guard";
import { AvaliacoesClient } from "./avaliacoes-client";

export default async function AvaliacoesPage() {
  await exigirMarketing();

  const [alertas, notasPorTecnico, membrosResult] = await Promise.all([
    criarAlertaAvaliacaoRepoDrizzle(db).listarTodas(),
    criarNotaTecnicoRepoDrizzle(db).listarNotasPorTecnico(),
    criarMembroRepoDrizzle(db).listar({ papel: "ambos", ativo: true, limit: 200, offset: 0 }),
  ]);

  const membros = membrosResult.itens.map((m) => ({ id: m.id, nome: m.nome }));

  // Ordena por data mais recente primeiro
  const itensOrdenados = [...alertas].sort(
    (a, b) => b.criadoEm.getTime() - a.criadoEm.getTime(),
  );

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-sans text-foreground">
          Tratativas de Avaliações
        </h1>
        <p className="text-sm text-muted-foreground">
          {alertas.length} alerta{alertas.length !== 1 ? "s" : ""} de avaliação registrado{alertas.length !== 1 ? "s" : ""}.
        </p>
      </div>

      <AvaliacoesClient
        alertas={itensOrdenados}
        membros={membros}
        notasPorTecnico={notasPorTecnico}
      />
    </div>
  );
}
