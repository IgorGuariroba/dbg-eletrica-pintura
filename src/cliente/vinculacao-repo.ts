export interface PendenteVinculacao {
  googleEmail: string;
  whatsapp: string;
  codigo: string;
  expiraEm: Date;
}

export interface VinculacaoRepo {
  buscarClientePorWhatsapp(whatsapp: string): Promise<{ id: string; googleEmail: string | null } | null>;
  buscarVinculoPorGoogleEmail(googleEmail: string): Promise<{ whatsapp: string } | null>;
  salvarPendente(p: PendenteVinculacao): Promise<void>;   // upsert por googleEmail
  buscarPendente(googleEmail: string): Promise<PendenteVinculacao | null>;
  removerPendente(googleEmail: string): Promise<void>;
  vincular(whatsapp: string, googleEmail: string): Promise<void>; // set google_email; 23505 -> WhatsappJaVinculadoError
  desvincular(whatsapp: string): Promise<boolean>;
  registrarLog(e: {
    clienteId: string;
    googleEmail: string;
    whatsapp: string;
    evento: "VINCULADO" | "DESVINCULADO";
    atorEmail: string;
  }): Promise<void>;
  notificarEquipe(input: { whatsapp: string; codigo: string }): Promise<void>; // notificacao_in_app, módulo EQUIPE
}

export class WhatsappJaVinculadoError extends Error {
  constructor(whatsapp: string) {
    super(`O WhatsApp ${whatsapp} já está vinculado a outra conta do Google.`);
    this.name = "WhatsappJaVinculadoError";
  }
}

export class ClienteNaoEncontradoError extends Error {
  constructor(whatsapp: string) {
    super(`Nenhum cliente encontrado com o WhatsApp ${whatsapp}.`);
    this.name = "ClienteNaoEncontradoError";
  }
}

export class CodigoInvalidoError extends Error {
  constructor() {
    super("Código de verificação inválido.");
    this.name = "CodigoInvalidoError";
  }
}

export class VinculacaoExpiradaError extends Error {
  constructor() {
    super("O código de verificação expirou.");
    this.name = "VinculacaoExpiradaError";
  }
}
