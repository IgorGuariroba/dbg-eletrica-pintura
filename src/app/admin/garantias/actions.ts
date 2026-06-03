"use server";

import { db } from "@/db/client";
import { revalidatePath } from "next/cache";
import { acionarGarantia } from "@/operacao/garantia/acionar-garantia";
import { criarGarantiaRepoDrizzle } from "@/operacao/garantia/garantia-repo-drizzle";
import { uploadFotoGarantia } from "@/operacao/r2-privado";
import { exigirGarantias } from "./guard";
import { eq } from "drizzle-orm";
import { cliente, ordemServico, solicitacao } from "@/db/schema";

export async function registrarAcionamentoGarantiaAction(
  osId: string,
  whatsapp: string,
  descricao: string,
  fotoDataUrl: string,
): Promise<{ chamadoId?: string; erro?: string }> {
  const user = await exigirGarantias();
  try {
    // Validar que o WhatsApp coincide com o cliente da OS
    const [osComCliente] = await db
      .select({
        whatsapp: cliente.whatsapp,
      })
      .from(ordemServico)
      .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
      .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
      .where(eq(ordemServico.id, osId))
      .limit(1);

    if (!osComCliente) {
      return { erro: "Ordem de Serviço não encontrada." };
    }

    const inputWhatsappNormalizado = whatsapp.replace(/\D/g, "");
    const dbWhatsappNormalizado = osComCliente.whatsapp.replace(/\D/g, "");

    if (inputWhatsappNormalizado !== dbWhatsappNormalizado) {
      return { erro: "O WhatsApp informado não coincide com o WhatsApp do cliente cadastrado nesta OS." };
    }

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
