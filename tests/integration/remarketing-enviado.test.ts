import { config } from "dotenv";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { criarRemarketingEnviadoRepoDrizzle } from "@/marketing/remarketing/enviado-repo";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("RemarketingEnviadoRepoDrizzle (Slice B)", () => {
  let db: typeof import("@/db/client").db;
  let schema: typeof import("@/db/schema");
  let repo: ReturnType<typeof criarRemarketingEnviadoRepoDrizzle>;
  let dummyClienteId: string;

  beforeAll(async () => {
    db = (await import("@/db/client")).db;
    schema = await import("@/db/schema");
    repo = criarRemarketingEnviadoRepoDrizzle(db);

    const r = Math.random().toString(36).slice(2, 10);
    const [cli] = await db
      .insert(schema.cliente)
      .values({
        nome: "Cliente Teste",
        whatsapp: `551199${Math.floor(1000000 + Math.random() * 9000000)}`,
        email: `teste-enviado-${r}@dbg.test`,
        endereco: { logradouro: "Rua Teste", cidade: "São Paulo", uf: "SP" },
      })
      .returning();
    dummyClienteId = cli.id;
  });

  afterEach(async () => {
    await db.delete(schema.remarketingEnviado);
  });

  afterAll(async () => {
    if (dummyClienteId) {
      await db.delete(schema.cliente).where(eq(schema.cliente.id, dummyClienteId));
    }
  });

  it("o primeiro claim retorna true e o segundo retorna false (idempotência)", async () => {
    const res1 = await repo.claim("lembrete_orcamento", dummyClienteId, "orc-123:dia3");
    expect(res1).toBe(true);

    // Segunda tentativa sob o mesmo contexto deve retornar false
    const res2 = await repo.claim("lembrete_orcamento", dummyClienteId, "orc-123:dia3");
    expect(res2).toBe(false);

    // Tentativa em contexto diferente ou com gatilho diferente deve dar true
    const res3 = await repo.claim("lembrete_orcamento", dummyClienteId, "orc-123:dia6");
    expect(res3).toBe(true);

    const res4 = await repo.claim("rejeicao_orcamento", dummyClienteId, "orc-123:dia3");
    expect(res4).toBe(true);
  });
});
