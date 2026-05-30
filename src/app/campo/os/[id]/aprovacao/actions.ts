"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ordemServico, solicitacao } from "@/db/schema";
import { exigirTecnico } from "@/app/campo/guard";
import {
  aprovarPresencial,
  type Origem,
} from "@/operacao/aprovacao-presencial";
import { criarAprovacaoPresencialRepoDrizzle } from "@/operacao/aprovacao-presencial-repo-drizzle";
import { uploadAssinaturaOsR2 } from "@/operacao/r2-privado";

export interface AprovacaoPresencialState {
  erro?: string;
  ok?: boolean;
  podeIniciarExecucao?: boolean;
}

export async function aprovarPresencialAction(
  _prev: AprovacaoPresencialState,
  form: FormData,
): Promise<AprovacaoPresencialState> {
  let tecnico;
  try {
    tecnico = await exigirTecnico();
  } catch {
    return { erro: "Apenas técnicos autenticados podem aprovar no local" };
  }

  const osId = String(form.get("osId") ?? "");
  const aprovou = form.get("aprovou") === "true";
  const lgpdAceito = form.get("lgpdAceito") === "true";
  const assinaturaDataUrl = String(form.get("assinaturaDataUrl") ?? "");
  if (!osId) return { erro: "OS não informada" };

  // Descobre a origem (Express dispensa LGPD) a partir da Solicitação da OS.
  const [row] = await db
    .select({ origem: solicitacao.origem })
    .from(ordemServico)
    .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
    .where(eq(ordemServico.id, osId))
    .limit(1);
  if (!row) return { erro: "OS não encontrada" };

  try {
    const out = await aprovarPresencial(
      {
        osId,
        aprovou,
        lgpdAceito,
        origem: row.origem as Origem,
        assinaturaDataUrl,
        tecnicoEmail: tecnico.email ?? tecnico.nome ?? "tecnico",
      },
      {
        repo: criarAprovacaoPresencialRepoDrizzle(db),
        upload: uploadAssinaturaOsR2(),
      },
    );
    return { ok: true, podeIniciarExecucao: out.podeIniciarExecucao };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Erro ao aprovar" };
  }
}
