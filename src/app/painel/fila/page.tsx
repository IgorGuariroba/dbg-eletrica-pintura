import { ClipboardList } from "lucide-react";
import { db } from "@/db/client";
import { listarFila } from "@/operacao/fila";
import { criarFilaRepoDrizzle } from "@/operacao/fila-repo-drizzle";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "../../admin/_components/empty-state";
import { exigirFila } from "../guard";
import { DevolverButton, PegarButton } from "./fila-row-actions";

const ESTADO_LABEL: Record<string, string> = {
  NOVA: "Nova",
  ORCADA: "Orçada",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
  EXPIRADA: "Expirada",
  AGENDADA: "Agendada",
  A_CAMINHO: "A caminho",
  NO_LOCAL: "No local",
  EM_EXECUCAO: "Em execução",
  CONCLUIDA: "Concluída",
  PAGA: "Paga",
  CANCELADA: "Cancelada",
  GARANTIA_ABERTA: "Garantia aberta",
};

export default async function FilaPage() {
  const { usuario } = await exigirFila();
  const podePegar = usuario.isTecnico && Boolean(usuario.membroId);

  const { itens, total } = await listarFila(usuario, criarFilaRepoDrizzle(db));

  const titulo = usuario.isTecnico && usuario.membroId
    ? "OS disponíveis para você"
    : "Fila de OS";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{titulo}</h1>
        <p className="text-sm text-muted-foreground">
          {total} OS na fila
        </p>
      </div>

      {itens.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          titulo="Nenhuma OS na fila"
          descricao={
            podePegar
              ? "Não há OS disponíveis na sua especialidade agora."
              : "Quando chegarem novas solicitações, elas aparecem aqui."
          }
        />
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Técnico</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((os) => {
                const disponivel = os.estado === "NOVA" && !os.tecnicoId;
                const minha =
                  os.estado === "NOVA" && os.tecnicoId === usuario.membroId;
                return (
                  <TableRow key={os.id}>
                    <TableCell className="font-medium">
                      {os.clienteNome}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{os.categoria}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {os.cidade}/{os.uf}
                    </TableCell>
                    <TableCell>
                      <Badge variant={disponivel ? "default" : "outline"}>
                        {ESTADO_LABEL[os.estado] ?? os.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {os.tecnicoId
                        ? minha
                          ? "Você"
                          : "Atribuída"
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {podePegar && disponivel && <PegarButton osId={os.id} />}
                      {podePegar && minha && <DevolverButton osId={os.id} />}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
