import { randomUUID } from "node:crypto";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { UploadAssinatura } from "@/operacao/aprovacao-presencial";
import { clientePrivado } from "./clientes";

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

/**
 * Teto do AWS SigV4: presigned URLs não podem expirar a mais de 7 dias.
 * A persistência é do objeto no R2 (não expira) — acesso prolongado
 * re-assina a mesma chave sob demanda. Expiração é decisão deste módulo;
 * caller não passa expiry.
 */
const DURACAO_URL_LEITURA_SEGUNDOS = 7 * 24 * 60 * 60;

/** Chave do objeto no R2: `os/{id}/{antes|depois}/{uuid}.jpg`. */
export function montarChaveFotoOs(osId: string, tipo: TipoFotoOs): string {
  return `os/${osId}/${tipo.toLowerCase()}/${randomUUID()}.jpg`;
}

/** Chave da assinatura no R2: `assinaturas/os/{id}/{uuid}.png`. */
function montarChaveAssinaturaOs(osId: string): string {
  return `assinaturas/os/${osId}/${randomUUID()}.png`;
}

/** Chave da foto de checklist no R2: `os/{id}/checklist/{itemId}/{uuid}.jpg`. */
function montarChaveFotoChecklist(osId: string, itemId: string): string {
  return `os/${osId}/checklist/${itemId}/${randomUUID()}.jpg`;
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

function corpoDeDataUrl(dataUrl: string, rotulo: string): Buffer {
  const virgula = dataUrl.indexOf(",");
  if (virgula < 0) throw new Error(`data URL de ${rotulo} inválido`);
  return Buffer.from(dataUrl.slice(virgula + 1), "base64");
}

export interface UploadFotoOs {
  enviarFoto(input: {
    osId: string;
    tipo: TipoFotoOs;
    dataUrl: string;
  }): Promise<{ url: string }>;
}

/** Foto de execução da OS (antes/depois), enviada server-side pelo sync. */
export function uploadFotoOsR2(): UploadFotoOs {
  return {
    async enviarFoto({ osId, tipo, dataUrl }) {
      const corpo = corpoDeDataUrl(dataUrl, "foto");
      const key = montarChaveFotoOs(osId, tipo);
      const { client, bucket } = clientePrivado();
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

/** Foto de item de checklist preventivo. */
export function uploadFotoChecklistR2(): UploadFotoChecklist {
  return {
    async enviar({ osId, itemId, dataUrl }) {
      const corpo = corpoDeDataUrl(dataUrl, "foto");
      const key = montarChaveFotoChecklist(osId, itemId);
      const { client, bucket } = clientePrivado();
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
      const corpo = corpoDeDataUrl(dataUrl, "assinatura");
      const key = montarChaveAssinaturaOs(osId);
      const { client, bucket } = clientePrivado();
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

/** Presigned PUTs das fotos do formulário público e da execução da OS. */
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
      const { client, bucket } = clientePrivado();
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
      const { client, bucket } = clientePrivado();
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

/** Persiste um PDF no bucket privado (chave do catálogo de documentos). */
export async function enviarPdfDocumento(key: string, corpo: Buffer): Promise<void> {
  const { client, bucket } = clientePrivado();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: corpo,
      ContentType: "application/pdf",
    }),
  );
}

export type TipoPdfOs = "orcamento" | "conclusao";

/**
 * PDF transacional de uma OS (orçamento/relatório de conclusão anexado ao
 * e-mail): persiste com chave própria do módulo e devolve a URL de leitura.
 */
export async function salvarPdfOs(
  tipo: TipoPdfOs,
  osId: string,
  corpo: Buffer,
): Promise<{ chave: string; url: string }> {
  const prefixo = tipo === "orcamento" ? "orcamentos" : "conclusoes";
  const chave = `${prefixo}/os-${osId}-${Date.now()}.pdf`;
  await enviarPdfDocumento(chave, corpo);
  return { chave, url: await obterUrlLeituraAssinada(chave) };
}

/** URL de leitura de um objeto privado; expiração é decisão do módulo (7d). */
export async function obterUrlLeituraAssinada(key: string): Promise<string> {
  const { client, bucket } = clientePrivado();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, {
    expiresIn: DURACAO_URL_LEITURA_SEGUNDOS,
  });
}

/** Chaves das fotos de execução de uma OS (antes/depois). */
export async function listarFotosOs(osId: string, tipo: TipoFotoOs): Promise<string[]> {
  try {
    const { client, bucket } = clientePrivado();
    const prefix = `os/${osId}/${tipo.toLowerCase()}/`;
    const command = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix });
    const res = await client.send(command);
    return res.Contents?.map((c) => c.Key).filter((k): k is string => !!k) ?? [];
  } catch (e) {
    console.error(`Erro ao listar fotos do R2 para OS ${osId}:`, e);
    return [];
  }
}

/** Foto anexada a um chamado de garantia da OS. */
export async function uploadFotoGarantia(dataUrl: string, osId: string): Promise<string> {
  const corpo = corpoDeDataUrl(dataUrl, "foto");
  const key = `chamados/os-${osId}/${randomUUID()}.jpg`;
  const { client, bucket } = clientePrivado();
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
