import { describe, expect, it } from "vitest";
import {
  temItensProblema,
  type RespostaChecklist,
} from "@/operacao/checklist-conclusao";

const ok: RespostaChecklist = { status: "OK", temFoto: true };
const na: RespostaChecklist = { status: "NA", temFoto: false };
const problema: RespostaChecklist = { status: "PROBLEMA", temFoto: true };

describe("temItensProblema", () => {
  it("verdadeiro quando algum item está PROBLEMA", () => {
    expect(temItensProblema({ a: ok, b: problema, c: na })).toBe(true);
  });

  it("falso quando nenhum item está PROBLEMA", () => {
    expect(temItensProblema({ a: ok, b: na })).toBe(false);
  });

  it("falso para checklist vazio", () => {
    expect(temItensProblema({})).toBe(false);
  });
});
