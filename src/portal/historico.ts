import type { FotosOsPort, HistoricoRepo } from "./historico-repo";
import { listarFotosOs, obterUrlLeituraAssinada } from "@/operacao/r2-privado";

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
