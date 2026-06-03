import type { db } from "@/db/client";
import { ordemServico, pagamento, orcamento, garantiaChamado } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { GarantiaRepo } from "./garantia-repo";

export function criarGarantiaRepoDrizzle(dbRaw: typeof db): GarantiaRepo {
  async function carregarPagamento(osId: string) {
    const [pag] = await dbRaw
      .select({
        paymentId: pagamento.paymentId,
        metodo: pagamento.metodo,
        criadoEm: pagamento.criadoEm,
      })
      .from(pagamento)
      .where(and(eq(pagamento.osId, osId), eq(pagamento.status, "approved")))
      .orderBy(desc(pagamento.criadoEm))
      .limit(1);
    return pag ?? null;
  }

  return {
    async carregarAncora(osId: string) {
      const [os] = await dbRaw
        .select()
        .from(ordemServico)
        .where(eq(ordemServico.id, osId))
        .limit(1);

      if (!os) return null;

      if (os.tipo === "GARANTIA") {
        if (!os.osPaiId) return null;

        const [pai] = await dbRaw
          .select()
          .from(ordemServico)
          .where(eq(ordemServico.id, os.osPaiId))
          .limit(1);

        if (!pai || pai.prazoGarantiaMeses == null) return null;

        const pagPai = await carregarPagamento(os.osPaiId);
        if (!pagPai) return null;

        return {
          ancoraId: os.osPaiId,
          prazoMeses: pai.prazoGarantiaMeses,
          pagamentoEm: pagPai.criadoEm,
          tipo: pai.tipo,
        };
      }

      const pag = await carregarPagamento(osId);
      if (!pag || os.prazoGarantiaMeses == null) return null;

      return {
        ancoraId: osId,
        prazoMeses: os.prazoGarantiaMeses,
        pagamentoEm: pag.criadoEm,
        tipo: os.tipo,
      };
    },

    async temComplementarRejeitado(ancoraId: string) {
      // OS tipo=COMPLEMENTAR com osPaiId=ancoraId cujo orcamento.rejeitadoEm IS NOT NULL (ou OS em estado REJEITADA)
      // Buscamos se existe uma OS filha de tipo COMPLEMENTAR que tem orçamento rejeitado ou está em estado REJEITADA.
      // Vamos carregar todas as OSs filhas com tipo COMPLEMENTAR
      const filhas = await dbRaw
        .select({ id: ordemServico.id, estado: ordemServico.estado })
        .from(ordemServico)
        .where(and(eq(ordemServico.osPaiId, ancoraId), eq(ordemServico.tipo, "COMPLEMENTAR")));

      if (!filhas.length) return false;

      for (const filha of filhas) {
        if (filha.estado === "REJEITADA") return true;

        // Ou se o orçamento da filha foi rejeitado (rejeitadoEm is not null)
        const [orc] = await dbRaw
          .select({ rejeitadoEm: orcamento.rejeitadoEm })
          .from(orcamento)
          .where(eq(orcamento.osId, filha.id))
          .orderBy(desc(orcamento.criadoEm))
          .limit(1);

        if (orc?.rejeitadoEm != null) return true;
      }

      return false;
    },

    async criarChamado(dados) {
      const [chamado] = await dbRaw
        .insert(garantiaChamado)
        .values({
          osOrigemId: dados.osOrigemId,
          descricao: dados.descricao,
          fotoUrl: dados.fotoUrl,
          criadoPor: dados.criadoPor,
          canal: dados.canal,
          temComplementarRejeitado: dados.temComplementarRejeitado,
          acionamentoInvalido: dados.acionamentoInvalido,
          status: "pendente",
        })
        .returning();

      return { id: chamado.id };
    },
  };
}
