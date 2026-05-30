import type { ReativacaoRepo } from "./reativacao-repo";
import {
  EstadoInvalidoError,
  OsInexistenteError,
  SemPermissaoError,
} from "./reativacao-repo";

export interface UsuarioReativacao {
  membroId: string;
  role: string;
  modulos: string[];
}

export async function reativarOs(
  osId: string,
  usuario: UsuarioReativacao,
  motivo: string | null,
  repo: ReativacaoRepo,
  agora: Date = new Date(),
): Promise<void> {
  const temPermissao =
    usuario.role === "admin_raiz" || usuario.modulos.includes("OPERACAO");
  if (!temPermissao) {
    throw new SemPermissaoError();
  }

  const os = await repo.buscarOs(osId);
  if (!os) {
    throw new OsInexistenteError();
  }

  if (os.estado !== "REJEITADA" && os.estado !== "EXPIRADA") {
    throw new EstadoInvalidoError();
  }

  const motivoLimpo = motivo?.trim() || null;
  const reativacaoRegistro = {
    membroId: usuario.membroId,
    motivo: motivoLimpo,
    deEstado: os.estado as "REJEITADA" | "EXPIRADA",
    em: agora.toISOString(),
  };

  const metadadosAtuais = os.metadados || {};
  const reativacoes = [...(metadadosAtuais.reativacoes || []), reativacaoRegistro];
  const novosMetadados = {
    ...metadadosAtuais,
    reativacoes,
  };

  const novaValidade = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

  const ok = await repo.reativar(
    osId,
    "ORCADA",
    novosMetadados,
    novaValidade,
  );

  if (!ok) {
    throw new OsInexistenteError();
  }
}
