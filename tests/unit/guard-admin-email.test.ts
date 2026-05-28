import { describe, expect, it } from "vitest";
import { avaliarBloqueioAdmin } from "@/equipe/guard-admin-email";

const ADMIN = "diego@dbg.com.br";

describe("avaliarBloqueioAdmin", () => {
  it("admin_raiz pode editar a si próprio", () => {
    const r = avaliarBloqueioAdmin({
      emailTentado: ADMIN,
      emailAlvoAtual: ADMIN,
      editorRole: "admin_raiz",
      adminEmail: ADMIN,
    });
    expect(r.tipo).toBe("ok");
  });

  it("admin_raiz pode editar qualquer outro membro", () => {
    const r = avaliarBloqueioAdmin({
      emailTentado: "outro@dbg.com.br",
      emailAlvoAtual: "outro@dbg.com.br",
      editorRole: "admin_raiz",
      adminEmail: ADMIN,
    });
    expect(r.tipo).toBe("ok");
  });

  it("membro_interno NÃO pode editar cadastro do admin raiz", () => {
    const r = avaliarBloqueioAdmin({
      emailTentado: ADMIN,
      emailAlvoAtual: ADMIN,
      editorRole: "membro_interno",
      adminEmail: ADMIN,
    });
    expect(r.tipo).toBe("alvo_eh_admin");
  });

  it("membro_interno NÃO pode trocar email de outro membro para ADMIN_EMAIL (escalação)", () => {
    const r = avaliarBloqueioAdmin({
      emailTentado: ADMIN,
      emailAlvoAtual: "bruna@dbg.com.br",
      editorRole: "membro_interno",
      adminEmail: ADMIN,
    });
    expect(r.tipo).toBe("tentando_virar_admin");
  });

  it("membro_interno NÃO pode criar membro com email = ADMIN_EMAIL", () => {
    const r = avaliarBloqueioAdmin({
      emailTentado: ADMIN,
      editorRole: "membro_interno",
      adminEmail: ADMIN,
    });
    expect(r.tipo).toBe("tentando_virar_admin");
  });

  it("normaliza case ao comparar", () => {
    const r = avaliarBloqueioAdmin({
      emailTentado: "  DIEGO@DBG.COM.BR  ",
      editorRole: "membro_interno",
      adminEmail: ADMIN,
    });
    expect(r.tipo).toBe("tentando_virar_admin");
  });

  it("membro_interno edita cadastro próprio (sem mexer com admin)", () => {
    const r = avaliarBloqueioAdmin({
      emailTentado: "bruna@dbg.com.br",
      emailAlvoAtual: "bruna@dbg.com.br",
      editorRole: "membro_interno",
      adminEmail: ADMIN,
    });
    expect(r.tipo).toBe("ok");
  });

  it("admin raiz pode mover email de outro membro para ADMIN_EMAIL (caso bootstrap)", () => {
    const r = avaliarBloqueioAdmin({
      emailTentado: ADMIN,
      emailAlvoAtual: "antigo@dbg.com.br",
      editorRole: "admin_raiz",
      adminEmail: ADMIN,
    });
    expect(r.tipo).toBe("ok");
  });
});
