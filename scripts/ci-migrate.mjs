// Aplica as migrations (./drizzle) via driver neon-http.
//
// O `drizzle-kit migrate` é uma CLI bundleada com a própria cópia do
// @neondatabase/serverless, então não dá pra redirecioná-la ao proxy local
// mutando o neonConfig do nosso node_modules. Este script usa o migrator
// neon-http do drizzle-orm direto, que respeita o nosso neonConfig e,
// portanto, o proxy local (NEON_LOCAL_PROXY) no CI/docker.
import { config } from "dotenv";

config({ path: ".env.local" });

import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const proxy = process.env.NEON_LOCAL_PROXY;
if (proxy) {
  neonConfig.fetchEndpoint = `http://${proxy}/sql`;
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não configurada");
  process.exit(1);
}

const db = drizzle(neon(url));
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("✓ migrations aplicadas");
