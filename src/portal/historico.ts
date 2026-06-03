import type { EstadoOs, FotosOsPort, HistoricoRepo } from "./historico-repo";
import { listarFotosOs, obterUrlLeituraAssinada } from "@/operacao/r2-privado";
import { chaveCertificado, chaveFatura } from "@/documentos/chaves";
import { planejarDocumentos } from "@/documentos/planejar-documentos";
import type { TipoOs } from "@/operacao/maquina-estado";

export interface FotosOsView {
  antes: string[];
  depois: string[];
}

export async function listarHistoricoCliente(
  whatsapp: string,
  paginacao: { limit: number; offset: number },
  repo: HistoricoRepo,
) {
  return repo.listar(whatsapp, paginacao);
}

export async function carregarSolicitacaoDoCliente(
  solicitacaoId: string,
  whatsapp: string,
  repo: HistoricoRepo,
) {
  return repo.carregarSolicitacao(solicitacaoId, whatsapp);
}

export async function montarFotosOs(
  osId: string,
  port: FotosOsPort,
): Promise<FotosOsView> {
  const [antesChaves, depoisChaves] = await Promise.all([
    port.listarChaves(osId, "ANTES"),
    port.listarChaves(osId, "DEPOIS"),
  ]);

  const [antes, depois] = await Promise.all([
    Promise.all(antesChaves.map((chave) => port.urlLeitura(chave))),
    Promise.all(depoisChaves.map((chave) => port.urlLeitura(chave))),
  ]);

  return { antes, depois };
}

export function fotosOsR2Port(): FotosOsPort {
  return {
    listarChaves: listarFotosOs,
    urlLeitura: obterUrlLeituraAssinada,
  };
}

export type DocumentoPortalTipo =
  | "FATURA"
  | "CERTIFICADO_GARANTIA"
  | "ACIONAR_GARANTIA"
  | "INDICACAO";

export interface DocumentoPortalView {
  tipo: DocumentoPortalTipo;
  rotulo: string;
  estado: "DISPONIVEL" | "EM_BREVE";
  tooltip: string | null;
  url: string | null;
}

export function montarDocumentosPortal(input: {
  faturaKey?: string | null;
  certificadoKey?: string | null;
}): DocumentoPortalView[] {
  return [
    {
      tipo: "FATURA",
      rotulo: "Fatura",
      estado: input.faturaKey ? "DISPONIVEL" : "EM_BREVE",
      tooltip: input.faturaKey ? null : "em breve",
      url: input.faturaKey ?? null,
    },
    {
      tipo: "CERTIFICADO_GARANTIA",
      rotulo: "Certificado de garantia",
      estado: input.certificadoKey ? "DISPONIVEL" : "EM_BREVE",
      tooltip: input.certificadoKey ? null : "em breve",
      url: input.certificadoKey ?? null,
    },
    {
      tipo: "ACIONAR_GARANTIA",
      rotulo: "Acionar garantia",
      estado: "EM_BREVE",
      tooltip: "em breve",
      url: null,
    },
    {
      tipo: "INDICACAO",
      rotulo: "Link de indicação",
      estado: "EM_BREVE",
      tooltip: "em breve",
      url: null,
    },
  ];
}

/**
 * Resolve os documentos do portal de uma OS específica. A disponibilidade vem
 * de `planejarDocumentos` (PAGA → fatura + certificado; GARANTIA concluída →
 * só certificado); quando disponível, assina a URL da chave determinística no
 * R2. Documentos não gerados ficam "em breve", sem assinar URL.
 *
 * A assinatura é local: `getSignedUrl` computa a presigned URL via HMAC, sem
 * round-trip ao R2. Chamar isto por OS (no portal) não gera I/O por item.
 */
export async function montarDocumentosPortalOs(input: {
  osId: string;
  tipo: TipoOs;
  estado: EstadoOs;
  /** Assinador de leitura (default: R2 privado). */
  urlAssinada?: (chave: string) => Promise<string>;
}): Promise<DocumentoPortalView[]> {
  const assinar = input.urlAssinada ?? ((c) => obterUrlLeituraAssinada(c));
  const plano = planejarDocumentos(input.tipo, input.estado);

  const faturaKey = plano.fatura ? await assinar(chaveFatura(input.osId)) : null;
  const certificadoKey = plano.certificado
    ? await assinar(chaveCertificado(input.osId))
    : null;

  return montarDocumentosPortal({ faturaKey, certificadoKey });
}
