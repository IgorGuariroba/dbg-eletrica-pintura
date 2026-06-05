import React from "react";
import { render, Html, Body, Head, Container, Heading, Text, Link } from "react-email";
import { Resend } from "resend";
import { CORES } from "./cores";

// ============================================================
// 1. Templates React Email
// ============================================================

export interface OrcamentoEmailProps {
  clienteNome: string;
  numeroOS: string;
  total: string;
  urlPortal: string;
}

export const OrcamentoEmail: React.FC<OrcamentoEmailProps> = ({
  clienteNome,
  numeroOS,
  total,
  urlPortal,
}) => (
  <Html>
    <Head />
    <Body style={{ fontFamily: "sans-serif", backgroundColor: CORES.mutedBg, color: CORES.texto, padding: "20px" }}>
      <Container style={{ backgroundColor: CORES.fundo, padding: "20px", borderRadius: "8px", border: `1px solid ${CORES.borda}` }}>
        <Heading style={{ color: CORES.primaria, fontSize: "20px", marginBottom: "15px" }}>Olá, {clienteNome}!</Heading>
        <Text style={{ fontSize: "14px", lineHeight: "1.5" }}>
          O orçamento para a sua Ordem de Serviço <strong>{numeroOS}</strong> está pronto para sua análise.
        </Text>
        <Text style={{ fontSize: "16px", margin: "15px 0" }}>
          Valor Total Estimado: <strong style={{ color: CORES.primaria }}>R$ {Number(total).toFixed(2)}</strong>
        </Text>
        <Text style={{ fontSize: "14px", lineHeight: "1.5" }}>
          Você pode verificar os detalhes do orçamento e a validade no documento PDF em anexo.
        </Text>
        <Text style={{ fontSize: "14px", lineHeight: "1.5", marginTop: "20px" }}>
          Para aprovar ou rejeitar o orçamento presencial ou remotamente, por favor acesse nosso portal clicando no botão abaixo:
        </Text>
        <Link 
          href={urlPortal} 
          style={{ 
            display: "inline-block", 
            backgroundColor: CORES.primaria, 
            color: CORES.primariaTexto, 
            padding: "10px 20px", 
            borderRadius: "6px", 
            textDecoration: "none", 
            fontWeight: "bold",
            marginTop: "10px" 
          }}
        >
          Visualizar e Aprovar Orçamento
        </Link>
        <Text style={{ fontSize: "11px", color: CORES.mutedTexto, marginTop: "30px", borderTop: `1px solid ${CORES.borda}`, paddingTop: "10px" }}>
          Este é um e-mail automático enviado por DBG Elétrica e Pintura. Por favor, não responda a este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
);

export interface ConclusaoEmailProps {
  clienteNome: string;
  numeroOS: string;
  urlPortal: string;
}

export const ConclusaoEmail: React.FC<ConclusaoEmailProps> = ({
  clienteNome,
  numeroOS,
  urlPortal,
}) => (
  <Html>
    <Head />
    <Body style={{ fontFamily: "sans-serif", backgroundColor: CORES.mutedBg, color: CORES.texto, padding: "20px" }}>
      <Container style={{ backgroundColor: CORES.fundo, padding: "20px", borderRadius: "8px", border: `1px solid ${CORES.borda}` }}>
        <Heading style={{ color: CORES.primaria, fontSize: "20px", marginBottom: "15px" }}>Olá, {clienteNome}!</Heading>
        <Text style={{ fontSize: "14px", lineHeight: "1.5" }}>
          Informamos que os serviços da sua Ordem de Serviço <strong>{numeroOS}</strong> foram concluídos com sucesso pelo nosso técnico.
        </Text>
        <Text style={{ fontSize: "14px", lineHeight: "1.5", marginTop: "10px" }}>
          O relatório de encerramento do serviço, incluindo notas do técnico, materiais aplicados, fotos do antes e depois e o termo de garantia formal estão anexados em formato PDF a este e-mail.
        </Text>
        <Text style={{ fontSize: "14px", lineHeight: "1.5", marginTop: "20px" }}>
          Caso queira acompanhar o histórico de seus serviços, faturas ou acionar garantias no futuro, acesse o portal do cliente no link abaixo:
        </Text>
        <Link 
          href={urlPortal} 
          style={{ 
            display: "inline-block", 
            backgroundColor: CORES.primaria, 
            color: CORES.primariaTexto, 
            padding: "10px 20px", 
            borderRadius: "6px", 
            textDecoration: "none", 
            fontWeight: "bold",
            marginTop: "10px" 
          }}
        >
          Acessar Portal DBG
        </Link>
        <Text style={{ fontSize: "11px", color: CORES.mutedTexto, marginTop: "30px", borderTop: `1px solid ${CORES.borda}`, paddingTop: "10px" }}>
          Este é um e-mail automático enviado por DBG Elétrica e Pintura. Por favor, não responda a este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
);

