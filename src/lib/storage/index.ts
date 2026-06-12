// Módulo Storage único (#166): interface por intenção — bucket (público vs
// privado), convenção de chave e expiração de URL assinada são implementação.
// Nenhum outro módulo instancia S3Client nem importa o SDK da AWS.
export {
  enviarPdfDocumento,
  listarFotosOs,
  montarChaveFotoOs,
  obterUrlLeituraAssinada,
  salvarPdfOs,
  uploadAssinaturaOsR2,
  uploadFotoChecklistR2,
  uploadFotoGarantia,
  uploadFotoOsR2,
  uploadServiceSolicitacaoR2,
  type TipoFotoOs,
  type UploadFotoChecklist,
  type UploadFotoOs,
} from "./privado";
export { uploadServicePublicoR2, urlPublicaFoto } from "./publico";
export { copiadorR2 } from "./portfolio";
export {
  chaveCertificado,
  chaveFatura,
  chaveRelatorio,
} from "./chaves-documentos";
