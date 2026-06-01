import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  cliente,
  membro,
  orcamento,
  orcamentoItem,
  ordemServico,
  servico,
  solicitacao,
} from "@/db/schema";
import type {
  AprovacaoRepo,
  Assinatura,
  ItemView,
  OsView,
  SolicitacaoView,
} from "./aprovacao-repo";

export function criarAprovacaoRepoDrizzle(db: DB): AprovacaoRepo {
  async function idDaSolicitacao(token: string): Promise<string | null> {
    const [sol] = await db
      .select({ id: solicitacao.id })
      .from(solicitacao)
      .where(eq(solicitacao.token, token))
      .limit(1);
    return sol?.id ?? null;
  }

  // Orçamento mais recente da OS — fonte única para exibir, expirar e carimbar.
  async function orcamentoMaisRecente(osId: string) {
    const [orc] = await db
      .select({ id: orcamento.id, validoAte: orcamento.validoAte })
      .from(orcamento)
      .where(eq(orcamento.osId, osId))
      .orderBy(desc(orcamento.criadoEm))
      .limit(1);
    return orc ?? null;
  }

  return {
    async carregarPorToken(token): Promise<SolicitacaoView | null> {
      const [sol] = await db
        .select({
          id: solicitacao.id,
          token: solicitacao.token,
          endereco: solicitacao.endereco,
          criadoEm: solicitacao.criadoEm,
          clienteNome: cliente.nome,
        })
        .from(solicitacao)
        .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
        .where(eq(solicitacao.token, token))
        .limit(1);
      if (!sol) return null;

      const ordens = await db
        .select({
          id: ordemServico.id,
          categoria: ordemServico.categoria,
          estado: ordemServico.estado,
          agendadoPara: ordemServico.agendadoPara,
          tecnicoId: membro.id,
          tecnicoNome: membro.nome,
          tecnicoFotoUrl: membro.fotoUrl,
          tecnicoSlug: membro.slug,
        })
        .from(ordemServico)
        .leftJoin(membro, eq(ordemServico.tecnicoId, membro.id))
        .where(eq(ordemServico.solicitacaoId, sol.id))
        .orderBy(asc(ordemServico.criadoEm));

      const osIds = ordens.map((o) => o.id);
      // Orçamento mais recente por OS.
      const orcs = osIds.length
        ? await db
            .select({
              id: orcamento.id,
              osId: orcamento.osId,
              totalMaoDeObra: orcamento.totalMaoDeObra,
              totalDeslocamento: orcamento.totalDeslocamento,
              total: orcamento.total,
              validoAte: orcamento.validoAte,
              criadoEm: orcamento.criadoEm,
            })
            .from(orcamento)
            .where(inArray(orcamento.osId, osIds))
            .orderBy(desc(orcamento.criadoEm))
        : [];
      const orcPorOs = new Map<string, (typeof orcs)[number]>();
      for (const o of orcs) if (!orcPorOs.has(o.osId)) orcPorOs.set(o.osId, o);

      const orcIds = [...orcPorOs.values()].map((o) => o.id);
      const itens = orcIds.length
        ? await db
            .select({
              orcamentoId: orcamentoItem.orcamentoId,
              nome: servico.nome,
              quantidade: orcamentoItem.quantidade,
              precoUnitario: orcamentoItem.precoUnitario,
              subtotal: orcamentoItem.subtotal,
            })
            .from(orcamentoItem)
            .innerJoin(servico, eq(orcamentoItem.servicoId, servico.id))
            .where(inArray(orcamentoItem.orcamentoId, orcIds))
        : [];
      const itensPorOrc = new Map<string, ItemView[]>();
      for (const i of itens) {
        const lista = itensPorOrc.get(i.orcamentoId) ?? [];
        lista.push({
          nome: i.nome,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
          subtotal: i.subtotal,
        });
        itensPorOrc.set(i.orcamentoId, lista);
      }

      const ordensView: OsView[] = ordens.map((o) => {
        const orc = orcPorOs.get(o.id);
        return {
          id: o.id,
          categoria: o.categoria,
          estado: o.estado,
          agendadoPara: o.agendadoPara ? new Date(o.agendadoPara) : null,
          orcamento: orc
            ? {
                totalMaoDeObra: orc.totalMaoDeObra,
                totalDeslocamento: orc.totalDeslocamento,
                total: orc.total,
                validoAte: orc.validoAte,
                itens: itensPorOrc.get(orc.id) ?? [],
              }
            : null,
          tecnico: o.tecnicoId && o.tecnicoNome
            ? {
                id: o.tecnicoId,
                nome: o.tecnicoNome,
                fotoUrl: o.tecnicoFotoUrl,
                slug: o.tecnicoSlug,
              }
            : null,
        };
      });

      return {
        token: sol.token,
        clienteNome: sol.clienteNome,
        cidade: sol.endereco?.cidade ?? null,
        uf: sol.endereco?.uf ?? null,
        criadoEm: sol.criadoEm,
        ordens: ordensView,
      };
    },

    async expirarVencidas(token, agora): Promise<void> {
      const solId = await idDaSolicitacao(token);
      if (!solId) return;
      // Expira pelo orçamento MAIS RECENTE da OS (mesmo que carregarPorToken
      // exibe) — não por qualquer orçamento antigo eventualmente vencido.
      await db
        .update(ordemServico)
        .set({ estado: "EXPIRADA" })
        .where(
          and(
            eq(ordemServico.solicitacaoId, solId),
            eq(ordemServico.estado, "ORCADA"),
            sql`(
              select ${orcamento.validoAte} from ${orcamento}
              where ${orcamento.osId} = ${ordemServico.id}
              order by ${orcamento.criadoEm} desc
              limit 1
            ) < ${agora}`,
          ),
        );
    },

    async aprovar(token, osId, assinatura: Assinatura): Promise<boolean> {
      const agora = new Date();
      const solId = await idDaSolicitacao(token);
      if (!solId) return false;
      const orc = await orcamentoMaisRecente(osId);
      if (!orc || orc.validoAte.getTime() < agora.getTime()) return false;

      // Portão atômico: OS da Solicitação do token e ainda ORÇADA.
      const transitadas = await db
        .update(ordemServico)
        .set({ estado: "APROVADA" })
        .where(
          and(
            eq(ordemServico.id, osId),
            eq(ordemServico.solicitacaoId, solId),
            eq(ordemServico.estado, "ORCADA"),
          ),
        )
        .returning({ id: ordemServico.id });
      if (transitadas.length === 0) return false;

      // Carimba a assinatura no orçamento específico que estava sendo aprovado.
      await db
        .update(orcamento)
        .set({
          aprovadoEm: agora,
          assinaturaToken: assinatura.token,
          assinaturaIp: assinatura.ip,
        })
        .where(eq(orcamento.id, orc.id));
      return true;
    },

    async rejeitar(token, osId, motivo): Promise<boolean> {
      const agora = new Date();
      const solId = await idDaSolicitacao(token);
      if (!solId) return false;
      const orc = await orcamentoMaisRecente(osId);
      if (!orc) return false;

      const transitadas = await db
        .update(ordemServico)
        .set({ estado: "REJEITADA" })
        .where(
          and(
            eq(ordemServico.id, osId),
            eq(ordemServico.solicitacaoId, solId),
            eq(ordemServico.estado, "ORCADA"),
          ),
        )
        .returning({ id: ordemServico.id });
      if (transitadas.length === 0) return false;

      await db
        .update(orcamento)
        .set({ rejeitadoEm: agora, motivoRejeicao: motivo })
        .where(eq(orcamento.id, orc.id));
      return true;
    },
  };
}
