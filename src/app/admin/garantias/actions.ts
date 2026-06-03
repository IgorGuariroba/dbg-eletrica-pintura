"use server";

import { db } from "@/db/client";
import { revalidatePath } from "next/cache";
import { acionarGarantia } from "@/operacao/garantia/acionar-garantia";
import { criarGarantiaRepoDrizzle } from "@/operacao/garantia/garantia-repo-drizzle";
import { uploadFotoGarantia } from "@/operacao/r2-privado";
import { exigirGarantias } from "./guard";

export async function registrarAcionamentoGarantiaAction(
  osId: string,
  descricao: string,
  fotoDataUrl: string,
): Promise<{ chamadoId?: string; erro?: string }> {
  const user = await exigirGarantias();
  try {
    const repo = criarGarantiaRepoDrizzle(db);
    const { chamadoId } = await acionarGarantia(
      {
        osId,
        descricao,
        fotoDataUrl,
        criadoPor: user.email!,
        canal: "WHATSAPP",
      },
      {
        repo,
        uploadFoto: uploadFotoGarantia,
      },
    );
    revalidatePath("/admin/garantias");
    return { chamadoId };
  } catch (err) {
    console.error(`Erro ao registrar acionamento manual de garantia (admin):`, err);
    return { erro: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
