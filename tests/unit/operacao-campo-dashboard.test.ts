import { describe, expect, it, vi } from "vitest";
import type {
  CampoRepo,
  FiltroTecnicosEmCampo,
  TecnicoEmCampo,
} from "@/operacao/campo-repo";
import { listarTecnicosEmCampo } from "@/operacao/campo";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function tecnicoEmCampo(over: Partial<TecnicoEmCampo> = {}): TecnicoEmCampo {
  return {
    osId: "os-1",
    osNumero: "OS-001",
    estado: "A_CAMINHO",
    ultimaTransicaoEm: new Date("2026-01-01T10:00:00Z"),
    tecnicoId: "tec-1",
    tecnicoNome: "João Silva",
    tecnicoWhatsapp: "5511999999999",
    clienteNome: "Maria Souza",
    endereco: "Rua das Flores, 10 — SP/SP",
    categoria: "ELETRICA",
    inconsistente: false,
    ...over,
  };
}

function repoFake(itens: TecnicoEmCampo[] = []): CampoRepo {
  return {
    listarTecnicosEmCampo: vi.fn(async () => itens),
  };
}

// ---------------------------------------------------------------------------
// SLICE 1 — listarTecnicosEmCampo retorna lista do repo
// ---------------------------------------------------------------------------
describe("listarTecnicosEmCampo", () => {
  it("retorna lista vazia quando não há técnicos em campo", async () => {
    const repo = repoFake([]);
    const resultado = await listarTecnicosEmCampo(repo);
    expect(resultado).toEqual([]);
  });

  it("retorna técnicos em campo conforme repo", async () => {
    const tecnico = tecnicoEmCampo();
    const repo = repoFake([tecnico]);
    const resultado = await listarTecnicosEmCampo(repo);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].tecnicoNome).toBe("João Silva");
    expect(resultado[0].osId).toBe("os-1");
  });

  // ---------------------------------------------------------------------------
  // SLICE 2 — repassa filtros ao repo
  // ---------------------------------------------------------------------------
  it("repassa filtro de estado ao repo", async () => {
    let filtroUsado: FiltroTecnicosEmCampo | undefined;
    const repo: CampoRepo = {
      listarTecnicosEmCampo: vi.fn(async (f) => {
        filtroUsado = f;
        return [];
      }),
    };
    await listarTecnicosEmCampo(repo, { estado: "EM_EXECUCAO" });
    expect(filtroUsado?.estado).toBe("EM_EXECUCAO");
  });

  it("repassa filtro de técnico ao repo", async () => {
    let filtroUsado: FiltroTecnicosEmCampo | undefined;
    const repo: CampoRepo = {
      listarTecnicosEmCampo: vi.fn(async (f) => {
        filtroUsado = f;
        return [];
      }),
    };
    await listarTecnicosEmCampo(repo, { tecnicoId: "tec-42" });
    expect(filtroUsado?.tecnicoId).toBe("tec-42");
  });

  it("repassa filtro de categoria ao repo", async () => {
    let filtroUsado: FiltroTecnicosEmCampo | undefined;
    const repo: CampoRepo = {
      listarTecnicosEmCampo: vi.fn(async (f) => {
        filtroUsado = f;
        return [];
      }),
    };
    await listarTecnicosEmCampo(repo, { categoria: "PINTURA" });
    expect(filtroUsado?.categoria).toBe("PINTURA");
  });

  // ---------------------------------------------------------------------------
  // SLICE 3 — badge de inconsistência visível no resultado
  // ---------------------------------------------------------------------------
  it("técnico em EM_EXECUCAO sem foto antes aparece como inconsistente", async () => {
    const inconsistente = tecnicoEmCampo({
      estado: "EM_EXECUCAO",
      inconsistente: true,
    });
    const repo = repoFake([inconsistente]);
    const resultado = await listarTecnicosEmCampo(repo);
    expect(resultado[0].inconsistente).toBe(true);
  });

  it("técnico em EM_EXECUCAO com foto antes NÃO é inconsistente", async () => {
    const consistente = tecnicoEmCampo({
      estado: "EM_EXECUCAO",
      inconsistente: false,
    });
    const repo = repoFake([consistente]);
    const resultado = await listarTecnicosEmCampo(repo);
    expect(resultado[0].inconsistente).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // SLICE 4 — link wa.me disponível no resultado
  // ---------------------------------------------------------------------------
  it("retorna whatsapp do técnico para montar link wa.me", async () => {
    const tecnico = tecnicoEmCampo({ tecnicoWhatsapp: "5511988887777" });
    const repo = repoFake([tecnico]);
    const resultado = await listarTecnicosEmCampo(repo);
    expect(resultado[0].tecnicoWhatsapp).toBe("5511988887777");
  });
});
