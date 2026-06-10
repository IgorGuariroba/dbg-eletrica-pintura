"use server";

import { db } from "@/db/client";
import { exigirPortal } from "@/portal/guard";
import { criarAgendamentoService, ForaDaJanelaError } from "@/operacao/agendamento";
import { criarAgendamentoRepoDrizzle } from "@/operacao/agendamento-repo-drizzle";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { ordemServico, solicitacao } from "@/db/schema";
import { acionarGarantia, ForaDoPrazoError } from "@/operacao/garantia/acionar-garantia";
import { criarGarantiaRepoDrizzle } from "@/operacao/garantia/garantia-repo-drizzle";
import { uploadFotoGarantia } from "@/operacao/r2-privado";

const service = criarAgendamentoService(criarAgendamentoRepoDrizzle(db));

/** Resolve o token da solicitação dona da OS — credencial usada pelo service de agendamento. */
async function tokenDaOs(osId: string): Promise<string> {
  const [row] = await db
    .select({ token: solicitacao.token })
    .from(ordemServico)
    .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
    .where(eq(ordemServico.id, osId))
    .limit(1);

  if (!row) throw new Error("OS não encontrada");
  return row.token;
}

export async function cancelarOsClienteAction(osId: string): Promise<{ erro?: string }> {
  try {
    const user = await exigirPortal();
    const token = await tokenDaOs(osId);

    await service.cancelarCliente(token, osId, user.whatsapp!);
    revalidatePath("/portal");
    return { erro: undefined };
  } catch (err) {
    if (err instanceof ForaDaJanelaError) {
      return { erro: "Fora da janela permitida (menos de 24h restantes)" };
    }
    console.error(`Erro ao cancelar OS ${osId} (cliente):`, err);
    return { erro: err instanceof Error ? err.message : "Erro ao cancelar OS" };
  }
}

export async function listarSlotsOsPortalAction(osId: string) {
  try {
    await exigirPortal();
    const token = await tokenDaOs(osId);

    const slots = await service.obterSlotsCliente(token, osId);

    return slots.map((s) => ({
      inicioISO: s.inicio.toISOString(),
    }));
  } catch (err) {
    console.error(`Erro ao listar slots da OS ${osId} (portal):`, err);
    throw new Error(err instanceof Error ? err.message : "Erro ao carregar slots");
  }
}

export async function reagendarOsClienteAction(
  osId: string,
  novoSlotISO: string,
): Promise<{ erro?: string }> {
  try {
    const user = await exigirPortal();
    const token = await tokenDaOs(osId);

    await service.reagendarCliente(token, osId, user.whatsapp!, new Date(novoSlotISO));

    revalidatePath("/portal");
    return { erro: undefined };
  } catch (err) {
    if (err instanceof ForaDaJanelaError) {
      return { erro: "Fora da janela permitida (menos de 24h restantes)" };
    }
    console.error(`Erro ao reagendar OS ${osId} (cliente):`, err);
    return { erro: err instanceof Error ? err.message : "Erro ao reagendar OS" };
  }
}

export async function acionarGarantiaPortalAction(
  osId: string,
  descricao: string,
  fotoDataUrl: string,
): Promise<{ erro?: string }> {
  try {
    const user = await exigirPortal();
    const repo = criarGarantiaRepoDrizzle(db);
    await acionarGarantia(
      {
        osId,
        descricao,
        fotoDataUrl,
        criadoPor: user.email!,
        canal: "PORTAL",
      },
      {
        repo,
        uploadFoto: uploadFotoGarantia,
      },
    );
    revalidatePath("/portal");
    return { erro: undefined };
  } catch (err) {
    if (err instanceof ForaDoPrazoError) {
      return { erro: "Fora do prazo de garantia" };
    }
    console.error(`Erro ao acionar garantia da OS ${osId} (portal):`, err);
    return { erro: err instanceof Error ? err.message : "Erro ao acionar garantia" };
  }
}

