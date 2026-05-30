/**
 * Teste do e-mail de CONCLUSÃO com fotos antes/depois embutidas no PDF.
 *
 * Gera 4 PNGs de teste (2 antes + 2 depois) como data URI — sem dependência externa,
 * usando um encoder PNG puro com o zlib nativo do Node — e dispara o envio real via Resend.
 *
 * Uso:  npx tsx scripts/teste-resend-fotos.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { deflateSync } from "node:zlib";
import { gerarPdfConclusao } from "@/notificacao/pdf-gerador";
import { criarEmailService, renderizarEmailConclusao } from "@/notificacao/email-service";

const PARA = process.env.TESTE_PARA || "1g0r.guari@gmail.com";

// ---- CRC32 p/ chunks PNG ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Gera um PNG RGB com cor base + N faixas verticais claras, retornando data URI. */
function gerarPng(w: number, h: number, rgb: [number, number, number], faixas: number): string {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const rowStart = y * (1 + w * 3);
    raw[rowStart] = 0; // filter none
    for (let x = 0; x < w; x++) {
      const p = rowStart + 1 + x * 3;
      // faixas verticais claras p/ diferenciar índice
      const naFaixa = faixas > 0 && Math.floor((x / w) * faixas * 2) % 2 === 0 && x < (faixas / 8) * w;
      // gradiente vertical suave
      const fator = 0.6 + 0.4 * (y / h);
      const clarear = naFaixa ? 70 : 0;
      raw[p] = Math.min(255, rgb[0] * fator + clarear);
      raw[p + 1] = Math.min(255, rgb[1] * fator + clarear);
      raw[p + 2] = Math.min(255, rgb[2] * fator + clarear);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // assinatura
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function main() {
  console.log(`Gerando imagens de teste…`);
  // antes = tons quentes (laranja/vermelho), depois = tons frios (azul DBG/verde)
  const fotosAntes = [
    gerarPng(400, 300, [200, 90, 40], 1),
    gerarPng(400, 300, [180, 70, 60], 2),
  ];
  const fotosDepois = [
    gerarPng(400, 300, [60, 170, 240], 1), // azul ~ primária
    gerarPng(400, 300, [70, 180, 120], 2),
  ];

  console.log(`Gerando PDF de conclusão com 2 fotos antes + 2 depois…`);
  const pdf = await gerarPdfConclusao({
    numeroOS: "TST-FOTO",
    clienteNome: "Igor (Teste Fotos)",
    clienteWhatsapp: "11999998888",
    endereco: "Rua das Flores, 123 - Centro, São Paulo - SP",
    tecnicoNome: "Diego Técnico",
    concluidoEm: "31/05/2026 20:00",
    observacoes: "Troca de fiação e instalação concluídas. Registro fotográfico antes/depois anexo.",
    materiais: [
      { item: "Tomada 20A", quantidade: 2 },
      { item: "Cabo Flexível 6mm", quantidade: 10 },
    ],
    fotosAntes,
    fotosDepois,
  });
  console.log(`PDF gerado: ${(pdf.length / 1024).toFixed(1)} KB`);

  const html = await renderizarEmailConclusao({
    clienteNome: "Igor (Teste Fotos)",
    numeroOS: "TST-FOTO",
    urlPortal: "http://localhost:3000/s/tok-teste",
  });

  const service = criarEmailService(); // real
  console.log(`Enviando para ${PARA}…`);
  const res = await service.enviar({
    para: PARA,
    assunto: "[TESTE] Conclusão com fotos antes/depois - OS TST-FOTO",
    html,
    anexos: [{ filename: "relatorio_conclusao_TST-FOTO.pdf", content: pdf }],
  });
  console.log("Enviado:", res);
}

main().catch((e) => {
  console.error("FALHA:", e);
  process.exit(1);
});
