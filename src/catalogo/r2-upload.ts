import { randomUUID } from "node:crypto";

export interface PresignedPutArgs {
  bucket: string;
  key: string;
  contentType: string;
}

export type PresignedPut = (args: PresignedPutArgs) => Promise<string>;

export interface UploadServiceConfig {
  bucket: string;
  baseUrl: string;
  presignedPut: PresignedPut;
  keyPrefix?: string;
}

export interface AssinarInput {
  filename: string;
  contentType: string;
}

export interface AssinarOutput {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

const EXT_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

const TIPOS_PERMITIDOS = new Set(Object.keys(EXT_POR_TIPO));

export interface UploadService {
  assinarUploadFoto(input: AssinarInput): Promise<AssinarOutput>;
}

export function criarUploadService(cfg: UploadServiceConfig): UploadService {
  return {
    async assinarUploadFoto({ filename, contentType }) {
      const tipo = contentType.toLowerCase();
      if (!TIPOS_PERMITIDOS.has(tipo)) {
        throw new Error(
          "tipo de imagem não permitido (use JPG, PNG, WEBP ou AVIF)",
        );
      }
      const ext = EXT_POR_TIPO[tipo];
      const prefix = (cfg.keyPrefix ?? "servicos").replace(/^\/+|\/+$/g, "");
      const key = `${prefix}/${randomUUID()}.${ext}`;
      const uploadUrl = await cfg.presignedPut({
        bucket: cfg.bucket,
        key,
        contentType: tipo,
      });
      const base = cfg.baseUrl.replace(/\/$/, "");
      return { uploadUrl, publicUrl: `${base}/${key}`, key };
    },
  };
}
