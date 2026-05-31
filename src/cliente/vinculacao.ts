import {
  type VinculacaoRepo,
  ClienteNaoEncontradoError,
  WhatsappJaVinculadoError,
  CodigoInvalidoError,
  VinculacaoExpiradaError,
} from "./vinculacao-repo";

export function gerarCodigo(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function iniciarVinculacao(
  input: { googleEmail: string; whatsapp: string },
  repo: VinculacaoRepo
): Promise<void> {
  const normalizedWhatsapp = input.whatsapp.replace(/\D/g, "");
  const cliente = await repo.buscarClientePorWhatsapp(normalizedWhatsapp);
  if (!cliente) {
    throw new ClienteNaoEncontradoError(normalizedWhatsapp);
  }

  if (cliente.googleEmail && cliente.googleEmail !== input.googleEmail) {
    throw new WhatsappJaVinculadoError(normalizedWhatsapp);
  }

  const vinculoExistente = await repo.buscarVinculoPorGoogleEmail(input.googleEmail);
  if (vinculoExistente && vinculoExistente.whatsapp !== normalizedWhatsapp) {
    throw new WhatsappJaVinculadoError(normalizedWhatsapp);
  }

  const codigo = gerarCodigo();
  const expiraEm = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

  await repo.salvarPendente({
    googleEmail: input.googleEmail,
    whatsapp: normalizedWhatsapp,
    codigo,
    expiraEm,
  });

  await repo.notificarEquipe({
    whatsapp: normalizedWhatsapp,
    codigo,
  });
}

export async function confirmarVinculacao(
  input: { googleEmail: string; codigo: string },
  repo: VinculacaoRepo
): Promise<void> {
  const pendente = await repo.buscarPendente(input.googleEmail);
  if (!pendente || pendente.codigo !== input.codigo) {
    throw new CodigoInvalidoError();
  }

  if (Date.now() > pendente.expiraEm.getTime()) {
    throw new VinculacaoExpiradaError();
  }

  const cliente = await repo.buscarClientePorWhatsapp(pendente.whatsapp);
  if (!cliente) {
    throw new ClienteNaoEncontradoError(pendente.whatsapp);
  }

  await repo.vincular(pendente.whatsapp, pendente.googleEmail);

  await repo.registrarLog({
    clienteId: cliente.id,
    googleEmail: pendente.googleEmail,
    whatsapp: pendente.whatsapp,
    evento: "VINCULADO",
    atorEmail: pendente.googleEmail,
  });

  await repo.removerPendente(pendente.googleEmail);
}

export async function desvincular(
  input: { whatsapp: string; atorEmail: string },
  repo: VinculacaoRepo
): Promise<boolean> {
  const normalizedWhatsapp = input.whatsapp.replace(/\D/g, "");
  const cliente = await repo.buscarClientePorWhatsapp(normalizedWhatsapp);
  if (!cliente || !cliente.googleEmail) {
    return false;
  }

  const anteriorGoogleEmail = cliente.googleEmail;
  await repo.desvincular(normalizedWhatsapp);

  await repo.registrarLog({
    clienteId: cliente.id,
    googleEmail: anteriorGoogleEmail,
    whatsapp: normalizedWhatsapp,
    evento: "DESVINCULADO",
    atorEmail: input.atorEmail,
  });

  return true;
}

export function enriquecerSessaoCliente(
  token: any,
  lookupResult: { whatsapp: string | null } | null
): any {
  if (token.role === "cliente" && !token.whatsapp) {
    token.whatsapp = lookupResult?.whatsapp ?? null;
  }
  return token;
}
