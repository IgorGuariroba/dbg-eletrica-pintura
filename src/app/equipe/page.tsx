import type { Metadata } from "next";
import { db } from "@/db/client";
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";
import type { Membro } from "@/equipe/membro-repo";
import { SiteHeader } from "@/app/_landing/site-header";
import { SiteFooter } from "@/app/_landing/site-footer";
import { Equipe } from "@/app/_landing/equipe";
import type { MembroComNota } from "@/app/_landing/equipe";
import { CtaFinal } from "@/app/_landing/cta-final";
import { criarNotaTecnicoRepoDrizzle } from "@/marketing/nota-tecnico-repo";


export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Nossa equipe — DBG Elétrica e Pintura",
  description:
    "Conheça os técnicos homologados pela DBG: perfil, especialidades e avaliações de quem vai atender na sua residência.",
};

async function carregarTecnicos(): Promise<MembroComNota[]> {
  try {
    const [res, notas] = await Promise.all([
      criarMembroRepoDrizzle(db).listar({
        papel: "tecnico",
        ativo: true,
        limit: 100,
        offset: 0,
      }),
      criarNotaTecnicoRepoDrizzle(db).listarNotasPorTecnico(),
    ]);

    const notasMap = new Map(notas.map((n) => [n.tecnicoId, n]));
    return res.itens.map((t) => ({
      ...t,
      avaliacaoMedia: notasMap.get(t.id)?.media ?? null,
      totalAvaliacoes: notasMap.get(t.id)?.total ?? 0,
    }));
  } catch (err) {
    console.error("Erro ao carregar técnicos:", err);
    return [];
  }
}

export default async function EquipePage() {
  const tecnicos = await carregarTecnicos();

  return (
    <>
      <SiteHeader />
      <Equipe tecnicos={tecnicos} />
      <CtaFinal />
      <SiteFooter />
    </>
  );
}
