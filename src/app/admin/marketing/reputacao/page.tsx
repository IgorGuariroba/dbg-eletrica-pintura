import { db } from "@/db/client";
import { criarNotaTecnicoRepoDrizzle } from "@/marketing/nota-tecnico-repo-drizzle";
import { criarGatewayGBP, gbpConfigurado } from "@/marketing/gbp/gbp-gateway";
import { obterReputacao } from "@/marketing/gbp/reputacao-service";
import { exigirMarketing } from "../guard";
import { ReputacaoClient } from "./reputacao-client";

export default async function ReputacaoPage() {
  await exigirMarketing();

  const repo = criarNotaTecnicoRepoDrizzle(db);
  const { avaliacoes, metricas } = await obterReputacao(criarGatewayGBP(), {
    obterNotaMediaGlobal: () => repo.obterNotaMediaGlobal(),
  });

  return (
    <div className="max-w-6xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold font-sans text-foreground">
          Reputação Google
        </h1>
        <p className="text-sm text-muted-foreground">
          Avaliações do perfil Google do negócio e comparação com a nota interna
          da DBG.
        </p>
      </div>

      <ReputacaoClient
        avaliacoes={avaliacoes}
        metricas={metricas}
        usandoDadosFalsos={!gbpConfigurado()}
      />
    </div>
  );
}
