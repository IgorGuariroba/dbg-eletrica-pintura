import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { criarServicoRepoDrizzle } from "@/catalogo/servico-repo-drizzle";
import { listarServicos } from "@/catalogo/listar-servicos";
import { criarLandingOverrideRepoDrizzle } from "@/marketing/landing/landing-override-repo-drizzle";
import { criarDepoimentosQueryDrizzle } from "@/marketing/landing/depoimentos-query-drizzle";
import { urlPublicaFoto } from "@/marketing/copiador-r2";
import { exigirMarketing } from "../../guard";
import { LandingOverrideForm } from "./landing-override-form";

export const dynamic = "force-dynamic";

export default async function EditarLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await exigirMarketing();
  const { slug } = await params;

  const servicoRepo = criarServicoRepoDrizzle(db);
  const servico = await servicoRepo.buscarPorSlug(slug);
  if (!servico) notFound();

  const [override, candidatos, servicosResult] = await Promise.all([
    criarLandingOverrideRepoDrizzle(db).obterPorServico(servico.id),
    criarDepoimentosQueryDrizzle(db).listarCandidatos(100),
    listarServicos({ ativo: true, perPage: 100 }, servicoRepo),
  ]);

  const outrosServicos = servicosResult.itens
    .filter((s) => s.id !== servico.id)
    .map((s) => ({ id: s.id, nome: s.nome }));

  const fotos = (override?.fotos ?? []).map((f) => ({
    id: f.id,
    url: urlPublicaFoto(f.chave),
  }));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Landing — {servico.nome}
        </h1>
        <p className="text-sm text-muted-foreground">
          Personalize a página pública <code>/servicos/{slug}</code>. Sem
          override, a versão automática continua publicada.
        </p>
      </div>

      <LandingOverrideForm
        servicoId={servico.id}
        slug={slug}
        precoBase={servico.precoBase}
        nomeServico={servico.nome}
        inicial={{
          titulo: override?.titulo ?? "",
          descricao: override?.descricao ?? "",
          precoPromo: override?.precoPromo ?? "",
          upsellServicoId: override?.upsellServicoId ?? "",
          depoimentoIds: override?.depoimentoIds ?? [],
        }}
        fotos={fotos}
        candidatosDepoimento={candidatos}
        outrosServicos={outrosServicos}
      />
    </div>
  );
}
