import { S3Client } from "@aws-sdk/client-s3";

// Clientes S3 únicos e lazy do módulo Storage — credenciais lidas num lugar
// só. Privado: fotos de OS, assinaturas, PDFs, fotos de garantia/solicitação.
// Público: fotos do catálogo e do portfólio (servidas por R2_PUBLIC_BASE_URL).

let privadoCache: { client: S3Client; bucket: string } | null = null;
let publicoCache: { client: S3Client; bucket: string } | null = null;

export function clientePrivado(): { client: S3Client; bucket: string } {
  if (privadoCache) return privadoCache;
  const accountId = process.env.R2_PRIVATE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_PRIVATE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_PRIVATE_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_PRIVATE_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 privado não configurado (verifique R2_PRIVATE_*)");
  }
  privadoCache = {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket,
  };
  return privadoCache;
}

export function clientePublico(): { client: S3Client; bucket: string } {
  if (publicoCache) return publicoCache;
  const accountId = process.env.R2_PUBLIC_ACCOUNT_ID;
  const accessKeyId = process.env.R2_PUBLIC_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_PUBLIC_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_PUBLIC_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 público não configurado (verifique R2_PUBLIC_*)");
  }
  publicoCache = {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket,
  };
  return publicoCache;
}
