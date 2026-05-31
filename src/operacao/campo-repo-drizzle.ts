import {
  and,
  asc,
  count,
  eq,
  inArray,
  sql,
} from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  cliente,
  fotoPortfolio,
  membro,
  ordemServico,
  solicitacao,
  transicaoOs,
} from "@/db/schema";
import type { CampoRepo, FiltroTecnicosEmCampo, TecnicoEmCampo } from "./campo-repo";
import { ESTADOS_CAMPO } from "./campo-repo";
import type { EstadoOs } from "./fila-repo";

type Endereco = NonNullable<typeof solicitacao.$inferSelect.endereco>;

function formatarEndereco(end: Endereco): string {
  const partes = [end.logradouro];
  if (end.numero) partes.push(end.numero);
  if (end.bairro) partes.push(end.bairro);
  partes.push(`${end.cidade}/${end.uf}`);
  return partes.join(", ");
}

export function criarCampoRepoDrizzle(db: DB): CampoRepo {
  return {
    async listarTecnicosEmCampo(filtro?: FiltroTecnicosEmCampo) {
      const estadosFiltro: EstadoOs[] = filtro?.estado
        ? [filtro.estado]
        : [...ESTADOS_CAMPO];

      const conds = [inArray(ordemServico.estado, estadosFiltro)];

      if (filtro?.tecnicoId) {
        conds.push(eq(ordemServico.tecnicoId, filtro.tecnicoId));
      }
      if (filtro?.categoria) {
        conds.push(eq(ordemServico.categoria, filtro.categoria));
      }

      /**
       * Estratégia de query:
       * 1. Busca OS em estado de campo com JOIN em solicitação, cliente e membro.
       * 2. Para cada OS, busca a última transição que definiu o estado atual
       *    (estadoNovo = estado atual da OS) via subquery com MAX(em).
       * 3. Conta fotos ANTES no fotoPortfolio para detectar inconsistência.
       *
       * Executado em dois passos para manter legibilidade e evitar GROUP BY
       * complexo: primeiro busca as OS, depois enriches com transição e foto.
       */

      // Passo 1: OS em campo com dados básicos
      const linhas = await db
        .select({
          osId: ordemServico.id,
          estado: ordemServico.estado,
          categoria: ordemServico.categoria,
          tecnicoId: membro.id,
          tecnicoNome: membro.nome,
          clienteNome: cliente.nome,
          endereco: solicitacao.endereco,
        })
        .from(ordemServico)
        .innerJoin(solicitacao, eq(ordemServico.solicitacaoId, solicitacao.id))
        .innerJoin(cliente, eq(solicitacao.clienteId, cliente.id))
        .innerJoin(membro, eq(ordemServico.tecnicoId, membro.id))
        .where(and(...conds));

      if (linhas.length === 0) return [];

      const osIds = linhas.map((l) => l.osId);

      // Passo 2: última transição para cada OS (estadoNovo = estado atual)
      // Busca o MAX(em) por OS, depois faz JOIN para obter o timestamp exato.
      const ultimasTransicoes = await db
        .select({
          osId: transicaoOs.osId,
          em: sql<Date>`MAX(${transicaoOs.em})`.as("ultima_em"),
        })
        .from(transicaoOs)
        .where(inArray(transicaoOs.osId, osIds))
        .groupBy(transicaoOs.osId);

      const transicaoPorOs = new Map(
        ultimasTransicoes.map((t) => [t.osId, new Date(t.em)]),
      );

      // Passo 3: contar fotos ANTES por OS (apenas para EM_EXECUCAO)
      const idsEmExecucao = linhas
        .filter((l) => l.estado === "EM_EXECUCAO")
        .map((l) => l.osId);

      const fotosAntes =
        idsEmExecucao.length > 0
          ? await db
              .select({
                osId: fotoPortfolio.osId,
                qtd: count(fotoPortfolio.id),
              })
              .from(fotoPortfolio)
              .where(
                and(
                  inArray(fotoPortfolio.osId, idsEmExecucao),
                  eq(fotoPortfolio.tipo, "ANTES"),
                ),
              )
              .groupBy(fotoPortfolio.osId)
          : [];

      const fotosPorOs = new Map(fotosAntes.map((f) => [f.osId, f.qtd]));

      // Monta o resultado ordenado por ultimaTransicaoEm ASC (maior tempo primeiro)
      const resultado: TecnicoEmCampo[] = linhas.map((l) => {
        const ultimaTransicaoEm =
          transicaoPorOs.get(l.osId) ?? new Date(0);
        const temFotoAntes = (fotosPorOs.get(l.osId) ?? 0) > 0;
        const inconsistente = l.estado === "EM_EXECUCAO" && !temFotoAntes;

        return {
          osId: l.osId,
          osNumero: l.osId.slice(0, 8).toUpperCase(),
          estado: l.estado as TecnicoEmCampo["estado"],
          ultimaTransicaoEm,
          tecnicoId: l.tecnicoId,
          tecnicoNome: l.tecnicoNome,
          tecnicoWhatsapp: null, // campo não existe no schema membro
          clienteNome: l.clienteNome,
          endereco: l.endereco ? formatarEndereco(l.endereco) : "",
          categoria: l.categoria,
          inconsistente,
        };
      });

      // Ordena: maior tempo no estado = menor ultimaTransicaoEm vem primeiro
      resultado.sort(
        (a, b) =>
          a.ultimaTransicaoEm.getTime() - b.ultimaTransicaoEm.getTime(),
      );

      return resultado;
    },
  };
}
