import { eq, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { cliente, ordemServico, solicitacao, indicacao } from "@/db/schema";
import type {
  Cliente,
  OrdemServico,
  ResultadoCriacao,
  Solicitacao,
  SolicitacaoRepo,
} from "./solicitacao-repo";

function clienteRow(r: typeof cliente.$inferSelect): Cliente {
  return {
    id: r.id,
    nome: r.nome,
    whatsapp: r.whatsapp,
    email: r.email,
    endereco: r.endereco ?? null,
    criadoEm: r.criadoEm,
  };
}

function solicitacaoRow(r: typeof solicitacao.$inferSelect): Solicitacao {
  return {
    id: r.id,
    token: r.token,
    clienteId: r.clienteId,
    categorias: r.categorias,
    descricao: r.descricao,
    fotosUrls: r.fotosUrls,
    endereco: r.endereco!,
    dataDesejada: r.dataDesejada,
    duracaoEstimada: r.duracaoEstimada,
    lgpdAceito: r.lgpdAceito,
    origem: r.origem as Solicitacao["origem"],
    foraCobertura: r.foraCobertura,
    criadoEm: r.criadoEm,
  };
}

function osRow(r: typeof ordemServico.$inferSelect): OrdemServico {
  return {
    id: r.id,
    solicitacaoId: r.solicitacaoId,
    categoria: r.categoria,
    tipo: r.tipo,
    estado: r.estado,
    tecnicoId: r.tecnicoId,
    criadoEm: r.criadoEm,
  };
}

export function criarSolicitacaoRepoDrizzle(db: DB): SolicitacaoRepo {
  return {
    async criarComOrdens(input) {
      const { cliente: novoCli, solicitacao: nova } = input;
      // Neon HTTP não tem transação interativa, mas db.batch() roda todos os
      // statements em UMA transação. Como o batch não permite usar valores
      // retornados entre statements, os ids são resolvidos por subquery
      // (cliente por whatsapp, solicitação por token) dentro da própria tx.
      const upsertCliente = db
        .insert(cliente)
        .values({
          nome: novoCli.nome,
          whatsapp: novoCli.whatsapp,
          email: novoCli.email ?? null,
          endereco: novoCli.endereco ?? null,
        })
        .onConflictDoUpdate({
          target: cliente.whatsapp,
          set: {
            // Preserva o cadastro original; só completa campos vazios.
            nome: sql`coalesce(nullif(${cliente.nome}, ''), excluded.nome)`,
            email: sql`coalesce(${cliente.email}, excluded.email)`,
            endereco: sql`coalesce(${cliente.endereco}, excluded.endereco)`,
          },
        })
        .returning();

      const clienteIdPorWhatsapp = sql`(select id from ${cliente} where ${cliente.whatsapp} = ${novoCli.whatsapp})`;
      const solicitacaoIdPorToken = sql`(select id from ${solicitacao} where ${solicitacao.token} = ${nova.token})`;

      const inserirSolicitacao = db
        .insert(solicitacao)
        .values({
          token: nova.token,
          clienteId: clienteIdPorWhatsapp,
          categorias: nova.categorias,
          descricao: nova.descricao,
          fotosUrls: nova.fotosUrls,
          endereco: nova.endereco,
          dataDesejada: nova.dataDesejada,
          duracaoEstimada: nova.duracaoEstimada,
          lgpdAceito: nova.lgpdAceito,
          origem: nova.origem,
          foraCobertura: nova.foraCobertura ?? false,
        })
        .returning();

      const inserirOrdens = db
        .insert(ordemServico)
        .values(
          nova.categorias.map((cat) => ({
            solicitacaoId: solicitacaoIdPorToken,
            categoria: cat,
            tipo: input.ordensCustom?.tipo ?? ("NORMAL" as const),
            estado: input.ordensCustom?.estado ?? ("NOVA" as const),
            tecnicoId: input.ordensCustom?.tecnicoId ?? null,
          })),
        )
        .returning();

      let cli: typeof cliente.$inferSelect;
      let sol: typeof solicitacao.$inferSelect;
      let ordens: (typeof ordemServico.$inferSelect)[];
      if (input.indicadorId) {
        const inserirIndicacao = db
          .insert(indicacao)
          .values({
            indicadorId: input.indicadorId,
            indicadoId: clienteIdPorWhatsapp,
            descontoAplicado: false,
            creditoGerado: false,
          })
          .onConflictDoNothing();
        const [clientes, , solicitacoes, ordensRows] = await db.batch([
          upsertCliente,
          inserirIndicacao,
          inserirSolicitacao,
          inserirOrdens,
        ]);
        [cli] = clientes;
        [sol] = solicitacoes;
        ordens = ordensRows;
      } else {
        const [clientes, solicitacoes, ordensRows] = await db.batch([
          upsertCliente,
          inserirSolicitacao,
          inserirOrdens,
        ]);
        [cli] = clientes;
        [sol] = solicitacoes;
        ordens = ordensRows;
      }

      const r: ResultadoCriacao = {
        cliente: clienteRow(cli),
        solicitacao: solicitacaoRow(sol),
        ordens: ordens.map(osRow),
      };
      return r;
    },
    async buscarPorToken(token) {
      const [sol] = await db
        .select()
        .from(solicitacao)
        .where(eq(solicitacao.token, token))
        .limit(1);
      if (!sol) return null;

      const [cli] = await db
        .select()
        .from(cliente)
        .where(eq(cliente.id, sol.clienteId))
        .limit(1);

      const ordens = await db
        .select()
        .from(ordemServico)
        .where(eq(ordemServico.solicitacaoId, sol.id));

      return {
        solicitacao: solicitacaoRow(sol),
        cliente: clienteRow(cli),
        ordens: ordens.map(osRow),
      };
    },
  };
}

