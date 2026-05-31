import { config } from "dotenv";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { OperacaoConfig, OperacaoConfigRepo } from "@/operacao/config-repo";

config({ path: ".env.local" });

const hasDb = Boolean(process.env.DATABASE_URL);

// Config fixa (seg 8h-18h, dom fechado) sem tocar no singleton compartilhado —
// mantém o teste focado na regra do caso de uso e livre de corrida entre arquivos.
function configRepoFixo(): OperacaoConfigRepo {
  const cfg: OperacaoConfig = {
    precoLitro: "6.00",
    kmPorLitro: "10.00",
    horarioComercial: { seg: { inicio: "08:00", fim: "18:00" }, dom: null },
  };
  return {
    async obter() {
      return cfg;
    },
    async atualizar(c) {
      return c;
    },
  };
}

describe.skipIf(!hasDb)("atualizarDisponibilidadeTecnico", () => {
  let membroRepo: import("@/equipe/membro-repo").MembroRepo;
  let configRepo: OperacaoConfigRepo;
  let atualizar: typeof import("@/operacao/disponibilidade-tecnico").atualizarDisponibilidadeTecnico;
  let DisponibilidadeForaDoComercialError: typeof import("@/operacao/disponibilidade-tecnico").DisponibilidadeForaDoComercialError;
  let tecnicoId: string;

  beforeAll(async () => {
    const dbMod = await import("@/db/client");
    const { criarMembroRepoDrizzle } = await import(
      "@/equipe/membro-repo-drizzle"
    );
    const mod = await import("@/operacao/disponibilidade-tecnico");
    membroRepo = criarMembroRepoDrizzle(dbMod.db);
    configRepo = configRepoFixo();
    atualizar = mod.atualizarDisponibilidadeTecnico;
    DisponibilidadeForaDoComercialError = mod.DisponibilidadeForaDoComercialError;
  });

  afterEach(async () => {
    if (tecnicoId) {
      const dbMod = await import("@/db/client");
      const { membro } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      await dbMod.db.delete(membro).where(eq(membro.id, tecnicoId));
      tecnicoId = "";
    }
  });

  async function novoTecnico() {
    const m = await membroRepo.inserir({
      nome: "Téc Teste",
      email: `tec-${Date.now()}-${Math.random().toString(36).slice(2)}@ex.com`,
      modulos: [],
      isTecnico: true,
      fotoUrl: null,
      bio: null,
      especialidades: [],
      disponibilidade: null,
      ativo: true,
    });
    tecnicoId = m.id;
    return m;
  }

  it("rejeita janela fora do horário comercial e não grava", async () => {
    const tec = await novoTecnico();

    await expect(
      atualizar(
        {
          tecnicoId: tec.id,
          disponibilidade: { seg: { inicio: "07:00", fim: "12:00" } },
        },
        { membroRepo, configRepo },
      ),
    ).rejects.toBeInstanceOf(DisponibilidadeForaDoComercialError);

    const lido = await membroRepo.buscarPorId(tec.id);
    expect(lido?.disponibilidade ?? null).toBeNull();
  });

  it("grava quando a janela cabe no horário comercial", async () => {
    const tec = await novoTecnico();

    await atualizar(
      {
        tecnicoId: tec.id,
        disponibilidade: { seg: { inicio: "09:00", fim: "12:00" } },
      },
      { membroRepo, configRepo },
    );

    const lido = await membroRepo.buscarPorId(tec.id);
    expect(lido?.disponibilidade?.seg).toEqual({ inicio: "09:00", fim: "12:00" });
  });
});