export interface LembretePagamentoEmailProps {
  clienteNome: string;
  numeroOS: string;
  valor: string;
  urlPortal: string;
}

export const LembretePagamentoEmail: React.FC<LembretePagamentoEmailProps> = ({
  clienteNome,
  numeroOS,
  valor,
  urlPortal,
}) => (
  <Html>
    <Head />
    <Body style={{ fontFamily: "sans-serif", backgroundColor: CORES.mutedBg, color: CORES.texto, padding: "20px" }}>
      <Container style={{ backgroundColor: CORES.fundo, padding: "20px", borderRadius: "8px", border: `1px solid ${CORES.borda}` }}>
        <Heading style={{ color: CORES.primaria, fontSize: "20px", marginBottom: "15px" }}>Olá, {clienteNome}!</Heading>
        <Text style={{ fontSize: "14px", lineHeight: "1.5" }}>
          A sua Ordem de Serviço <strong>{numeroOS}</strong> foi concluída, mas ainda não identificamos o pagamento.
        </Text>
        <Text style={{ fontSize: "16px", margin: "15px 0" }}>
          Valor em aberto: <strong style={{ color: CORES.primaria }}>R$ {Number(valor).toFixed(2)}</strong>
        </Text>
        <Text style={{ fontSize: "14px", lineHeight: "1.5", marginTop: "20px" }}>
          Você pode regularizar o pagamento de forma rápida e segura pelo nosso portal:
        </Text>
        <Link
          href={urlPortal}
          style={{
            display: "inline-block",
            backgroundColor: CORES.primaria,
            color: CORES.primariaTexto,
            padding: "10px 20px",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: "bold",
            marginTop: "10px",
          }}
        >
          Efetuar Pagamento
        </Link>
        <Text style={{ fontSize: "11px", color: CORES.mutedTexto, marginTop: "30px", borderTop: `1px solid ${CORES.borda}`, paddingTop: "10px" }}>
          Este é um e-mail automático enviado por DBG Elétrica e Pintura. Por favor, não responda a este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
);

export interface DocumentosEmailProps {
  clienteNome: string;
  numeroOS: string;
  urlPortal: string;
  /** URL assinada da fatura, se gerada. */
  faturaUrl?: string | null;
  /** URL assinada do certificado de garantia, se gerado. */
  certificadoUrl?: string | null;
}

export const DocumentosEmail: React.FC<DocumentosEmailProps> = ({
  clienteNome,
  numeroOS,
  urlPortal,
  faturaUrl,
  certificadoUrl,
}) => (
  <Html>
    <Head />
    <Body style={{ fontFamily: "sans-serif", backgroundColor: CORES.mutedBg, color: CORES.texto, padding: "20px" }}>
      <Container style={{ backgroundColor: CORES.fundo, padding: "20px", borderRadius: "8px", border: `1px solid ${CORES.borda}` }}>
        <Heading style={{ color: CORES.primaria, fontSize: "20px", marginBottom: "15px" }}>Olá, {clienteNome}!</Heading>
        <Text style={{ fontSize: "14px", lineHeight: "1.5" }}>
          Os documentos da sua Ordem de Serviço <strong>{numeroOS}</strong> estão disponíveis (também em anexo):
        </Text>
        {faturaUrl ? (
          <Text style={{ fontSize: "14px", margin: "6px 0" }}>
            <Link href={faturaUrl} style={{ color: CORES.primaria }}>Fatura</Link>
          </Text>
        ) : null}
        {certificadoUrl ? (
          <Text style={{ fontSize: "14px", margin: "6px 0" }}>
            <Link href={certificadoUrl} style={{ color: CORES.primaria }}>Certificado de garantia</Link>
          </Text>
        ) : null}
        <Text style={{ fontSize: "14px", lineHeight: "1.5", marginTop: "20px" }}>
          Acompanhe tudo no seu portal:
        </Text>
        <Link
          href={urlPortal}
          style={{
            display: "inline-block",
            backgroundColor: CORES.primaria,
            color: CORES.primariaTexto,
            padding: "10px 20px",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: "bold",
            marginTop: "10px",
          }}
        >
          Acessar Portal
        </Link>
        <Text style={{ fontSize: "11px", color: CORES.mutedTexto, marginTop: "30px", borderTop: `1px solid ${CORES.borda}`, paddingTop: "10px" }}>
          Este é um e-mail automático enviado por DBG Elétrica e Pintura. Por favor, não responda a este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
);

