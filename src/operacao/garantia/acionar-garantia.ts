import type { GarantiaRepo } from "./garantia-repo";
import { avaliarAcionamentoGarantia } from "./avaliar-acionamento";

export class ForaDoPrazoError extends Error {
  constructor() {
    super("Fora do prazo de garantia");
    this.name = "ForaDoPrazoError";
  }
}

export async function acionarGarantia(
  input: {
    osId: string;
    descricao: string;
    fotoDataUrl: string;
    criadoPor: string;
    canal: "PORTAL" | "WHATSAPP";
  },
  deps: {
    repo: GarantiaRepo;
    uploadFoto: (base64: string, osId: string) => Promise<string>;
    agora?: Date;
  },
): Promise<{ chamadoId: string }> {
  if (input.descricao.trim().length < 20) {
    throw new Error("Descrição precisa de no mínimo 20 caracteres");
  }

  if (!input.fotoDataUrl) {
    throw new Error("A foto é obrigatória");
  }

  const ancora = await deps.repo.carregarAncora(input.osId);
  if (!ancora) {
    throw new Error("OS não encontrada ou não é elegível para garantia");
  }

  const temCompRejeitado = await deps.repo.temComplementarRejeitado(ancora.ancoraId);

  const agora = deps.agora ?? new Date();

  const avaliacao = avaliarAcionamentoGarantia({
    agora,
    ancora,
    temComplementarRejeitado: temCompRejeitado,
  });

  let acionamentoInvalido = false;

  if (!avaliacao.dentroDoPrazo) {
    if (input.canal === "PORTAL") {
      throw new ForaDoPrazoError();
    } else {
      acionamentoInvalido = true;
    }
  }

  const fotoUrl = await deps.uploadFoto(input.fotoDataUrl, input.osId);

  const chamado = await deps.repo.criarChamado({
    osOrigemId: input.osId,
    descricao: input.descricao,
    fotoUrl,
    criadoPor: input.criadoPor,
    canal: input.canal,
    temComplementarRejeitado: avaliacao.temComplementarRejeitado,
    acionamentoInvalido,
  });

  return { chamadoId: chamado.id };
}
