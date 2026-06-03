import { resolverJanelaGarantia, type JanelaOriginal } from "@/documentos/janela-garantia";

export { type JanelaOriginal };

export function avaliarAcionamentoGarantia(input: {
  agora: Date;
  ancora: JanelaOriginal;
  temComplementarRejeitado: boolean;
}): { dentroDoPrazo: boolean; fim: Date; temComplementarRejeitado: boolean } {
  const janela = resolverJanelaGarantia({
    tipo: "NORMAL", // A âncora é sempre tratada como o prazo normal a partir da data de pagamento original
    prazoMeses: input.ancora.prazoMeses,
    pagamentoEm: input.ancora.pagamentoEm,
  });

  const dentroDoPrazo = input.agora <= janela.fim;

  return {
    dentroDoPrazo,
    fim: janela.fim,
    temComplementarRejeitado: input.temComplementarRejeitado,
  };
}
