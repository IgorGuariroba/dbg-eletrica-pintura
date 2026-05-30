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

/** Mensagem pedindo aprovação remota de um Orçamento Complementar. */
export function mensagemAprovacaoComplementar(input: {
  clienteNome: string;
  tecnicoNome: string;
  link: string;
}): string {
  return `Olá ${input.clienteNome}, sou ${input.tecnicoNome} da DBG. Identifiquei um serviço adicional necessário. Veja o orçamento complementar e aprove por aqui: ${input.link}`;
}
