import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  membro,
  notificacaoInApp,
  ordemServico,
  osHistoricoConflito,
  solicitacao,
} from "@/db/schema";
import { aplicarTransicao } from "@/operacao/maquina-estado";
import { criarTransicaoRepoDrizzle } from "@/operacao/transicao-repo-drizzle";
import {
  uploadFotoOsR2,
  type UploadFotoOs,
  type UploadFotoChecklist,
  uploadAssinaturaOsR2,
  uploadFotoChecklistR2,
} from "@/operacao/r2-privado";
import type { UploadAssinatura } from "@/operacao/aprovacao-presencial";
import type { PortfolioRepo } from "@/marketing/portfolio-repo";
import type { ChecklistResultadoRepo } from "@/operacao/checklist-resultado-repo";

export interface SyncItem {
  id?: number;
  tipo: string;
  payload: any;
  criadoEm: string;
}

export interface SyncResult {
  conflito: boolean;
  erro?: string;
}

export interface SyncOptions {
  uploadFoto?: UploadFotoOs;
  uploadAssinatura?: UploadAssinatura;
  portfolioRepo?: PortfolioRepo;
  uploadFotoChecklist?: UploadFotoChecklist;
  checklistResultadoRepo?: ChecklistResultadoRepo;
}

export async function processarItemSync(
  db: DB,
  item: SyncItem,
  sessionEmail: string,
  options?: SyncOptions
): Promise<SyncResult> {
  const payload = item.payload;
  const osId = payload.osId || payload.osPaiId;

  if (osId) {
    // Busca o técnico atual atribuído à OS no banco, incluindo origem da Solicitação
    const [os] = await db
      .select({
        tecnicoEmail: membro.email,
        tecnicoId: ordemServico.tecnicoId,
        categoria: ordemServico.categoria,
        estado: ordemServico.estado,
        metadados: ordemServico.metadados,
        origem: solicitacao.origem,
      })
      .from(ordemServico)
      .leftJoin(membro, eq(ordemServico.tecnicoId, membro.id))
      .leftJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
      .where(eq(ordemServico.id, osId))
      .limit(1);

    // Se a OS foi reatribuída (tecnicoEmail !== sessionEmail), temos um conflito
    if (!os || os.tecnicoEmail !== sessionEmail) {
      // 1. Grava no histórico de conflitos
      await db.insert(osHistoricoConflito).values({
        osId,
        tipo: item.tipo,
        payload,
        tecnicoEmail: sessionEmail,
        criadoEm: new Date(item.criadoEm),
      });

      // 2. Cria notificação para o técnico original
      await db.insert(notificacaoInApp).values({
        destinatarioEmail: sessionEmail,
        titulo: "OS Reatribuída",
        mensagem: `Sua OS ${osId} foi reatribuída. Os dados inseridos offline foram salvos no histórico.`,
        lida: false,
      });

      // 3. Cria notificação para o admin do módulo Operação
      await db.insert(notificacaoInApp).values({
        destinatarioModulo: "OPERACAO",
        titulo: "Conflito de Reatribuição",
        mensagem: `O técnico ${sessionEmail} tentou enviar alterações offline para a OS ${osId}, que agora está sob outra atribuição.`,
        lida: false,
      });

      return { conflito: true };
    }

    // Processamento da ação sem conflito
    if (item.tipo === "TRANSICAO") {
      const repo = criarTransicaoRepoDrizzle(db);
      await aplicarTransicao(
        osId,
        payload.alvo,
        sessionEmail,
        payload.motivo || null,
        repo,
        new Date(item.criadoEm),
        payload.lat && payload.lon ? { lat: payload.lat, lon: payload.lon } : undefined
      );

      const { notificar } = await import("@/notificacao/notificar");
      notificar({ tipo: "os.transicao", osId, estadoNovo: payload.alvo }).catch((e) => {
        console.error(`Erro ao despachar notificação da OS ${osId}:`, e);
      });
    } else if (item.tipo === "FOTO") {
      const uploadService = options?.uploadFoto ?? uploadFotoOsR2();
      const { url } = await uploadService.enviarFoto({
        osId,
        tipo: payload.tipo,
        dataUrl: payload.dataUrl,
      });
      // Foto marcada "boa pra portfólio" pelo técnico entra na fila do Marketing.
      if (payload.portfolio) {
        const repo =
          options?.portfolioRepo ??
          (await import("@/marketing/portfolio-repo-drizzle")).criarPortfolioRepoDrizzle(db);
        await repo.marcar({
          osId,
          tecnicoId: os.tecnicoId,
          categoria: os.categoria,
          tipo: payload.tipo,
          chavePrivada: url,
        });
      }
    } else if (item.tipo === "NOTA") {
      const novosMetadados = {
        ...os.metadados,
        notaServico: payload.texto,
      };
      await db
        .update(ordemServico)
        .set({ metadados: novosMetadados })
        .where(eq(ordemServico.id, osId));
    } else if (item.tipo === "MATERIAL") {
      const materiaisAtuais = os.metadados?.materiais || [];
      const novosMateriais = [
        ...materiaisAtuais,
        {
          item: payload.item,
          quantidade: payload.quantidade,
          observacao: payload.observacao,
        },
      ];
      const novosMetadados = {
        ...os.metadados,
        materiais: novosMateriais,
      };
      await db
        .update(ordemServico)
        .set({ metadados: novosMetadados })
        .where(eq(ordemServico.id, osId));
    } else if (item.tipo === "APROVACAO_PRESENCIAL") {
      const { aprovarPresencial } = await import(
        "@/operacao/aprovacao-presencial"
      );
      const { criarAprovacaoPresencialRepoDrizzle } = await import(
        "@/operacao/aprovacao-presencial-repo-drizzle"
      );
      const uploadService = options?.uploadAssinatura ?? uploadAssinaturaOsR2();
      await aprovarPresencial(
        {
          osId,
          aprovou: payload.aprovou,
          lgpdAceito: payload.lgpdAceito,
          assinaturaDataUrl: payload.assinaturaDataUrl,
          tecnicoEmail: sessionEmail,
          origem: (os.origem || "FORMULARIO") as import("@/operacao/aprovacao-presencial").Origem,
        },
        {
          repo: criarAprovacaoPresencialRepoDrizzle(db),
          upload: uploadService,
          agora: new Date(item.criadoEm),
        }
      );
    } else if (item.tipo === "CRIACAO_COMPLEMENTAR") {
      const [tec] = await db
        .select({ id: membro.id })
        .from(membro)
        .where(eq(membro.email, sessionEmail))
        .limit(1);
      if (!tec) {
        return { conflito: false, erro: "Técnico não encontrado no sistema" };
      }
      const { criarComplementar } = await import("@/operacao/complementar");
      const { criarComplementarRepoDrizzle } = await import(
        "@/operacao/complementar-repo-drizzle"
      );
      const { criarOperacaoConfigRepoDrizzle } = await import(
        "@/operacao/config-repo-drizzle"
      );

      const config = await criarOperacaoConfigRepoDrizzle(db).obter();
      await criarComplementar(
        {
          osPaiId: payload.osPaiId,
          itens: payload.itens,
          km: payload.km,
          deslocamentoOverride: payload.deslocamentoOverride,
        },
        { membroId: tec.id, isTecnico: true },
        { precoLitro: config.precoLitro, kmPorLitro: config.kmPorLitro },
        criarComplementarRepoDrizzle(db)
      );
    } else if (item.tipo === "CHECKLIST") {
      const uploadService =
        options?.uploadFotoChecklist ?? uploadFotoChecklistR2();
      const repo =
        options?.checklistResultadoRepo ??
        (
          await import("@/operacao/checklist-resultado-repo-drizzle")
        ).criarChecklistResultadoRepoDrizzle(db);

      const linhas = [];
      for (const r of payload.resultados as Array<{
        itemId: string;
        descricaoSnapshot: string;
        status: "OK" | "PROBLEMA" | "NA";
        observacao: string | null;
        dataUrl?: string;
      }>) {
        let fotoUrl: string | null = null;
        if (r.dataUrl) {
          const { url } = await uploadService.enviar({
            osId,
            itemId: r.itemId,
            dataUrl: r.dataUrl,
          });
          fotoUrl = url;
        }
        linhas.push({
          osId,
          itemId: r.itemId,
          descricaoSnapshot: r.descricaoSnapshot,
          status: r.status,
          observacao: r.observacao ?? null,
          fotoUrl,
        });
      }
      await repo.salvarResultados(linhas);
    } else if (item.tipo === "PAGAMENTO_MANUAL") {
      const { registrarPagamentoManual } = await import("@/pagamento/registrar-manual");
      const { criarPagamentoRepoDrizzle } = await import("@/pagamento/pagamento-repo-drizzle");
      const { criarTransicaoRepoDrizzle } = await import("@/operacao/transicao-repo-drizzle");

      const deps = {
        pagamentoRepo: criarPagamentoRepoDrizzle(db),
        transicaoRepo: criarTransicaoRepoDrizzle(db),
      };

      const res = await registrarPagamentoManual(
        osId,
        {
          valor: payload.valor,
          metodo: payload.metodo,
          observacao: payload.observacao,
          atorEmail: sessionEmail,
        },
        deps,
        new Date(item.criadoEm)
      );

      if (!res.ok) {
        return { conflito: false, erro: res.erro };
      }
    }
  } else if (item.tipo === "SOLICITACAO_EXPRESS") {
    const [tec] = await db
      .select({ id: membro.id })
      .from(membro)
      .where(eq(membro.email, sessionEmail))
      .limit(1);
    if (!tec) {
      return { conflito: false, erro: "Técnico não encontrado no sistema" };
    }
    const { criarSolicitacaoRepoDrizzle } = await import(
      "@/operacao/solicitacao-repo-drizzle"
    );
    const repo = criarSolicitacaoRepoDrizzle(db);
    const r = Math.random().toString(36).slice(2, 10);
    const token = `tok-exp-${r}`;
    await repo.criarComOrdens({
      cliente: { nome: payload.nome, whatsapp: payload.whatsapp },
      solicitacao: {
        token,
        categorias: payload.categorias,
        descricao: "Criada via Solicitação Express pelo técnico no local (Offline Sync)",
        fotosUrls: [],
        endereco: payload.endereco,
        dataDesejada: null,
        duracaoEstimada: null,
        lgpdAceito: true,
        origem: "EXPRESS_TECNICO",
      },
      ordensCustom: {
        tipo: "EXPRESS",
        estado: "ORCADA",
        tecnicoId: tec.id,
      },
    });
  }

  return { conflito: false };
}



