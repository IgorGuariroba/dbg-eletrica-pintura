import type { db } from "@/db/client";
import { ordemServico, pagamento, orcamento, garantiaChamado } from "@/db/schema";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import type { GarantiaRepo } from "./garantia-repo";
import { avaliarAcionamentoGarantia } from "./avaliar-acionamento";

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

    async carregarGarantiasParaOsIds(osIds) {
      const result = new Map<string, { podeAcionar: boolean; fim?: Date }>();
      if (!osIds.length) return result;

      const oss = await dbRaw
        .select()
        .from(ordemServico)
        .where(inArray(ordemServico.id, osIds));

      const osMap = new Map(oss.map(o => [o.id, o]));
      const osAnchorMap = new Map<string, string>();
      const uniqueAnchorIdsSet = new Set<string>();

      for (const osId of osIds) {
        const os = osMap.get(osId);
        if (!os) continue;

        if (os.tipo === "GARANTIA" && os.osPaiId) {
          osAnchorMap.set(osId, os.osPaiId);
          uniqueAnchorIdsSet.add(os.osPaiId);
        } else {
          osAnchorMap.set(osId, osId);
          uniqueAnchorIdsSet.add(osId);
        }
      }

      const uniqueAnchorIds = Array.from(uniqueAnchorIdsSet);
      if (!uniqueAnchorIds.length) {
        for (const osId of osIds) {
          result.set(osId, { podeAcionar: false });
        }
        return result;
      }

      const anchors = await dbRaw
        .select()
        .from(ordemServico)
        .where(inArray(ordemServico.id, uniqueAnchorIds));
      const anchorMap = new Map(anchors.map(a => [a.id, a]));

      const pagamentos = await dbRaw
        .select({
          osId: pagamento.osId,
          criadoEm: pagamento.criadoEm,
        })
        .from(pagamento)
        .where(and(inArray(pagamento.osId, uniqueAnchorIds), eq(pagamento.status, "approved")))
        .orderBy(desc(pagamento.criadoEm));

      const pagamentosMaisRecenteMap = new Map<string, Date>();
      for (const pag of pagamentos) {
        if (!pagamentosMaisRecenteMap.has(pag.osId)) {
          pagamentosMaisRecenteMap.set(pag.osId, pag.criadoEm);
        }
      }

      const filhasComplementares = await dbRaw
        .select({
          id: ordemServico.id,
          osPaiId: ordemServico.osPaiId,
          estado: ordemServico.estado,
        })
        .from(ordemServico)
        .where(and(inArray(ordemServico.osPaiId, uniqueAnchorIds), eq(ordemServico.tipo, "COMPLEMENTAR")));

      const complementarIds = filhasComplementares.map(f => f.id);
      const orcamentosComplementaresMap = new Map<string, Date | null>();

      if (complementarIds.length) {
        const orcs = await dbRaw
          .select({
            osId: orcamento.osId,
            rejeitadoEm: orcamento.rejeitadoEm,
          })
          .from(orcamento)
          .where(inArray(orcamento.osId, complementarIds))
          .orderBy(desc(orcamento.criadoEm));

        for (const orc of orcs) {
          if (!orcamentosComplementaresMap.has(orc.osId)) {
            orcamentosComplementaresMap.set(orc.osId, orc.rejeitadoEm);
          }
        }
      }

      const temComplementarRejeitadoMap = new Map<string, boolean>();
      for (const ancoraId of uniqueAnchorIds) {
        let temRejeitado = false;
        const filhasDaAncora = filhasComplementares.filter(f => f.osPaiId === ancoraId);
        for (const filha of filhasDaAncora) {
          if (filha.estado === "REJEITADA") {
            temRejeitado = true;
            break;
          }
          const rejeitadoEm = orcamentosComplementaresMap.get(filha.id);
          if (rejeitadoEm != null) {
            temRejeitado = true;
            break;
          }
        }
        temComplementarRejeitadoMap.set(ancoraId, temRejeitado);
      }

      const agora = new Date();
      for (const osId of osIds) {
        const os = osMap.get(osId);
        if (!os || (os.estado !== "CONCLUIDA" && os.estado !== "PAGA")) {
          result.set(osId, { podeAcionar: false });
          continue;
        }

        const ancoraId = osAnchorMap.get(osId);
        if (!ancoraId) {
          result.set(osId, { podeAcionar: false });
          continue;
        }

        const ancoraOs = anchorMap.get(ancoraId);
        if (!ancoraOs || ancoraOs.prazoGarantiaMeses == null) {
          result.set(osId, { podeAcionar: false });
          continue;
        }

        const pagamentoEm = pagamentosMaisRecenteMap.get(ancoraId);
        if (!pagamentoEm) {
          result.set(osId, { podeAcionar: false });
          continue;
        }

        const temCompRejeitado = temComplementarRejeitadoMap.get(ancoraId) || false;

        const avaliacao = avaliarAcionamentoGarantia({
          agora,
          ancora: {
            prazoMeses: ancoraOs.prazoGarantiaMeses,
            pagamentoEm,
          },
          temComplementarRejeitado: temCompRejeitado,
        });

        result.set(osId, { podeAcionar: avaliacao.dentroDoPrazo, fim: avaliacao.fim });
      }

      return result;
    },
  };
}
