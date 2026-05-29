import {
  ForbiddenError,
  podeAcessarModulo,
  type SessionAuthz,
} from "@/auth/require-modulo";
import type { CriarSolicitacaoInputBruto } from "./criar-solicitacao";
import type { Categoria, EnderecoSolicitacao } from "./solicitacao-repo";

export interface DadosSolicitacaoManual {
  cliente: { nome: string; whatsapp: string };
  categorias: Categoria[];
  descricao?: string | null;
  fotosUrls?: string[];
  endereco: EnderecoSolicitacao;
  dataDesejada?: Date | null;
  duracaoEstimada?: string | null;
  /** Admin confirma ter coletado o consentimento LGPD verbalmente. */
  consentimentoConfirmado: boolean;
}

/**
 * Autoriza a criação manual (módulo OPERACAO) e devolve o email do operador,
 * usado para registrar quem coletou o consentimento verbal. Lança 403
 * (ForbiddenError) quando o usuário não pode acessar o módulo.
 */
export function autorizarSolicitacaoManual(
  sess: (SessionAuthz & { email?: string | null }) | null | undefined,
): string {
  if (!podeAcessarModulo("OPERACAO", sess)) {
    throw new ForbiddenError("OPERACAO");
  }
  return sess?.email ?? "";
}

/**
 * Monta o input de criação a partir de uma ligação atendida pelo admin Operação.
 * Marca origem MANUAL e registra o consentimento verbal (quem coletou + quando)
 * no próprio descrição da solicitação.
 */
export function montarSolicitacaoManual(
  dados: DadosSolicitacaoManual,
  membroEmail: string,
  agora: Date = new Date(),
): CriarSolicitacaoInputBruto {
  const registroConsentimento = `Consentimento LGPD verbal coletado por ${membroEmail} em ${agora.toISOString()}`;
  const descricaoAdmin = dados.descricao?.trim();
  const descricao = descricaoAdmin
    ? `${descricaoAdmin}\n\n[${registroConsentimento}]`
    : `[${registroConsentimento}]`;

  return {
    cliente: {
      nome: dados.cliente.nome,
      whatsapp: dados.cliente.whatsapp,
    },
    solicitacao: {
      categorias: dados.categorias,
      descricao,
      fotosUrls: dados.fotosUrls ?? [],
      endereco: dados.endereco,
      dataDesejada: dados.dataDesejada ?? null,
      duracaoEstimada: dados.duracaoEstimada ?? null,
      lgpdAceito: dados.consentimentoConfirmado,
      origem: "MANUAL",
    },
  };
}
