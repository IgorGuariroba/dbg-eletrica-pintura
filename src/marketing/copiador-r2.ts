import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { CopiadorFotoPublica } from "./portfolio-repo";

function clientePrivado(): { client: S3Client; bucket: string } {
  const accountId = process.env.R2_PRIVATE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_PRIVATE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_PRIVATE_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_PRIVATE_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 privado não configurado (verifique R2_PRIVATE_*)");
  }
  return {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket,
  };
}

function clientePublico(): { client: S3Client; bucket: string } {
  const accountId = process.env.R2_PUBLIC_ACCOUNT_ID;
  const accessKeyId = process.env.R2_PUBLIC_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_PUBLIC_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_PUBLIC_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 público não configurado (verifique R2_PUBLIC_*)");
  }
  return {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket,
  };
}

/**
 * Copia a foto do R2 privado para o R2 público. Buckets são contas distintas,
 * então baixamos o objeto e reenviamos (não há copy server-side cross-account).
 */
export function copiadorR2(): CopiadorFotoPublica {
  return {
    async copiar(chavePrivada: string): Promise<{ chavePublica: string }> {
      const priv = clientePrivado();
      const obj = await priv.client.send(
        new GetObjectCommand({ Bucket: priv.bucket, Key: chavePrivada }),
      );
      const corpo = await obj.Body!.transformToByteArray();

      const pub = clientePublico();
      const chavePublica = `portfolio/${randomUUID()}.jpg`;
      await pub.client.send(
        new PutObjectCommand({
          Bucket: pub.bucket,
          Key: chavePublica,
          Body: corpo,
          ContentType: obj.ContentType ?? "image/jpeg",
        }),
      );
      return { chavePublica };
    },
  };
}

/** URL pública de uma foto aprovada (R2 público + base URL). */
export function urlPublicaFoto(chavePublica: string): string {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) throw new Error("R2_PUBLIC_BASE_URL não configurada");
  return `${base.replace(/\/$/, "")}/${chavePublica}`;
}