export interface PedidoAvaliacaoEmailProps {
  clienteNome: string;
  urlPortal: string;
}

export const PedidoAvaliacaoEmail: React.FC<PedidoAvaliacaoEmailProps> = ({
  clienteNome,
  urlPortal,
}) => (
  <Html>
    <Head />
    <Body style={{ fontFamily: "sans-serif", backgroundColor: CORES.mutedBg, color: CORES.texto, padding: "20px" }}>
      <Container style={{ backgroundColor: CORES.fundo, padding: "20px", borderRadius: "8px", border: `1px solid ${CORES.borda}` }}>
        <Heading style={{ color: CORES.primaria, fontSize: "20px", marginBottom: "15px" }}>Olá, {clienteNome}!</Heading>
        <Text style={{ fontSize: "14px", lineHeight: "1.5" }}>
          Sua opinião é muito importante para nós. Por favor, dedique um minuto para avaliar o serviço realizado na sua residência/empresa.
        </Text>
        <Text style={{ fontSize: "14px", lineHeight: "1.5", marginTop: "20px" }}>
          Acesse o link abaixo para avaliar a sua Ordem de Serviço com estrelas e deixar seus comentários:
        </Text>
        <Link
          href={`${urlPortal}/avaliar`}
          style={{
            display: "inline-block",
            backgroundColor: CORES.primaria,
            color: CORES.primariaTexto,
            padding: "10px 20px",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: "bold",
            marginTop: "10px",
          }}
        >
          Avaliar Serviço
        </Link>
        <Text style={{ fontSize: "11px", color: CORES.mutedTexto, marginTop: "30px", borderTop: `1px solid ${CORES.borda}`, paddingTop: "10px" }}>
          Este é um e-mail automático enviado por DBG Elétrica e Pintura. Por favor, não responda a este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
);

// ============================================================
// 2. Funções Auxiliares de Renderização
// ============================================================

export async function renderizarEmailDocumentos(props: DocumentosEmailProps): Promise<string> {
  const comp = React.createElement(DocumentosEmail, props);
  return await render(comp);
}

export async function renderizarEmailOrcamento(props: OrcamentoEmailProps): Promise<string> {
  const comp = React.createElement(OrcamentoEmail, props);
  return await render(comp);
}

export async function renderizarEmailConclusao(props: ConclusaoEmailProps): Promise<string> {
  const comp = React.createElement(ConclusaoEmail, props);
  return await render(comp);
}

export async function renderizarEmailLembretePagamento(props: LembretePagamentoEmailProps): Promise<string> {
  const comp = React.createElement(LembretePagamentoEmail, props);
  return await render(comp);
}

export interface GarantiaAcionadaEmailProps {
  clienteNome: string;
  numeroOS: string;
  urlPortal: string;
}

export const GarantiaAcionadaEmail: React.FC<GarantiaAcionadaEmailProps> = ({
  clienteNome,
  numeroOS,
  urlPortal,
}) => (
  <Html>
    <Head />
    <Body style={{ fontFamily: "sans-serif", backgroundColor: CORES.mutedBg, color: CORES.texto, padding: "20px" }}>
      <Container style={{ backgroundColor: CORES.fundo, padding: "20px", borderRadius: "8px", border: `1px solid ${CORES.borda}` }}>
        <Heading style={{ color: CORES.primaria, fontSize: "20px", marginBottom: "15px" }}>Olá, {clienteNome}!</Heading>
        <Text style={{ fontSize: "14px", lineHeight: "1.5" }}>
          Confirmamos que o seu chamado de garantia foi aprovado. A sua Ordem de Serviço de Garantia <strong>{numeroOS}</strong> foi gerada e está agendada.
        </Text>
        <Text style={{ fontSize: "14px", lineHeight: "1.5", marginTop: "10px" }}>
          Nenhum custo será cobrado por este atendimento, em conformidade com o nosso termo de garantia de mão de obra.
        </Text>
        <Text style={{ fontSize: "14px", lineHeight: "1.5", marginTop: "20px" }}>
          Você pode acompanhar o andamento da Ordem de Serviço em tempo real pelo portal do cliente:
        </Text>
        <Link 
          href={urlPortal} 
          style={{ 
            display: "inline-block", 
            backgroundColor: CORES.primaria, 
            color: CORES.primariaTexto, 
            padding: "10px 20px", 
            borderRadius: "6px", 
            textDecoration: "none", 
            fontWeight: "bold",
            marginTop: "10px" 
          }}
        >
          Acessar Portal DBG
        </Link>
        <Text style={{ fontSize: "11px", color: CORES.mutedTexto, marginTop: "30px", borderTop: `1px solid ${CORES.borda}`, paddingTop: "10px" }}>
          Este é um e-mail automático enviado por DBG Elétrica e Pintura. Por favor, não responda a este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
);

