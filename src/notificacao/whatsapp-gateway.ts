/**
 * Porta de saída para a WhatsApp Business Cloud API (Meta). Isola o HTTP do
 * domínio: `enviarTemplate` e o processador da fila dependem desta interface,
 * testável com fake. A factory devolve um mock quando as credenciais não estão
 * configuradas (mesmo padrão de `criarEmailService`), permitindo rodar dev e
 * testes sem bater na Graph API.
 */

export interface EnviarTemplateRequest {
  /** WhatsApp do destinatário em formato E.164 sem `+` (ex: 5511995236068). */
  destinatario: string;
  /** Nome do template aprovado na Meta Business Manager. */
  template: string;
  /** Variáveis do corpo do template (ex: nome_cliente, link). */
  variaveis: Record<string, string>;
}

export interface EnviarTemplateResponse {
  /** `messages[0].id` (wamid) devolvido pela Graph API. */
  messageId: string;
}

export interface GatewayWhatsApp {
  enviarTemplate(req: EnviarTemplateRequest): Promise<EnviarTemplateResponse>;
}

export interface CriarGatewayWhatsAppConfig {
  forceMock?: boolean;
}

const GRAPH_API_VERSION = "v21.0";

/**
 * Constrói o gateway real a partir das credenciais de ambiente
 * (`META_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN`). Sem elas — ou com `forceMock`
 * — devolve um mock que loga e retorna um `messageId` falso.
 */
export function criarGatewayWhatsApp(
  config: CriarGatewayWhatsAppConfig = {},
): GatewayWhatsApp {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  const isMock = config.forceMock || !phoneNumberId || !accessToken;

  if (isMock) {
    return {
      async enviarTemplate(req) {
        const messageId = `mock-wamid-${Math.random().toString(36).slice(2, 12)}`;
        console.log(
          `[WhatsAppGateway MOCK] template=${req.template} para=${req.destinatario} id=${messageId}`,
        );
        return { messageId };
      },
    };
  }

  return {
    async enviarTemplate(req) {
      const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
      // Variáveis viram parâmetros posicionais do corpo na ordem de inserção —
      // a ordem dos templates é fixada na Meta Business Manager (ver doc do PR).
      const parameters = Object.values(req.variaveis).map((text) => ({
        type: "text",
        text,
      }));
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: req.destinatario,
          type: "template",
          template: {
            name: req.template,
            language: { code: "pt_BR" },
            components: parameters.length
              ? [{ type: "body", parameters }]
              : [],
          },
        }),
      });

      if (!resp.ok) {
        const detalhe = await resp.text().catch(() => "");
        throw new Error(
          `Cloud API falhou (${resp.status}): ${detalhe.slice(0, 300)}`,
        );
      }

      const json = (await resp.json()) as {
        messages?: { id: string }[];
      };
      const messageId = json.messages?.[0]?.id;
      if (!messageId) {
        throw new Error("Cloud API não retornou message id");
      }
      return { messageId };
    },
  };
}
