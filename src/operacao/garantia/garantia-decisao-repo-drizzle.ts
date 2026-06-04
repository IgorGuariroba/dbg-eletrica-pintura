import { eq, and, desc, asc } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  ordemServico,
  garantiaChamado,
  membro,
  pagamento,
  transicaoOs,
  solicitacao,
  cliente,
} from "@/db/schema";
import type { GarantiaDecisaoRepo, ChamadoDecisao, ChamadoPendenteLista } from "./aplicar-garantia";
import type { Categoria } from "@/equipe/membro-repo";
import { transicionar, type TipoOs } from "@/operacao/maquina-estado";
import { avaliarAcionamentoGarantia } from "./avaliar-acionamento";
import crypto from "crypto";

export function criarGarantiaDecisaoRepoDrizzle(dbRaw: DB): GarantiaDecisaoRepo {
  return {
    async listarChamadosPendentes(): Promise<ChamadoPendenteLista[]> {
      const rows = await dbRaw
        .select({
          chamado: garantiaChamado,
          os: ordemServico,
          sol: solicitacao,
          cli: cliente,
          tec: membro,
        })
        .from(garantiaChamado)
        .innerJoin(ordemServico, eq(garantiaChamado.osOrigemId, ordemServico.id))
        .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
        .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
        .leftJoin(membro, eq(ordemServico.tecnicoId, membro.id))
        .where(eq(garantiaChamado.status, "pendente"))
        .orderBy(desc(garantiaChamado.criadoEm));

      const list: ChamadoPendenteLista[] = [];

      for (const row of rows) {
        let osAnchor = row.os;
        const visited = new Set<string>([osAnchor.id]);
        while (osAnchor.tipo === "GARANTIA" && osAnchor.osPaiId) {
          if (visited.has(osAnchor.osPaiId)) break;
          visited.add(osAnchor.osPaiId);
          const [pai] = await dbRaw
            .select()
            .from(ordemServico)
            .where(eq(ordemServico.id, osAnchor.osPaiId))
            .limit(1);
          if (!pai) break;
          osAnchor = pai;
        }

        let prazo = { dentroDoPrazo: false, fim: new Date(0) };
        if (osAnchor.prazoGarantiaMeses != null) {
          const [pag] = await dbRaw
            .select()
            .from(pagamento)
            .where(and(eq(pagamento.osId, osAnchor.id), eq(pagamento.status, "approved")))
            .orderBy(desc(pagamento.criadoEm))
            .limit(1);
          if (pag) {
            const avaliacao = avaliarAcionamentoGarantia({
              agora: new Date(),
              ancora: {
                prazoMeses: osAnchor.prazoGarantiaMeses,
                pagamentoEm: pag.criadoEm,
              },
              temComplementarRejeitado: false,
            });
            prazo = {
              dentroDoPrazo: avaliacao.dentroDoPrazo,
              fim: avaliacao.fim,
            };
          }
        }

        list.push({
          id: row.chamado.id,
          descricao: row.chamado.descricao,
          fotoUrl: row.chamado.fotoUrl,
          criadoEm: row.chamado.criadoEm,
          criadoPor: row.chamado.criadoPor,
          canal: row.chamado.canal as any,
          temComplementarRejeitado: row.chamado.temComplementarRejeitado,
          acionamentoInvalido: row.chamado.acionamentoInvalido,
          osOrigem: {
            id: row.os.id,
            tipo: row.os.tipo as any,
            estado: row.os.estado,
            categoria: row.os.categoria as any,
          },
          cliente: {
            nome: row.cli.nome,
            whatsapp: row.cli.whatsapp,
          },
          tecnicoOriginal: row.tec ? { id: row.tec.id, nome: row.tec.nome } : null,
          prazo,
        });
      }

      return list;
    },

    async carregarChamado(chamadoId: string): Promise<ChamadoDecisao | null> {
      const [chamado] = await dbRaw
        .select()
        .from(garantiaChamado)
        .where(eq(garantiaChamado.id, chamadoId))
        .limit(1);
      if (!chamado) return null;

      // Walk up the parent OS hierarchy to find the paid anchor OS
      let [os] = await dbRaw
        .select()
        .from(ordemServico)
        .where(eq(ordemServico.id, chamado.osOrigemId))
        .limit(1);
      if (!os) return null;

      const originalOs = os;

      const visited = new Set<string>([os.id]);
      while (os.tipo === "GARANTIA" && os.osPaiId) {
        if (visited.has(os.osPaiId)) {
          return null; // loop
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

      // Load approved payment for the anchor OS
      const [pag] = await dbRaw
        .select()
        .from(pagamento)
        .where(and(eq(pagamento.osId, os.id), eq(pagamento.status, "approved")))
        .orderBy(desc(pagamento.criadoEm))
        .limit(1);
      if (!pag) return null;

      const tecnicoOriginalId = originalOs.tecnicoId;
      let tecnicoOriginalDisponivel = false;

      if (tecnicoOriginalId) {
        const [tec] = await dbRaw
          .select()
          .from(membro)
          .where(eq(membro.id, tecnicoOriginalId))
          .limit(1);
        if (tec && tec.ativo && tec.isTecnico) {
          const especs = tec.especialidades || [];
          if (especs.includes(originalOs.categoria)) {
            tecnicoOriginalDisponivel = true;
          }
        }
      }

      return {
        id: chamado.id,
        status: chamado.status as any,
        osOrigemId: chamado.osOrigemId,
        ancora: {
          ancoraId: os.id,
          prazoMeses: os.prazoGarantiaMeses,
          pagamentoEm: pag.criadoEm,
          tipo: os.tipo as any,
        },
        categoria: originalOs.categoria as any,
        tecnicoOriginalId,
        tecnicoOriginalDisponivel,
      };
    },

    async aplicar(dados): Promise<{ osGarantiaId: string }> {
      // 1. Carrega OS origem
      const [osOrigem] = await dbRaw
        .select()
        .from(ordemServico)
        .where(eq(ordemServico.id, dados.osOrigemId))
        .limit(1);
      if (!osOrigem) throw new Error("OS origem não encontrada");

      // 2. Transiciona OS origem para GARANTIA_ABERTA
      const histRows = await dbRaw
        .select({
          estadoAnterior: transicaoOs.estadoAnterior,
          estadoNovo: transicaoOs.estadoNovo,
        })
        .from(transicaoOs)
        .where(eq(transicaoOs.osId, dados.osOrigemId))
        .orderBy(asc(transicaoOs.em));
      const historico = histRows.length > 0
        ? [histRows[0].estadoAnterior, ...histRows.map((r) => r.estadoNovo)]
        : [osOrigem.estado];

      const registro = transicionar(
        {
          tipo: osOrigem.tipo as any,
          estado: osOrigem.estado as any,
          historico: historico as any,
        },
        "GARANTIA_ABERTA",
        dados.decididoPor,
        "Abertura de garantia aprovada pelo administrador",
      );

      // Client-side pre-generated UUID for the new OS
      const novaOsId = crypto.randomUUID();

      // 3. Executa a escrita atômica via dbRaw.batch
      await dbRaw.batch([
        // Grava transição da OS origem
        dbRaw.insert(transicaoOs).values({
          osId: dados.osOrigemId,
          estadoAnterior: registro.estadoAnterior,
          estadoNovo: registro.estadoNovo,
          atorEmail: registro.atorEmail,
          motivo: registro.motivo,
          em: new Date(registro.em),
        }),
        // Atualiza estado da OS origem
        dbRaw
          .update(ordemServico)
          .set({ estado: "GARANTIA_ABERTA" })
          .where(eq(ordemServico.id, dados.osOrigemId)),
        // Cria a nova OS do tipo GARANTIA
        dbRaw.insert(ordemServico).values({
          id: novaOsId,
          solicitacaoId: osOrigem.solicitacaoId,
          osPaiId: dados.osOrigemId,
          tipo: "GARANTIA",
          estado: "AGENDADA",
          categoria: dados.categoria,
          tecnicoId: dados.tecnicoId,
          prazoGarantiaMeses: dados.prazoMeses,
          metadados: {},
        }),
        // Atualiza o chamado de garantia
        dbRaw
          .update(garantiaChamado)
          .set({
            status: "aplicada",
            osGarantiaId: novaOsId,
            decididoPor: dados.decididoPor,
            decididoEm: new Date(),
            overridePrazo: dados.override != null,
            justificativaOverride: dados.override ? dados.override.justificativa : null,
          })
          .where(eq(garantiaChamado.id, dados.chamadoId)),
      ]);

      return { osGarantiaId: novaOsId };
    },

    async rejeitar(chamadoId, motivo, decididoPor): Promise<void> {
      await dbRaw
        .update(garantiaChamado)
        .set({
          status: "rejeitada",
          motivoRejeicao: motivo,
          decididoPor,
          decididoEm: new Date(),
        })
        .where(eq(garantiaChamado.id, chamadoId));
    },
  };
}
