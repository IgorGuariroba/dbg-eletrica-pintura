import { describe, expect, it, vi } from "vitest";
import { devolverOs, listarFila, pegarOs } from "@/operacao/fila";
import type {
  Categoria,
  FilaRepo,
  ListarFilaFiltro,
  OsFila,
} from "@/operacao/fila-repo";
import {
  DevolucaoInvalidaError,
  MotivoObrigatorioError,
  NaoTecnicoError,
  OsIndisponivelError,
} from "@/operacao/fila-repo";
import type { UsuarioFila } from "@/operacao/fila";

function os(over: Partial<OsFila> = {}): OsFila {
  return {
    id: "os-1",
    categoria: "ELETRICA",
    tipo: "NORMAL",
    estado: "NOVA",
    tecnicoId: null,
    clienteNome: "Maria",
    cidade: "São Paulo",
    uf: "SP",
    criadoEm: new Date("2026-01-01"),
    ...over,
  };
}

function repoFake(over: Partial<FilaRepo> = {}): FilaRepo {
  return {
    listar: vi.fn(async () => ({ itens: [], total: 0 })),
    buscarPorId: vi.fn(async () => null),
    listarPorTecnico: vi.fn(async () => []),
    autoatribuir: vi.fn(async () => os({ tecnicoId: "tec-1" })),
    devolver: vi.fn(async () => os({ tecnicoId: null })),
    ...over,
  };
}

const tecnico: UsuarioFila = {
  membroId: "tec-1",
  role: "membro_interno",
  modulos: [],
  isTecnico: true,
  especialidades: ["ELETRICA"],
};

const operacao: UsuarioFila = {
  membroId: "op-1",
  role: "membro_interno",
  modulos: ["OPERACAO"],
  isTecnico: false,
  especialidades: [],
};

describe("pegarOs", () => {
  it("rejeita usuário que não é técnico", async () => {
    const repo = repoFake();
    await expect(pegarOs("os-1", operacao, repo)).rejects.toBeInstanceOf(
      NaoTecnicoError,
    );
    expect(repo.autoatribuir).not.toHaveBeenCalled();
  });

  it("atribui a OS ao próprio técnico e retorna a OS atualizada", async () => {
    const repo = repoFake({
      autoatribuir: vi.fn(async (id, tec) => os({ id, tecnicoId: tec })),
    });
    const r = await pegarOs("os-9", tecnico, repo);
    expect(repo.autoatribuir).toHaveBeenCalledWith("os-9", "tec-1");
    expect(r.tecnicoId).toBe("tec-1");
  });

  it("erro amigável quando outro técnico já pegou (race)", async () => {
    const repo = repoFake({ autoatribuir: vi.fn(async () => null) });
    await expect(pegarOs("os-1", tecnico, repo)).rejects.toBeInstanceOf(
      OsIndisponivelError,
    );
  });
});

describe("devolverOs", () => {
  it("rejeita usuário que não é técnico", async () => {
    const repo = repoFake();
    await expect(
      devolverOs("os-1", operacao, "qualquer", repo),
    ).rejects.toBeInstanceOf(NaoTecnicoError);
    expect(repo.devolver).not.toHaveBeenCalled();
  });

  it("exige motivo (rejeita motivo em branco)", async () => {
    const repo = repoFake();
    await expect(
      devolverOs("os-1", tecnico, "   ", repo),
    ).rejects.toBeInstanceOf(MotivoObrigatorioError);
    expect(repo.devolver).not.toHaveBeenCalled();
  });

  it("devolve à fila com motivo aparado e retorna a OS sem técnico", async () => {
    const repo = repoFake({
      devolver: vi.fn(async (id) => os({ id, tecnicoId: null })),
    });
    const r = await devolverOs("os-7", tecnico, "  fora da minha área  ", repo);
    expect(repo.devolver).toHaveBeenCalledWith(
      "os-7",
      "tec-1",
      "fora da minha área",
    );
    expect(r.tecnicoId).toBeNull();
  });

  it("erro quando a OS não é NOVA ou não é do técnico (repo null)", async () => {
    const repo = repoFake({ devolver: vi.fn(async () => null) });
    await expect(
      devolverOs("os-1", tecnico, "motivo", repo),
    ).rejects.toBeInstanceOf(DevolucaoInvalidaError);
  });
});

describe("listarFila", () => {
  it("técnico vê só OS disponíveis filtradas pelas suas especialidades", async () => {
    let filtroUsado: ListarFilaFiltro | undefined;
    const repo = repoFake({
      listar: vi.fn(async (f) => {
        filtroUsado = f;
        return { itens: [], total: 0 };
      }),
    });
    await listarFila(tecnico, repo);
    expect(filtroUsado?.apenasDisponiveis).toBe(true);
    expect(filtroUsado?.categorias).toEqual(["ELETRICA"]);
    // inclui as próprias OS pra que o técnico consiga devolvê-las
    expect(filtroUsado?.incluirTecnicoId).toBe("tec-1");
  });

  it("membro Operação vê todas as OS, sem filtro de especialidade", async () => {
    let filtroUsado: ListarFilaFiltro | undefined;
    const repo = repoFake({
      listar: vi.fn(async (f) => {
        filtroUsado = f;
        return { itens: [], total: 0 };
      }),
    });
    await listarFila(operacao, repo);
    expect(filtroUsado?.apenasDisponiveis).toBeFalsy();
    expect(filtroUsado?.categorias).toBeUndefined();
  });

  it("admin raiz vê todas mesmo sendo técnico", async () => {
    let filtroUsado: ListarFilaFiltro | undefined;
    const repo = repoFake({
      listar: vi.fn(async (f) => {
        filtroUsado = f;
        return { itens: [], total: 0 };
      }),
    });
    const admin: UsuarioFila = {
      membroId: "raiz",
      role: "admin_raiz",
      modulos: [],
      isTecnico: true,
      especialidades: ["PINTURA"],
    };
    await listarFila(admin, repo);
    expect(filtroUsado?.apenasDisponiveis).toBeFalsy();
    expect(filtroUsado?.categorias).toBeUndefined();
  });
});
