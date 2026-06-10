import { basename } from "node:path";
import { beforeAll, expect } from "vitest";

// Banco por ARQUIVO: quando CI_DB_PER_FILE está setado (CI), cada arquivo de
// integração aponta DATABASE_URL para um banco próprio, nomeado de forma
// determinística a partir do nome do arquivo (mesma regra do
// scripts/ci-migrate.mjs, que cria/migra todos antes da suíte). Isso permite
// rodar os arquivos em paralelo sem NENHUM compartilhamento de banco — nem
// mesmo o truncate ou escritas atrasadas (fire-and-forget) de um arquivo
// conseguem tocar o banco de outro.
//
// Nota: mapear banco por VITEST_POOL_ID não é seguro — o scheduler do vitest
// libera o pool id antes de o processo antigo do worker terminar de drenar,
// então dois arquivos podem se sobrepor no mesmo banco.
//
// Sem a env (dev local), é no-op: banco único e arquivos sequenciais, como
// sempre. Deve rodar ANTES de db-reset na lista de setupFiles.
function nomeBancoDoArquivo(arquivo: string): string {
  return `ci_f_${basename(arquivo).replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
}

beforeAll(() => {
  if (!process.env.CI_DB_PER_FILE || !process.env.DATABASE_URL) return;
  const arquivo = expect.getState().testPath;
  if (!arquivo) return;

  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${nomeBancoDoArquivo(arquivo)}`;
  process.env.DATABASE_URL = url.toString();
});
