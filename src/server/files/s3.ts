// Driver S3 do ArquivoStorage (seção 4): qualquer API compatível com S3, R2 por padrão. URLs
// pré-assinadas (assinatura v4, calculada localmente) para upload e download diretos do navegador;
// o currículo nunca passa pelo corpo de uma função (limite de ~4,5 MB na Vercel). Como no Assina.
import "server-only";
import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ArquivoStorage } from "./storage";

export type S3Config = { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string; bucket: string };

export function s3StorageDriver(config: S3Config): ArquivoStorage {
  const client = new S3Client({
    region: config.region,
    forcePathStyle: true,
    endpoint: config.endpoint,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const Bucket = config.bucket;
  return {
    async createUploadUrl(path, contentType, expiresInS) {
      const url = await getSignedUrl(client, new PutObjectCommand({ Bucket, Key: path, ContentType: contentType }), { expiresIn: expiresInS });
      return { url, expiresAt: new Date(Date.now() + expiresInS * 1000) };
    },
    async createDownloadUrl(path, expiresInS, filename) {
      const command = new GetObjectCommand({
        Bucket,
        Key: path,
        ResponseContentDisposition: filename ? `attachment; filename*=UTF-8''${encodeURIComponent(filename)}` : undefined,
      });
      const url = await getSignedUrl(client, command, { expiresIn: expiresInS });
      return { url, expiresAt: new Date(Date.now() + expiresInS * 1000) };
    },
    async read(path, maxBytes) {
      try {
        // Uma leitura só, limitada a maxBytes + 1 (Range): nunca carrega mais que o limite.
        const res = await client.send(new GetObjectCommand({ Bucket, Key: path, Range: `bytes=0-${maxBytes}` }));
        if (!res.Body) return null;
        const bytes = await res.Body.transformToByteArray();
        if (bytes.length > maxBytes) throw new Error("arquivo_grande");
        return bytes;
      } catch (e) {
        if (e instanceof Error && (e.name === "NotFound" || e.name === "NoSuchKey" || e.name === "InvalidRange")) return null;
        throw e;
      }
    },
    async write(path, bytes, contentType) {
      await client.send(new PutObjectCommand({ Bucket, Key: path, Body: bytes, ContentType: contentType }));
    },
    async delete(path) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: path }));
    },
    async deletePrefix(prefix) {
      if (!prefix.endsWith("/") || prefix.length < 3) throw new Error("caminho_invalido");
      for (;;) {
        const list = await client.send(new ListObjectsV2Command({ Bucket, Prefix: prefix, MaxKeys: 1000 }));
        const keys = (list.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
        if (!keys.length) return;
        const res = await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys, Quiet: true } }));
        if (res.Errors?.length) throw new Error("arquivos_nao_apagados");
        if (!list.IsTruncated) return;
      }
    },
  };
}
