import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { ordemServico } from "@/db/schema";
import { podeAcessarModulo } from "@/auth/require-modulo";
import { criarMembroRepoDrizzle } from "@/equipe/membro-repo-drizzle";
import {
  aplicarTransicao,
  TransicaoInvalidaError,
} from "@/operacao/maquina-estado";
import { OsInexistenteError } from "@/operacao/transicao-repo";
import { criarTransicaoRepoDrizzle } from "@/operacao/transicao-repo-drizzle";

const ALVOS_PERMITIDOS = new Set([
  "A_CAMINHO",
  "NO_LOCAL",
  "EM_EXECUCAO",
  "CONCLUIDA",
]);

type AlvoPermitido = "A_CAMINHO" | "NO_LOCAL" | "EM_EXECUCAO" | "CONCLUIDA";

/**
 * Avança o estado da OS pela máquina de transições (slice 2). O técnico só
 * transita a própria OS; o admin de Operação pode sobrepor.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const user = session?.user;
  if (!user?.email) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { alvo, lat, lon } = (await request.json()) as {
    alvo?: string;
    lat?: number;
    lon?: number;
  };
  if (!alvo || !ALVOS_PERMITIDOS.has(alvo)) {
    return NextResponse.json({ error: "alvo inválido" }, { status: 400 });
  }
  const geo =
    typeof lat === "number" && typeof lon === "number"
      ? { lat, lon }
      : undefined;

  const membro = await criarMembroRepoDrizzle(db).buscarPorEmail(user.email);
  const [os] = await db
    .select({ tecnicoId: ordemServico.tecnicoId })
    .from(ordemServico)
    .where(eq(ordemServico.id, id))
    .limit(1);
  if (!os) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const ehTecnicoDaOs = membro != null && os.tecnicoId === membro.id;
  const ehAdminOperacao = podeAcessarModulo("OPERACAO", user);
  if (!ehTecnicoDaOs && !ehAdminOperacao) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const registro = await aplicarTransicao(
      id,
      alvo as AlvoPermitido,
      user.email,
      null,
      criarTransicaoRepoDrizzle(db),
      new Date(),
      geo,
    );

    // Despacha as notificações da transição (WhatsApp + e-mail) de forma
    // assíncrona e não-bloqueante — Notificação decide canais por evento.
    const { notificar } = await import("@/notificacao/notificar");
    notificar({ tipo: "os.transicao", osId: id, estadoNovo: registro.estadoNovo }).catch((e) => {
      console.error(`Erro ao despachar notificação da OS ${id}:`, e);
    });

    return NextResponse.json({ estado: registro.estadoNovo });
  } catch (erro) {
    if (erro instanceof TransicaoInvalidaError) {
      return NextResponse.json({ error: erro.message }, { status: 409 });
    }
    if (erro instanceof OsInexistenteError) {
      return NextResponse.json({ error: erro.message }, { status: 404 });
    }
    throw erro;
  }
}
