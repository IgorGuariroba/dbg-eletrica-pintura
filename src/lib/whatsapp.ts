/** Monta um link wa.me (WhatsApp) com mensagem pré-preenchida. Grátis, sem API. */
export function montarLinkWhatsApp(input: {
  whatsapp: string;
  texto: string;
}): string {
  const numero = input.whatsapp.replace(/\D/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(input.texto)}`;
}

/** Mensagem do técnico avisando que está a caminho do endereço do cliente. */
export function mensagemACaminho(input: {
  clienteNome: string;
  tecnicoNome: string;
  endereco: string;
}): string {
  return `Olá ${input.clienteNome}, sou ${input.tecnicoNome} da DBG, estou a caminho do endereço ${input.endereco}`;
}

/** Para aprovação remota de um Orçamento Complementar. */
export function mensagemAprovacaoComplementar(input: {
  clienteNome: string;
  tecnicoNome: string;
  link: string;
}): string {
  return `Olá ${input.clienteNome}, sou ${input.tecnicoNome} da DBG. Identifiquei um serviço adicional necessário. Veja o orçamento complementar e aprove por aqui: ${input.link}`;
}

/** Mensagem de lembrete de pagamento para uma OS concluída. */
export function mensagemLembretePagamento(input: {
  clienteNome: string;
  protocolo: string;
  valor: string;
  link: string;
}): string {
  return `Olá ${input.clienteNome}, identificamos que a ordem de serviço ${input.protocolo} está concluída com o valor de R$ ${input.valor}, mas ainda não consta pagamento. Você pode efetuar o pagamento diretamente por este link: ${input.link}`;
}
