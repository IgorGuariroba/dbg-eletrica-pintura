import { PaintRoller, BrickWall, PlugZap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Servico } from "@/catalogo/servico-repo";

export const ORDEM_CATEGORIA: Servico["categoria"][] = [
  "ELETRICA",
  "PINTURA",
  "DRYWALL",
];

export const LABEL_CATEGORIA: Record<Servico["categoria"], string> = {
  ELETRICA: "Elétrica",
  PINTURA: "Pintura",
  DRYWALL: "Drywall",
};

export const ICONE_CATEGORIA: Record<Servico["categoria"], LucideIcon> = {
  ELETRICA: PlugZap,
  PINTURA: PaintRoller,
  DRYWALL: BrickWall,
};

export const ANCORA_CATEGORIA: Record<Servico["categoria"], string> = {
  ELETRICA: "eletrica",
  PINTURA: "pintura",
  DRYWALL: "drywall",
};

export const LABEL_UNIDADE: Record<Servico["unidade"], string> = {
  PONTO: "por ponto",
  M2: "por m²",
  HORA: "por hora",
};

/** Máximo de cards exibidos por página dentro de cada categoria. */
export const SERVICOS_POR_PAGINA = 3;
