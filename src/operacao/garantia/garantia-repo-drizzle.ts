import type { db } from "@/db/client";
import { ordemServico, pagamento, orcamento, garantiaChamado } from "@/db/schema";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import type { GarantiaRepo } from "./garantia-repo";
import { avaliarAcionamentoGarantia } from "./avaliar-acionamento";
import { foiEntregue } from "../estado-predicados";

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
      let [os] = await dbRaw
        .select()
        .from(ordemServico)
        .where(eq(ordemServico.id, osId))
        .limit(1);

      if (!os) return null;

      const visited = new Set<string>([os.id]);
      while (os.tipo === "GARANTIA" && os.osPaiId) {
        if (visited.has(os.osPaiId)) {
          return null; // loop detectado
        }
        visited.add(os.osPaiId);

        const [pai] = await dbRaw
          .select()
          .from(ordemServico)
          .where(eq(ordemServico.id, os.osPaiId))
          .limit(1);

        if (!pai) return null;
        os = pai;
      }

      if (os.prazoGarantiaMeses == null) return null;

      const pag = await carregarPagamento(os.id);
      if (!pag) return null;

      return {
        ancoraId: os.id,
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

      // Carregar todas as OSs iniciais
      const initialOss = await dbRaw
        .select()
        .from(ordemServico)
        .where(inArray(ordemServico.id, osIds));

      const osMap = new Map(initialOss.map(o => [o.id, o]));
      const osAnchorMap = new Map<string, string>(); // osId -> ultimateAncoraId
      const uniqueAnchorIdsSet = new Set<string>();

      // Carregar iterativamente os pais para resolver a âncora final de cada OS
      let pendingAnchorIds = new Set<string>();
      const allFetchedOss = new Map(osMap);

      for (const os of initialOss) {
        if (os.tipo === "GARANTIA" && os.osPaiId) {
          pendingAnchorIds.add(os.osPaiId);
        } else {
          osAnchorMap.set(os.id, os.id);
          uniqueAnchorIdsSet.add(os.id);
        }
      }

      const visited = new Set<string>();
      while (pendingAnchorIds.size > 0) {
        const toFetch = Array.from(pendingAnchorIds).filter(id => !visited.has(id));
        if (toFetch.length === 0) {
          break;
        }
        for (const id of toFetch) {
          visited.add(id);
        }

        const fetched = await dbRaw
          .select()
          .from(ordemServico)
          .where(inArray(ordemServico.id, toFetch));

        for (const o of fetched) {
          allFetchedOss.set(o.id, o);
        }

        const nextPending = new Set<string>();
        for (const id of pendingAnchorIds) {
          const o = allFetchedOss.get(id);
          if (!o) continue;

          if (o.tipo === "GARANTIA" && o.osPaiId) {
            nextPending.add(o.osPaiId);
          } else {
            uniqueAnchorIdsSet.add(o.id);
          }
        }
        pendingAnchorIds = nextPending;
      }

      // Agora mapeamos cada OS de osIds para sua âncora final
      for (const osId of osIds) {
        const os = allFetchedOss.get(osId);
        if (!os) continue;

        if (os.tipo === "GARANTIA") {
          let curr = os;
          const localVisited = new Set<string>([curr.id]);
          while (curr.tipo === "GARANTIA" && curr.osPaiId) {
            if (localVisited.has(curr.osPaiId)) {
              break; // loop detectado
            }
            localVisited.add(curr.osPaiId);
            const parent = allFetchedOss.get(curr.osPaiId);
            if (!parent) break;
            curr = parent;
          }
          osAnchorMap.set(osId, curr.id);
        }
      }

      const uniqueAnchorIds = Array.from(uniqueAnchorIdsSet);
      if (!uniqueAnchorIds.length) {
        for (const osId of osIds) {
          result.set(osId, { podeAcionar: false });
        }
        return result;
      }

      // Carregar os dados das âncoras resolvidas
      const anchors = await dbRaw
        .select()
        .from(ordemServico)
        .where(inArray(ordemServico.id, uniqueAnchorIds));
      const anchorMap = new Map(anchors.map(a => [a.id, a]));

      // Carregar pagamentos das âncoras
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

      // Carregar filhas complementares das âncoras
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
        if (!os || !foiEntregue(os.estado)) {
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
