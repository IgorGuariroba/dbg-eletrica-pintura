import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { UploadAssinatura } from "./aprovacao-presencial";

export interface AssinarInput {
  filename: string;
  contentType: string;
  /** Tamanho exato do arquivo em bytes — assinado na URL como teto do PUT. */
  contentLength: number;
}

export const TAMANHO_MAX_FOTO_BYTES = 10 * 1024 * 1024;

export interface AssinarOutput {
  uploadUrl: string;
  key: string;
}

export type TipoFotoOs = "ANTES" | "DEPOIS";

export interface AssinarFotoOsInput {
  osId: string;
  tipo: TipoFotoOs;
}

export interface UploadServicePrivado {
  assinarUploadFoto(input: AssinarInput): Promise<AssinarOutput>;
  /** Assina o upload de uma foto de execução, chaveada por OS e tipo. */
  assinarUploadFotoOs(input: AssinarFotoOsInput): Promise<AssinarOutput>;
}

/** Chave do objeto no R2: `os/{id}/{antes|depois}/{uuid}.jpg`. */
export function montarChaveFotoOs(osId: string, tipo: TipoFotoOs): string {
  return `os/${osId}/${tipo.toLowerCase()}/${randomUUID()}.jpg`;
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

/** Chave da assinatura no R2: `assinaturas/os/{id}/{uuid}.png`. */
export function montarChaveAssinaturaOs(osId: string): string {
  return `assinaturas/os/${osId}/${randomUUID()}.png`;
}

export interface UploadFotoOs {
  enviarFoto(input: {
    osId: string;
    tipo: TipoFotoOs;
    dataUrl: string;
  }): Promise<{ url: string }>;
}

export function uploadFotoOsR2(): UploadFotoOs {
  return {
    async enviarFoto({ osId, tipo, dataUrl }) {
      const virgula = dataUrl.indexOf(",");
      if (virgula < 0) throw new Error("data URL de foto inválido");
      const corpo = Buffer.from(dataUrl.slice(virgula + 1), "base64");
      const key = montarChaveFotoOs(osId, tipo);
      const { client, bucket } = init();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: corpo,
          ContentType: "image/jpeg",
        }),
      );
      return { url: key };
    },
  };
}

export interface UploadFotoChecklist {
  enviar(input: {
    osId: string;
    itemId: string;
    dataUrl: string;
  }): Promise<{ url: string }>;
}

/** Chave da foto de checklist no R2: `os/{id}/checklist/{itemId}/{uuid}.jpg`. */
export function montarChaveFotoChecklist(osId: string, itemId: string): string {
  return `os/${osId}/checklist/${itemId}/${randomUUID()}.jpg`;
}

export function uploadFotoChecklistR2(): UploadFotoChecklist {
  return {
    async enviar({ osId, itemId, dataUrl }) {
      const virgula = dataUrl.indexOf(",");
      if (virgula < 0) throw new Error("data URL de foto inválido");
      const corpo = Buffer.from(dataUrl.slice(virgula + 1), "base64");
      const key = montarChaveFotoChecklist(osId, itemId);
      const { client, bucket } = init();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: corpo,
          ContentType: "image/jpeg",
        }),
      );
      return { url: key };
    },
  };
}

/**
 * Envio server-side da assinatura manuscrita (data URL base64 → PNG no R2).
 * Server-side em vez de presigned: o PWA pode replayar no sync offline sem
 * precisar de uma URL assinada válida no momento.
 */

export function uploadAssinaturaOsR2(): UploadAssinatura {
  return {
    async enviarAssinatura({ osId, dataUrl }) {
      const virgula = dataUrl.indexOf(",");
      if (virgula < 0) throw new Error("data URL de assinatura inválido");
      const corpo = Buffer.from(dataUrl.slice(virgula + 1), "base64");
      const key = montarChaveAssinaturaOs(osId);
      const { client, bucket } = init();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: corpo,
          ContentType: "image/png",
        }),
      );
      return { url: key };
    },
  };
}

export function uploadServiceSolicitacaoR2(): UploadServicePrivado {
  if (cached) return cached;
  cached = {
    async assinarUploadFoto({ filename, contentType, contentLength }) {
      const tipo = contentType.toLowerCase();
      if (!TIPOS_PERMITIDOS.has(tipo)) {
        throw new Error(
          "tipo de imagem não permitido (use JPG, PNG, WEBP ou AVIF)",
        );
      }
      if (
        !Number.isInteger(contentLength) ||
        contentLength <= 0 ||
        contentLength > TAMANHO_MAX_FOTO_BYTES
      ) {
        throw new Error("foto deve ter entre 1 byte e 10MB");
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
          ContentLength: contentLength,
        }),
        {
          expiresIn: 300,
          // Inclui content-length nos SignedHeaders: o PUT só é aceito pelo
          // R2 se enviar exatamente o tamanho assinado.
          signableHeaders: new Set(["content-length"]),
        },
      );
      return { uploadUrl, key };
    },
    async assinarUploadFotoOs({ osId, tipo }) {
      const key = montarChaveFotoOs(osId, tipo);
      const { client, bucket } = init();
      const uploadUrl = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ContentType: "image/jpeg",
        }),
        { expiresIn: 300 },
      );
      return { uploadUrl, key };
    },
  };
  return cached;
}

export async function enviarPdfDocumento(key: string, corpo: Buffer): Promise<void> {
  const { client, bucket } = init();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: corpo,
      ContentType: "application/pdf",
    }),
  );
}

export async function obterUrlLeituraAssinada(
  key: string,
  expiresInSeconds: number = 7 * 24 * 60 * 60,
): Promise<string> {
  const { client, bucket } = init();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function listarFotosOs(osId: string, tipo: TipoFotoOs): Promise<string[]> {
  try {
    const { client, bucket } = init();
    const prefix = `os/${osId}/${tipo.toLowerCase()}/`;
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    });
    const res = await client.send(command);
    return res.Contents?.map((c) => c.Key).filter((k): k is string => !!k) ?? [];
  } catch (e) {
    console.error(`Erro ao listar fotos do R2 para OS ${osId}:`, e);
    return [];
  }
}

export async function uploadFotoGarantia(dataUrl: string, osId: string): Promise<string> {
  const virgula = dataUrl.indexOf(",");
  if (virgula < 0) throw new Error("data URL de foto inválido");
  const corpo = Buffer.from(dataUrl.slice(virgula + 1), "base64");
  const key = `chamados/os-${osId}/${randomUUID()}.jpg`;
  const { client, bucket } = init();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: corpo,
      ContentType: "image/jpeg",
    }),
  );
  return key;
}

