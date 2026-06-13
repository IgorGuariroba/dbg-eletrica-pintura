import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { carregarParaAvaliar } from "@/operacao/avaliacao/avaliacao";
import { criarAvaliacaoRepoDrizzle } from "@/operacao/avaliacao/avaliacao-repo";
import { TokenInvalidoError } from "@/operacao/aprovacao-repo";
import { SiteHeader } from "@/app/_landing/site-header";
import { SiteFooter } from "@/app/_landing/site-footer";
import { criarConfigReferralRepoDrizzle } from "@/marketing/referral/config-referral-repo";
import { FormAvaliacao } from "./form-avaliacao";

export const metadata = {
  title: "Avaliação do Atendimento — DBG Elétrica e Pintura",
};

interface AvaliarPageProps {
  params: Promise<{ token: string }>;
}

export default async function AvaliarPage({ params }: AvaliarPageProps) {
  const { token } = await params;
  let view: Awaited<ReturnType<typeof carregarParaAvaliar>>;
  try {
    view = await carregarParaAvaliar(token, criarAvaliacaoRepoDrizzle(db));
  } catch (e) {
    if (e instanceof TokenInvalidoError) {
      notFound();
    }
    throw e;
  }

  const protocolo = token.slice(0, 8).toUpperCase();
  const { valorPremio } = await criarConfigReferralRepoDrizzle(db).obter();

  return (
    <>
      <SiteHeader />
      <main className="container mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold md:text-3xl">
          Avaliação do Atendimento
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Solicitação #{protocolo} · Olá, {view.clienteNome.split(" ")[0]}. Ajude-nos a melhorar avaliando as ordens de serviço concluídas.
        </p>

        <FormAvaliacao token={token} view={view} valorPremio={valorPremio} />
      </main>
      <SiteFooter />
    </>
  );
}
