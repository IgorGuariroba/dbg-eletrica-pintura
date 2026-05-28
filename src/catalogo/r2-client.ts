import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { criarUploadService, type UploadService } from "./r2-upload";

let cached: UploadService | null = null;

export function uploadServicePublicoR2(): UploadService {
  if (cached) return cached;
  const accountId = process.env.R2_PUBLIC_ACCOUNT_ID;
  const accessKeyId = process.env.R2_PUBLIC_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_PUBLIC_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_PUBLIC_BUCKET;
  const baseUrl = process.env.R2_PUBLIC_BASE_URL;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !baseUrl) {
    throw new Error("R2 público não configurado (verifique R2_PUBLIC_*)");
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  cached = criarUploadService({
    bucket,
    baseUrl,
    presignedPut: async ({ bucket: b, key, contentType }) => {
      const cmd = new PutObjectCommand({
        Bucket: b,
        Key: key,
        ContentType: contentType,
      });
      return getSignedUrl(client, cmd, { expiresIn: 300 });
    },
  });
  return cached;
}
