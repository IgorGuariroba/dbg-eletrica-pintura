import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { criarUploadService, type UploadService } from "@/catalogo/r2-upload";
import { clientePublico } from "./clientes";

const cache = new Map<string, UploadService>();

/**
 * Upload público por intenção: fotos de serviço do catálogo (`servicos`),
 * fotos de perfil de técnico etc. — prefixo define a intenção, base URL
 * pública serve direto (sem URL assinada).
 */
export function uploadServicePublicoR2(keyPrefix = "servicos"): UploadService {
  const existente = cache.get(keyPrefix);
  if (existente) return existente;
  const baseUrl = process.env.R2_PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new Error("R2 público não configurado (verifique R2_PUBLIC_*)");
  }
  const { client, bucket } = clientePublico();
  const svc = criarUploadService({
    bucket,
    baseUrl,
    keyPrefix,
    presignedPut: async ({ bucket: b, key, contentType }) => {
      const cmd = new PutObjectCommand({
        Bucket: b,
        Key: key,
        ContentType: contentType,
      });
      return getSignedUrl(client, cmd, { expiresIn: 300 });
    },
  });
  cache.set(keyPrefix, svc);
  return svc;
}

/** URL pública de uma foto aprovada (R2 público + base URL). */
export function urlPublicaFoto(chavePublica: string): string {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) throw new Error("R2_PUBLIC_BASE_URL não configurada");
  return `${base.replace(/\/$/, "")}/${chavePublica}`;
}
