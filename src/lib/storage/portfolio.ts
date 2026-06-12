import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { CopiadorFotoPublica } from "@/marketing/portfolio-repo";
import { clientePrivado, clientePublico } from "./clientes";

/**
 * Copia a foto do R2 privado para o R2 público (aprovação de portfólio).
 * Buckets são contas distintas, então baixamos o objeto e reenviamos (não há
 * copy server-side cross-account).
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
