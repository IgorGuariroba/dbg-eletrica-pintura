import type { AssinaturaRepo } from "./assinatura-repo";
import { AssinaturaNaoEncontradaError } from "./cancelar-assinatura";
import type { GatewayAssinatura } from "./gateway";
import { calcularDiferencaProporcional } from "./rateio-upgrade";

export interface CobrancaDiferenca {
  pagamentoId: string;
  /** Link de checkout (cartão) — quando o canal é preferência/link. */
  link?: string;
  /** Código copia-e-cola do Pix — quando o canal é Pix. */
  qrCode?: string;
}

export interface UpgradeAssinaturaDeps {
  repo: AssinaturaRepo;
  gatewayAssinatura: Pick<GatewayAssinatura, "atualizarAssinatura">;
  /** Gera a cobrança avulsa da diferença proporcional (Pix/link via MP). */
  cobrarDiferenca: (input: {
    valor: number;
    descricao: string;
    clienteId: string;
  }) => Promise<CobrancaDiferenca>;
}

export class UpgradeInvalidoError extends Error {
  readonly status = 400;
  constructor() {
    super("O plano destino precisa ser mais caro que o atual");
    this.name = "UpgradeInvalidoError";
  }
}

export interface UpgradeResultado {
  /** Diferença proporcional efetivamente cobrada (R$). 0 quando ciclo expirou. */
  diferencaCobrada: number;
  /** Cobrança avulsa gerada — ausente quando a diferença é 0. */
  pagamento?: CobrancaDiferenca;
}

/**
 * Upgrade IMEDIATO de plano (slice #58): cobra a diferença proporcional do ciclo
 * em curso por uma cobrança avulsa (Pix/link), sobe o valor recorrente no MP
 * para o preço do plano novo e troca o plano na hora — desconto/prioridade
 * passam a valer já. Troca para plano igual/mais barato não é upgrade.
 */
export async function upgradeAssinatura(
  input: {
    preapprovalIdMp: string;
    planoAtualPreco: number;
    planoDestino: { id: string; preco: number };
  },
  deps: UpgradeAssinaturaDeps,
  agora: Date = new Date(),
): Promise<UpgradeResultado> {
  if (input.planoDestino.preco <= input.planoAtualPreco) {
    throw new UpgradeInvalidoError();
  }

  const assinatura = await deps.repo.carregarPorPreapproval?.(
    input.preapprovalIdMp,
  );
  if (!assinatura) throw new AssinaturaNaoEncontradaError();

  const diferenca = calcularDiferencaProporcional({
    precoAtual: input.planoAtualPreco,
    precoNovo: input.planoDestino.preco,
    agora,
    fimCiclo: assinatura.fimCicloAtual ?? agora,
  });

  let pagamento: CobrancaDiferenca | undefined;
  if (diferenca > 0) {
    pagamento = await deps.cobrarDiferenca({
      valor: diferenca,
      descricao: "Diferença de upgrade de plano",
      clienteId: assinatura.clienteId,
    });
  }

  await deps.gatewayAssinatura.atualizarAssinatura(
    input.preapprovalIdMp,
    input.planoDestino.preco,
  );
  await deps.repo.trocarPlano?.(input.preapprovalIdMp, input.planoDestino.id);

  return { diferencaCobrada: diferenca, pagamento };
}
