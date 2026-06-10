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

// A chave captura tudo que altera a saída do dashboard. `membroId` e
// `especialidades` são OBRIGATÓRIOS: o card Técnico mostra as OS atribuídas
// àquele membro e a fila das suas especialidades — omiti-los faria um técnico
// ver os dados de outro. Na prática isso torna o cache ~1 entrada por pessoa
// logada; o ganho real é absorver refreshes do MESMO usuário dentro de 60s
// (o `criarCacheTtl` varre entradas expiradas para limitar a memória).
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
