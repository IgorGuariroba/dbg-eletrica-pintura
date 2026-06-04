import { config } from "dotenv";

// Limpa dados órfãos de seeds de testes de integração que crasharam antes do
// afterAll. Roda UMA vez, antes de qualquer worker — assim nunca colide com a
// execução paralela dos arquivos de teste (cada arquivo só apaga, no afterAll,
// os ids que ele mesmo criou; este setup varre o lixo histórico acumulado).
//
// Sem isso, OS órfãs em estado NOVA enchem a janela `limit` da fila e os testes
// de filtro/listagem passam a falhar de forma intermitente.
//
// Filtra apenas pelos padrões de seed dos testes; jamais toca dados reais.
// A ordem respeita as foreign keys.
export default async function setup() {
  config({ path: ".env.local" });
  if (!process.env.DATABASE_URL) return;

  // globalSetup não passa pelos setupFiles — configura o proxy aqui também.
  const { configurarProxyLocalNeon } = await import("@/db/neon-local-proxy");
  configurarProxyLocalNeon();

  const { db } = await import("@/db/client");
  const {
    cliente,
    membro,
    ordemServico,
    orcamento,
    pagamento,
    servico,
    solicitacao,
    garantiaChamado,
  } = await import("@/db/schema");
  const { like, or, inArray } = await import("drizzle-orm");

  // Solicitações de teste (tokens "tok-...") + suas OS e orçamentos.
  const sols = await db
    .select({ id: solicitacao.id })
    .from(solicitacao)
    .where(like(solicitacao.token, "tok-%"));
  const solIds = sols.map((s) => s.id);

  if (solIds.length) {
    const oss = await db
      .select({ id: ordemServico.id })
      .from(ordemServico)
      .where(inArray(ordemServico.solicitacaoId, solIds));
    const osIds = oss.map((o) => o.id);
    if (osIds.length) {
      // chamados de garantia referenciam a OS
      await db.delete(garantiaChamado).where(inArray(garantiaChamado.osOrigemId, osIds));
      // pagamento tem FK `restrict` para a OS — apagar antes da OS.
      await db.delete(pagamento).where(inArray(pagamento.osId, osIds));
      // orcamentoItem cai por cascade ao apagar o orçamento.
      await db.delete(orcamento).where(inArray(orcamento.osId, osIds));
    }
    await db
      .delete(ordemServico)
      .where(inArray(ordemServico.solicitacaoId, solIds));
    await db.delete(solicitacao).where(inArray(solicitacao.id, solIds));
  }

  // Catálogo de teste ("Srv ...") — só após remover itens de orçamento acima.
  await db.delete(servico).where(like(servico.nome, "Srv %"));

  // Clientes semeados ("Cli ", "Teste ", "A ", "A novo ").
  await db
    .delete(cliente)
    .where(
      or(
        like(cliente.nome, "Cli %"),
        like(cliente.nome, "Teste %"),
        like(cliente.nome, "A %"),
        like(cliente.nome, "A novo %"),
      ),
    );

  // Membros técnicos semeados ("...@dbg.test").
  await db.delete(membro).where(like(membro.email, "%@dbg.test"));
}
