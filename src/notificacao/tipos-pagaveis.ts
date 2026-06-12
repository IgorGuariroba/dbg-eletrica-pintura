// Tipos de OS que cobram pagamento (estado terminal do cliente = PAGA).
// Módulo neutro: importado por dispatcher e jobs sem criar ciclo com
// notificar.ts (dispatcher → lembrete-pagamento → notificar → dispatcher).
export const TIPOS_PAGAVEIS = ["NORMAL", "EXPRESS", "COMPLEMENTAR"] as const;
