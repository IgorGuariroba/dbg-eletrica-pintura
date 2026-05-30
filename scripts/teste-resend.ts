import { config } from "dotenv";
config({ path: ".env.local" });

import { gerarPdfOrcamento, gerarPdfConclusao } from "@/notificacao/pdf-gerador";
import {
  criarEmailService,
  renderizarEmailOrcamento,
  renderizarEmailConclusao,
} from "@/notificacao/email-service";

const PARA = process.env.TESTE_PARA || "1g0r.guari@gmail.com";

async function main() {
  const service = criarEmailService(); // real (forceMock=false)
  console.log(`FROM: ${process.env.RESEND_FROM_EMAIL}`);
  console.log(`PARA: ${PARA}`);
  console.log(`KEY:  ${process.env.RESEND_API_KEY?.slice(0, 8)}...`);

  // ---- Orçamento ----
  const pdfOrc = await gerarPdfOrcamento({
    numeroOS: "TST-0001",
    clienteNome: "Igor (Teste)",
    clienteWhatsapp: "11999998888",
    endereco: "Rua das Flores, 123 - Centro, São Paulo - SP",
    tecnicoNome: "Diego Técnico",
    validade: "06/06/2026",
    itens: [
      { descricao: "Instalação de Tomada", quantidade: "2.00", precoUnitario: "50.00", subtotal: "100.00" },
      { descricao: "Fiação Chuveiro", quantidade: "1.00", precoUnitario: "150.00", subtotal: "150.00" },
    ],
    totalMaoDeObra: "250.00",
    totalDeslocamento: "30.00",
    total: "280.00",
  });
  const htmlOrc = await renderizarEmailOrcamento({
    clienteNome: "Igor (Teste)",
    numeroOS: "TST-0001",
    total: "280.00",
    urlPortal: "http://localhost:3000/s/tok-teste",
  });
  const r1 = await service.enviar({
    para: PARA,
    assunto: "[TESTE] Orçamento Disponível - OS TST-0001",
    html: htmlOrc,
    anexos: [{ filename: "orcamento_TST-0001.pdf", content: pdfOrc }],
  });
  console.log("Orçamento enviado:", r1);

  // ---- Conclusão ----
  const pdfConc = await gerarPdfConclusao({
    numeroOS: "TST-0001",
    clienteNome: "Igor (Teste)",
    clienteWhatsapp: "11999998888",
    endereco: "Rua das Flores, 123 - Centro, São Paulo - SP",
    tecnicoNome: "Diego Técnico",
    concluidoEm: "30/05/2026 18:00",
    observacoes: "Instalações concluídas. Fiação revisada e disjuntor testado.",
    materiais: [
      { item: "Tomada 20A", quantidade: 2 },
      { item: "Cabo Flexível 6mm", quantidade: 10 },
    ],
    fotosAntes: [],
    fotosDepois: [],
  });
  const htmlConc = await renderizarEmailConclusao({
    clienteNome: "Igor (Teste)",
    numeroOS: "TST-0001",
    urlPortal: "http://localhost:3000/s/tok-teste",
  });
  const r2 = await service.enviar({
    para: PARA,
    assunto: "[TESTE] Serviço Concluído - OS TST-0001",
    html: htmlConc,
    anexos: [{ filename: "relatorio_conclusao_TST-0001.pdf", content: pdfConc }],
  });
  console.log("Conclusão enviado:", r2);
}

main().catch((e) => {
  console.error("FALHA:", e);
  process.exit(1);
});
