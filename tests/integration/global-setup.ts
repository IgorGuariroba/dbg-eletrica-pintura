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
    avaliacao,
    alertaAvaliacao,
    tratativa,
    assinatura,
    assinaturaEvento,
    plano,
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
      // tratativa, alertaAvaliacao e avaliacao têm FK `restrict` para a OS —
      // apagar antes dela. Testes de avaliação (e jobs globais que varrem OS
      // CONCLUIDA) deixam essas linhas órfãs; sem isto, o delete da OS quebra
      // por violação de FK. Ordem: tratativa → alerta → avaliacao (depoimentos
      // de landing caem por cascade ao remover a avaliação).
      await db.delete(tratativa).where(inArray(tratativa.osId, osIds));
      await db.delete(alertaAvaliacao).where(inArray(alertaAvaliacao.osId, osIds));
      await db.delete(avaliacao).where(inArray(avaliacao.osId, osIds));
    }
    await db
      .delete(ordemServico)
      .where(inArray(ordemServico.solicitacaoId, solIds));
    await db.delete(solicitacao).where(inArray(solicitacao.id, solIds));
  }

  // Catálogo de teste ("Srv ...") — só após remover itens de orçamento acima.
  await db.delete(servico).where(like(servico.nome, "Srv %"));

  // Assinaturas de teste: `assinatura` referencia cliente E plano (FK restrict),
  // então apagar antes deles. `assinatura_evento` não tem FK (preapproval "pre-").
  // Nem toda assinatura de teste tem preapprovalIdMp "pre-%" (ex.: dashboard
  // semeia direto com preapproval nulo), então também removemos as que apontam
  // para planos de teste ("Plano %"), senão o delete do plano quebra por FK.
  await db
    .delete(assinaturaEvento)
    .where(like(assinaturaEvento.preapprovalIdMp, "pre-%"));
  const planosTeste = await db
    .select({ id: plano.id })
    .from(plano)
    .where(like(plano.nome, "Plano %"));
  const planoIdsTeste = planosTeste.map((p) => p.id);
  await db.delete(assinatura).where(like(assinatura.preapprovalIdMp, "pre-%"));
  if (planoIdsTeste.length) {
    await db.delete(assinatura).where(inArray(assinatura.planoId, planoIdsTeste));
  }
  await db.delete(plano).where(like(plano.nome, "Plano %"));

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
