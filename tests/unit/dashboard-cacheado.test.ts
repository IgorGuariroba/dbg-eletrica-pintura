import { describe, expect, it, vi } from "vitest";
import { montarDashboardCacheado } from "@/features/dashboard/dashboard-cacheado";
import type {
  DashboardRepo,
  UsuarioDashboard,
} from "@/features/dashboard/dashboard";

function repoVazio(over: Partial<DashboardRepo> = {}): DashboardRepo {
  // Proxy: qualquer método não sobrescrito devolve um stub assíncrono neutro.
  return new Proxy(over, {
    get(alvo, prop: string) {
      if (prop in alvo) return alvo[prop as keyof DashboardRepo];
      return vi.fn(async () => 0);
    },
  }) as DashboardRepo;
}

describe("montarDashboardCacheado", () => {
  it("reaproveita o resultado para a mesma assinatura de usuário (não reconsulta em 60s)", async () => {
    const contarServicosAtivos = vi.fn(async () => 5);
    const repo = repoVazio({
      contarServicosAtivos,
      listarServicosSemDemanda: vi.fn(async () => []),
      precoMedioPorCategoria: vi.fn(async () => []),
      listarServicosMaisPedidos: vi.fn(async () => []),
    });
    // membroId único isola a chave de cache deste teste do singleton de processo.
    const usuario: UsuarioDashboard = {
      membroId: `cache-test-${Math.random()}`,
      role: "membro_interno",
      modulos: ["CATALOGO"],
      isTecnico: false,
      especialidades: [],
    };

    const a = await montarDashboardCacheado(usuario, repo);
    const b = await montarDashboardCacheado(usuario, repo);

    expect(a).toBe(b); // mesma referência: veio do cache
    expect(contarServicosAtivos).toHaveBeenCalledTimes(1);
  });
});
