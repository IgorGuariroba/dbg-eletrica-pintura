import type {
  CopiadorFotoPublica,
  PortfolioRepo,
} from "./portfolio-repo";
import { FotoJaDecididaError, FotoNaoEncontradaError } from "./portfolio-repo";

/**
 * Aprova uma foto candidata: copia o objeto do R2 privado para o R2 público
 * (cópia separada) e marca como APROVADA. Só fotos APROVADAS aparecem em
 * páginas públicas.
 */
export async function aprovarFoto(
  id: string,
  opts: { decididoPor: string; temDadoSensivel?: boolean },
  repo: PortfolioRepo,
  copiador: CopiadorFotoPublica,
): Promise<void> {
  const foto = await repo.buscar(id);
  if (!foto) throw new FotoNaoEncontradaError();
  if (foto.status !== "PENDENTE") throw new FotoJaDecididaError();

  const { chavePublica } = await copiador.copiar(foto.chavePrivada);
  const ok = await repo.aprovar(id, {
    chavePublica,
    decididoPor: opts.decididoPor,
    temDadoSensivel: opts.temDadoSensivel ?? false,
  });
  if (!ok) throw new FotoJaDecididaError();
}

/**
 * Rejeita uma foto candidata com motivo opcional. Fotos rejeitadas nunca
 * aparecem publicamente.
 */
export async function rejeitarFoto(
  id: string,
  opts: { decididoPor: string; motivo?: string | null },
  repo: PortfolioRepo,
): Promise<void> {
  const foto = await repo.buscar(id);
  if (!foto) throw new FotoNaoEncontradaError();
  if (foto.status !== "PENDENTE") throw new FotoJaDecididaError();

  const ok = await repo.rejeitar(id, {
    motivo: opts.motivo?.trim() || null,
    decididoPor: opts.decididoPor,
  });
  if (!ok) throw new FotoJaDecididaError();
}
