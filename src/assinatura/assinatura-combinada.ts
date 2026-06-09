/**
 * Assinatura vendida no combo "pagar tudo junto" do checkout (issue #65):
 * nasce PENDENTE sem pre-approval no MP — a 1ª mensalidade entra como item da
 * preferência de pagamento avulso e a ativação chega pelo webhook de
 * pagamentos (não pelo de subscriptions). A recorrência a partir do 2º ciclo
 * (autorização de pre-approval) é follow-up fora deste slice.
 */
export interface AssinaturaCombinadaRepo {
  /** Cria a assinatura PENDENTE sem preapproval (combo). Retorna o id. */
  criarPendente(dados: {
    clienteId: string;
    planoId: string;
  }): Promise<{ id: string }>;
  /**
   * Ativa a assinatura do combo se ainda PENDENTE (idempotente para webhook
   * duplicado). Retorna o resultado para o caller decidir efeitos colaterais.
   */
  ativarSePendente(
    assinaturaId: string,
    dados: { inicio: Date; fimCicloAtual: Date },
  ): Promise<"ativada" | "nao_pendente" | "nao_encontrada">;
}

/** Duração do 1º ciclo pago junto com o serviço: 1 mês. */
export function fimDoPrimeiroCiclo(inicio: Date): Date {
  const fim = new Date(inicio);
  fim.setMonth(fim.getMonth() + 1);
  return fim;
}

export interface AtivarCombinadaDeps {
  repo: AssinaturaCombinadaRepo;
  /** Boas-vindas — disparado só quando a ativação acontece de fato. */
  enviarBoasVindas?: (assinaturaId: string) => Promise<void>;
}

export interface AtivarCombinadaResultado {
  ativada: boolean;
}

/**
 * Caso de uso do webhook de pagamentos: ativa a assinatura do combo quando o
 * pagamento combinado é aprovado. Idempotente — webhook duplicado (assinatura
 * já ATIVA) não reativa nem reenvia boas-vindas.
 */
export async function ativarAssinaturaCombinada(
  assinaturaId: string,
  deps: AtivarCombinadaDeps,
  agora: Date = new Date(),
): Promise<AtivarCombinadaResultado> {
  const resultado = await deps.repo.ativarSePendente(assinaturaId, {
    inicio: agora,
    fimCicloAtual: fimDoPrimeiroCiclo(agora),
  });

  if (resultado !== "ativada") return { ativada: false };

  await deps.enviarBoasVindas?.(assinaturaId);
  return { ativada: true };
}
