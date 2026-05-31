import { SiteHeader } from "../_landing/site-header";
import { SiteFooter } from "../_landing/site-footer";
import { SolicitarForm } from "./form";
import { listarBairrosAtendidos } from "@/operacao/cobertura-query";

export const metadata = {
  title: "Solicitar orçamento — DBG Elétrica e Pintura",
  description:
    "Conte seu serviço, selecione fotos e receba uma proposta com preço fixo e garantia.",
};

// Lê o raio de cobertura do banco a cada acesso (lista muda quando o admin
// edita). Sem isso, o Next tenta prerender estático e o build falha sem DB.
export const dynamic = "force-dynamic";

export default async function SolicitarPage() {
  const bairrosAtendidos = await listarBairrosAtendidos();

  return (
    <>
      <SiteHeader />
      <main className="container mx-auto px-4 py-10 max-w-xl">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Solicitar orçamento
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Conte o serviço, envie fotos se ajudar e a gente retorna no
            WhatsApp.
          </p>
        </div>
        <SolicitarForm bairrosAtendidos={bairrosAtendidos} />
      </main>
      <SiteFooter />
    </>
  );
}
