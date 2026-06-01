import type { ReagendamentoRepo } from "./reagendamento";
import { MotivoObrigatorioError } from "./reagendamento";
import type { EstadoOs } from "./orcamento-repo";

/** Estados pré-execução em que o admin pode agir. */
const PRE_EXECUCAO: EstadoOs[] = ["APROVADA", "AGENDADA", "A_CAMINHO", "NO_LOCAL"];

export async function cancelarLoteAdmin(
  osIds: string[],
  admin: { email: string },
  motivo: string,
  repo: ReagendamentoRepo,
  agora: Date = new Date(),
): Promise<{ osId: string; ok: boolean; erro?: string }[]> {
  const motivoLimpo = motivo?.trim() ?? "";
  if (motivoLimpo.length < 10) {
    throw new MotivoObrigatorioError();
  }

  const resultados: { osId: string; ok: boolean; erro?: string }[] = [];

  for (const osId of osIds) {
    try {
      const os = await repo.carregar(osId);
      if (!os) {
        resultados.push({ osId, ok: false, erro: "OS não encontrada" });
        continue;
      }

      if (!PRE_EXECUCAO.includes(os.estado)) {
        resultados.push({
          osId,
          ok: false,
          erro: `OS no estado ${os.estado} não pode ser cancelada`,
        });
        continue;
      }

      await repo.cancelar(osId, "CANCELADA", {
        estadoAnterior: os.estado,
        estadoNovo: "CANCELADA",
        atorEmail: admin.email,
        motivo: motivoLimpo,
        em: agora,
      });

      resultados.push({ osId, ok: true });
    } catch (err: any) {
      resultados.push({ osId, ok: false, erro: err.message ?? "Erro desconhecido" });
    }
  }

  return resultados;
}
