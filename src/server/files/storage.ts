// Armazenamento de arquivos — seções 4 e 18 ("arquivo só por src/server/files/storage.ts"), como
// no Assina. Interface única (ArquivoStorage) com dois drivers:
// - s3: qualquer API compatível com S3 (R2 por padrão), quando as cinco variáveis S3_* existem;
// - local: disco em .armazenamento-local/, só fora de produção (dev e testes).
// Em produção sem S3 o app falha alto, em vez de gravar currículo em disco efêmero.
// Caminhos relativos ao bucket: {empresa}/{candidatura}/curriculo.{pdf|docx} (7.3).
import "server-only";
import { localStorageDriver } from "./local";
import { s3StorageDriver } from "./s3";

export type SignedUrl = { url: string; expiresAt: Date };

export interface ArquivoStorage {
  /** URL para o navegador fazer PUT direto do arquivo (validade em segundos). */
  createUploadUrl(path: string, contentType: string, expiresInS: number): Promise<SignedUrl>;
  /** URL de leitura temporária; com filename, o navegador baixa com esse nome. */
  createDownloadUrl(path: string, expiresInS: number, filename?: string): Promise<SignedUrl>;
  /** Lê no máximo maxBytes numa leitura só; null se não existe. Lança "arquivo_grande" acima. */
  read(path: string, maxBytes: number): Promise<Uint8Array | null>;
  write(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  delete(path: string): Promise<void>;
  /** Apaga tudo sob a pasta (anonimização, faxina). O prefixo termina em "/". */
  deletePrefix(prefix: string): Promise<void>;
}

let cached: ArquivoStorage | null = null;

// Diz se as cinco variáveis do S3 existem (a rota de dev usa a mesma regra para se desligar).
export function isS3Configured(): boolean {
  const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET } = process.env;
  return !!(S3_ENDPOINT && S3_REGION && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY && S3_BUCKET);
}

// Escolhe o driver pelas variáveis de ambiente. Devolve: o driver do processo.
export function storage(): ArquivoStorage {
  if (cached) return cached;
  if (isS3Configured()) {
    const e = process.env as Record<string, string>;
    cached = s3StorageDriver({ endpoint: e.S3_ENDPOINT, region: e.S3_REGION, accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY, bucket: e.S3_BUCKET });
  } else if (process.env.NODE_ENV !== "production") {
    cached = localStorageDriver();
  } else {
    throw new Error("S3 não configurado (S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET)");
  }
  return cached;
}

// Pasta e caminho do currículo de uma candidatura (7.3).
export function pastaDaCandidatura(empresaId: string, candidaturaId: string): string {
  return `${empresaId}/${candidaturaId}/`;
}
export function caminhoDoCurriculo(empresaId: string, candidaturaId: string, extensao: "pdf" | "docx"): string {
  return `${pastaDaCandidatura(empresaId, candidaturaId)}curriculo.${extensao}`;
}
