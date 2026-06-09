import type { AvaliacaoGoogle } from "./gbp-gateway";

/**
 * Avaliações Google falsas para rodar o painel de Reputação sem OAuth real
 * (Camada 2 depende de verificação do negócio + consentimento do Diego — ver
 * doc do PR). Misturam notas e estados de resposta para exercitar filtro por
 * estrela e o contador "respondidas vs sem resposta" do dashboard.
 */
export const AVALIACOES_GOOGLE_MOCK: AvaliacaoGoogle[] = [
  {
    id: "mock-gbp-1",
    autor: "Marcos Andrade",
    nota: 5,
    comentario: "Serviço impecável, técnico pontual e educado. Recomendo!",
    criadoEm: new Date("2026-05-28T14:00:00Z"),
    resposta: "Obrigado, Marcos! Volte sempre.",
  },
  {
    id: "mock-gbp-2",
    autor: "JulianaReis",
    nota: 4,
    comentario: "Bom atendimento, só atrasou um pouco.",
    criadoEm: new Date("2026-05-30T09:30:00Z"),
    resposta: null,
  },
  {
    id: "mock-gbp-3",
    autor: "Pedro Lima",
    nota: 5,
    comentario: "Resolveram um problema elétrico que ninguém resolvia.",
    criadoEm: new Date("2026-06-01T18:15:00Z"),
    resposta: null,
  },
  {
    id: "mock-gbp-4",
    autor: "Anônimo",
    nota: 2,
    comentario: "Achei caro pelo que foi feito.",
    criadoEm: new Date("2026-06-03T11:45:00Z"),
    resposta: null,
  },
  {
    id: "mock-gbp-5",
    autor: "Carla Souza",
    nota: 5,
    comentario: null,
    criadoEm: new Date("2026-06-05T16:20:00Z"),
    resposta: "Que bom que gostou, Carla!",
  },
  {
    id: "mock-gbp-6",
    autor: "Roberto Dias",
    nota: 3,
    comentario: "Serviço ok, mas a comunicação podia melhorar.",
    criadoEm: new Date("2026-06-07T10:00:00Z"),
    resposta: null,
  },
];
