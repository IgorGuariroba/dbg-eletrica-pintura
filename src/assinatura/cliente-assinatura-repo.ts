/**
 * Porta mínima de cliente para o fluxo de assinatura: resolve o cliente pelo
 * WhatsApp e cria um novo registro quando ele ainda não existe (cliente que
 * assina sem nunca ter aberto uma OS). Isola o use case do schema/DB.
 */
export interface ClienteAssinaturaRepo {
  buscarPorWhatsapp(whatsapp: string): Promise<{ id: string } | null>;
  criar(c: {
    nome: string;
    whatsapp: string;
    email: string;
  }): Promise<{ id: string }>;
}
