import { describe, expect, it } from "vitest";
import {
  avaliarConclusao,
  type ItemChecklist,
  type RespostaChecklist,
} from "@/operacao/checklist-conclusao";

const itens: ItemChecklist[] = [
  { id: "i1", exigeFoto: false },
  { id: "i2", exigeFoto: true },
];

function respostas(
  m: Record<string, RespostaChecklist>,
): Record<string, RespostaChecklist> {
  return m;
}

describe("avaliarConclusao", () => {
  it("pode concluir quando todos respondidos e nenhuma foto pendente", () => {
    const r = avaliarConclusao(itens, {
      i1: { status: "OK", temFoto: false },
      i2: { status: "OK", temFoto: true },
    });
    expect(r.pode).toBe(true);
    expect(r.faltam).toEqual([]);
  });

  it("bloqueia item exigeFoto marcado OK sem foto", () => {
    const r = avaliarConclusao(itens, {
      i1: { status: "OK", temFoto: false },
      i2: { status: "OK", temFoto: false },
    });
    expect(r.pode).toBe(false);
    expect(r.faltam).toEqual(["i2"]);
  });

  it("bloqueia status PROBLEMA sem foto, mesmo sem exigeFoto", () => {
    const r = avaliarConclusao(itens, {
      i1: { status: "PROBLEMA", temFoto: false },
      i2: { status: "OK", temFoto: true },
    });
    expect(r.pode).toBe(false);
    expect(r.faltam).toEqual(["i1"]);
  });

  it("N/A dispensa foto mesmo quando o item exige foto", () => {
    const r = avaliarConclusao(itens, {
      i1: { status: "OK", temFoto: false },
      i2: { status: "NA", temFoto: false },
    });
    expect(r.pode).toBe(true);
    expect(r.faltam).toEqual([]);
  });

  it("bloqueia item não respondido", () => {
    const r = avaliarConclusao(itens, {
      i1: { status: "OK", temFoto: false },
    });
    expect(r.pode).toBe(false);
    expect(r.faltam).toEqual(["i2"]);
  });
});
