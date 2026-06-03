export interface GarantiaRepo {
  carregarAncora(
    osId: string,
  ): Promise<{
    ancoraId: string;
    prazoMeses: number;
    pagamentoEm: Date;
    tipo: "NORMAL" | "EXPRESS" | "COMPLEMENTAR" | "PREVENTIVA" | "GARANTIA";
  } | null>;
  temComplementarRejeitado(ancoraId: string): Promise<boolean>;
  criarChamado(dados: {
    osOrigemId: string;
    descricao: string;
    fotoUrl: string;
    criadoPor: string;
    canal: "PORTAL" | "WHATSAPP";
    temComplementarRejeitado: boolean;
    acionamentoInvalido: boolean;
  }): Promise<{ id: string }>;
}
