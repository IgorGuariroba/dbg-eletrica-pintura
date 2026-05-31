import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db/client";
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";
import { TecnicoDisponibilidadeItem } from "@/features/operacao/components/tecnico-disponibilidade-item";
import { criarBairroCoberturaRepoDrizzle } from "@/operacao/cobertura-repo-drizzle";
import { criarOperacaoConfigRepoDrizzle } from "@/operacao/config-repo-drizzle";
import { exigirOperacao } from "../guard";
import { BairrosForm } from "./bairros-form";
import { ConfigForm } from "./config-form";
import { HorarioComercialForm } from "./horario-comercial-form";

export default async function OperacaoConfigPage() {
  await exigirOperacao();

  const config = await criarOperacaoConfigRepoDrizzle(db).obter();
  const bairros = await criarBairroCoberturaRepoDrizzle(db).listar();
  const tecnicos = await criarMembroRepoDrizzle(db).listar({
    papel: "tecnico",
    ativo: true,
    limit: 100,
    offset: 0,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Configuração de Operação</h1>
        <p className="text-sm text-muted-foreground">
          Horário de atendimento, disponibilidade dos técnicos e raio de
          cobertura.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Horário comercial</CardTitle>
          <CardDescription>
            Janela máxima de atendimento por dia da semana. Define os horários
            possíveis de agendamento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HorarioComercialForm horario={config.horarioComercial} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Raio de cobertura</CardTitle>
          <CardDescription>
            Bairros atendidos. Fora da lista, o formulário público exibe um aviso
            suave — sem bloquear o envio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BairrosForm bairros={bairros} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Disponibilidade dos técnicos</CardTitle>
          <CardDescription>
            Cada técnico atende dentro do horário comercial. Janelas fora do
            range são recusadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tecnicos.itens.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum técnico ativo cadastrado.
            </p>
          ) : (
            tecnicos.itens.map((tec) => (
              <TecnicoDisponibilidadeItem
                key={tec.id}
                tecnicoId={tec.id}
                nome={tec.nome}
                disponibilidade={tec.disponibilidade}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deslocamento</CardTitle>
          <CardDescription>
            Parâmetros de combustível usados na montagem de orçamentos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfigForm config={config} />
        </CardContent>
      </Card>
    </div>
  );
}
