import { criarCacheTtl } from "./cache";
import {
  montarDashboard,
  type Dashboard,
  type DashboardRepo,
  type UsuarioDashboard,
} from "./dashboard";

// TTL aceito pelo #66: 60s. Singleton de processo — compartilhado entre
// requisições da mesma instância do servidor.
const TTL_MS = 60_000;
const cache = criarCacheTtl<Dashboard>({ ttlMs: TTL_MS });

// A chave captura tudo que altera a saída do dashboard: papel, módulos e a
// identidade do técnico (card Técnico depende de membroId/especialidades).
// Dois usuários com a mesma assinatura veem o mesmo painel — compartilhar é seguro.
function chaveCache(u: UsuarioDashboard): string {
  return JSON.stringify({
    role: u.role,
    modulos: [...u.modulos].sort(),
    isTecnico: u.isTecnico,
    membroId: u.membroId,
    especialidades: [...u.especialidades].sort(),
  });
}

export function montarDashboardCacheado(
  usuario: UsuarioDashboard,
  repo: DashboardRepo,
): Promise<Dashboard> {
  return cache.resolver(chaveCache(usuario), () => montarDashboard(usuario, repo));
}
