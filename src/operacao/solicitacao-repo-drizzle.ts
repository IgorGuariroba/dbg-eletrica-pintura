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
      // Neon HTTP não suporta transação multi-statement; faz upsert + inserts
      // sequenciais. O upsert do cliente é atômico via UNIQUE(whatsapp).
      const [cli] = await db
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

      if (input.indicadorId) {
        await db
          .insert(indicacao)
          .values({
            indicadorId: input.indicadorId,
            indicadoId: cli.id,
            descontoAplicado: false,
            creditoGerado: false,
          })
          .onConflictDoNothing();
      }

      const [sol] = await db
        .insert(solicitacao)
        .values({
          token: nova.token,
          clienteId: cli.id,
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

      const ordens = await db
        .insert(ordemServico)
        .values(
          nova.categorias.map((cat) => ({
            solicitacaoId: sol.id,
            categoria: cat,
            tipo: input.ordensCustom?.tipo ?? ("NORMAL" as const),
            estado: input.ordensCustom?.estado ?? ("NOVA" as const),
            tecnicoId: input.ordensCustom?.tecnicoId ?? null,
          })),
        )
        .returning();

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