export async function renderizarEmailGarantiaAcionada(props: GarantiaAcionadaEmailProps): Promise<string> {
  const comp = React.createElement(GarantiaAcionadaEmail, props);
  return await render(comp);
}

export async function renderizarEmailPedidoAvaliacao(props: PedidoAvaliacaoEmailProps): Promise<string> {
  const comp = React.createElement(PedidoAvaliacaoEmail, props);
  return await render(comp);
}

// ----------------------------------------------------------------
// Template de Reavaliação (Issue #53) — link /reavaliar
// ----------------------------------------------------------------
export interface PedidoReavaliacaoEmailProps {
  clienteNome: string;
  urlReavaliacao: string;
}

export const PedidoReavaliacaoEmail: React.FC<PedidoReavaliacaoEmailProps> = ({
  clienteNome,
  urlReavaliacao,
}) => (
  <Html>
    <Head />
    <Body style={{ fontFamily: "sans-serif", backgroundColor: CORES.mutedBg, color: CORES.texto, padding: "20px" }}>
      <Container style={{ backgroundColor: CORES.fundo, padding: "20px", borderRadius: "8px", border: `1px solid ${CORES.borda}` }}>
        <Heading style={{ color: CORES.primaria, fontSize: "20px", marginBottom: "15px" }}>Olá, {clienteNome}!</Heading>
        <Text style={{ fontSize: "14px", lineHeight: "1.5" }}>
          Após nossa tratativa, gostaríamos de saber se sua experiência melhorou. Sua opinião nos ajuda a continuar evoluindo.
        </Text>
        <Text style={{ fontSize: "14px", lineHeight: "1.5", marginTop: "20px" }}>
          Acesse o link abaixo para reavaliar o atendimento:
        </Text>
        <Link
          href={urlReavaliacao}
          style={{
            display: "inline-block",
            backgroundColor: CORES.primaria,
            color: CORES.primariaTexto,
            padding: "10px 20px",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: "bold",
            marginTop: "10px",
          }}
        >
          Reavaliar Atendimento
        </Link>
        <Text style={{ fontSize: "11px", color: CORES.mutedTexto, marginTop: "30px", borderTop: `1px solid ${CORES.borda}`, paddingTop: "10px" }}>
          Este é um e-mail automático enviado por DBG Elétrica e Pintura. Por favor, não responda a este e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
);

export async function renderizarEmailReavaliacao(props: PedidoReavaliacaoEmailProps): Promise<string> {
  const comp = React.createElement(PedidoReavaliacaoEmail, props);
  return await render(comp);
}

// ============================================================
// 3. Fábrica do EmailService (Resend / Mock)
// ============================================================

export interface EnviarEmailInput {
  para: string;
  assunto: string;
  html: string;
  anexos?: {
    filename: string;
    content: Buffer;
  }[];
}

export interface EmailService {
  enviar(input: EnviarEmailInput): Promise<{ id: string } | null>;
}

export interface CriarEmailServiceConfig {
  forceMock?: boolean;
}

export function criarEmailService(config: CriarEmailServiceConfig = {}): EmailService {
  const apiKey = process.env.RESEND_API_KEY;
  const remetentePadrao = process.env.RESEND_FROM_EMAIL || "DBG Elétrica e Pintura <notificacoes@dbg.eletrica.br>";

  const isMock = config.forceMock || !apiKey || apiKey === "test";

  if (isMock) {
    return {
      async enviar(input) {
        const id = `mock-id-${Math.random().toString(36).slice(2, 12)}`;
        console.log(`[EmailService MOCK] E-mail enviado para: ${input.para} | Assunto: ${input.assunto} | ID: ${id}`);
        return { id };
      },
    };
  }

  const resend = new Resend(apiKey);

  return {
    async enviar(input) {
      const { data, error } = await resend.emails.send({
        from: remetentePadrao,
        to: input.para,
        subject: input.assunto,
        html: input.html,
        attachments: input.anexos?.map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
      });

      if (error) {
        throw new Error(`Erro ao enviar e-mail via Resend: ${error.message}`);
      }

      return data ? { id: data.id } : null;
    },
  };
}
