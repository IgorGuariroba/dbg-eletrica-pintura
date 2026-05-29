import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface AssinarInput {
  filename: string;
  contentType: string;
}

export interface AssinarOutput {
  uploadUrl: string;
  key: string;
}

export interface UploadServicePrivado {
  assinarUploadFoto(input: AssinarInput): Promise<AssinarOutput>;
}

const EXT_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};
const TIPOS_PERMITIDOS = new Set(Object.keys(EXT_POR_TIPO));

let cached: UploadServicePrivado | null = null;
let clientCached: S3Client | null = null;
let bucketCached: string | null = null;

function init(): { client: S3Client; bucket: string } {
  if (clientCached && bucketCached) {
    return { client: clientCached, bucket: bucketCached };
  }
  const accountId = process.env.R2_PRIVATE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_PRIVATE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_PRIVATE_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_PRIVATE_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 privado não configurado (verifique R2_PRIVATE_*)");
  }
  clientCached = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  bucketCached = bucket;
  return { client: clientCached, bucket: bucketCached };
}

export function uploadServiceSolicitacaoR2(): UploadServicePrivado {
  if (cached) return cached;
  cached = {
    async assinarUploadFoto({ filename, contentType }) {
      const tipo = contentType.toLowerCase();
      if (!TIPOS_PERMITIDOS.has(tipo)) {
        throw new Error(
          "tipo de imagem não permitido (use JPG, PNG, WEBP ou AVIF)",
        );
      }
      void filename;
      const ext = EXT_POR_TIPO[tipo];
      const key = `solicitacoes/${randomUUID()}.${ext}`;
      const { client, bucket } = init();
      const uploadUrl = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ContentType: tipo,
        }),
        { expiresIn: 300 },
      );
      return { uploadUrl, key };
    },
  };
  return cached;
}
