import { describe, expect, it, vi } from "vitest";
import {
  TODOS_MODULOS,
  detectRole,
  type MembroLookup,
} from "@/auth/role-detection";

const ADMIN = "diego@dbg.com.br";

function lookup(record: Awaited<ReturnType<MembroLookup>>): MembroLookup {
  return vi.fn(async () => record);
}

describe("detectRole", () => {
  it("admin_raiz quando email == ADMIN_EMAIL (case-insensitive)", async () => {
    const result = await detectRole("DIEGO@dbg.com.br", ADMIN, lookup(null));
    expect(result).toEqual({
      role: "admin_raiz",
      modulos: TODOS_MODULOS,
      isTecnico: true,
    });
  });

  it("admin_raiz precede membro mesmo se cadastrado", async () => {
    const fn = lookup({ modulos: ["FINANCEIRO"], isTecnico: false, ativo: true });
    const result = await detectRole(ADMIN, ADMIN, fn);
    expect(result.role).toBe("admin_raiz");
    expect(fn).not.toHaveBeenCalled();
  });

  it("membro_interno ativo recebe módulos do banco", async () => {
    const result = await detectRole(
      "bruna@dbg.com.br",
      ADMIN,
      lookup({ modulos: ["FINANCEIRO", "MARKETING"], isTecnico: false, ativo: true }),
    );
    expect(result).toEqual({
      role: "membro_interno",
      modulos: ["FINANCEIRO", "MARKETING"],
      isTecnico: false,
    });
  });

  it("membro_interno técnico mantém flag", async () => {
    const result = await detectRole(
      "joao@dbg.com.br",
      ADMIN,
      lookup({ modulos: ["OPERACAO"], isTecnico: true, ativo: true }),
    );
    expect(result.isTecnico).toBe(true);
    expect(result.role).toBe("membro_interno");
  });

  it("membro inativo cai pra cliente", async () => {
    const result = await detectRole(
      "ex@dbg.com.br",
      ADMIN,
      lookup({ modulos: ["MARKETING"], isTecnico: false, ativo: false }),
    );
    expect(result).toEqual({ role: "cliente", modulos: [], isTecnico: false });
  });

  it("email desconhecido vira cliente", async () => {
    const result = await detectRole("ninguem@gmail.com", ADMIN, lookup(null));
    expect(result).toEqual({ role: "cliente", modulos: [], isTecnico: false });
  });

  it("sem ADMIN_EMAIL configurado, ninguém vira admin_raiz", async () => {
    const result = await detectRole(ADMIN, undefined, lookup(null));
    expect(result.role).toBe("cliente");
  });

  it("normaliza email pra lowercase antes de consultar membro", async () => {
    const fn = vi.fn<MembroLookup>(async () => null);
    await detectRole("Bruna@DBG.com.BR", ADMIN, fn);
    expect(fn).toHaveBeenCalledWith("bruna@dbg.com.br");
  });
});
