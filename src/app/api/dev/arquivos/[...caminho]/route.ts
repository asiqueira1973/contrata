// /api/dev/arquivos/{caminho} — par do driver local do ArquivoStorage (dev e testes, como no Assina).
// PUT grava e GET lê, só com a assinatura HMAC válida e dentro da validade (o mesmo contrato das
// URLs pré-assinadas do S3). Em produção, ou com o S3 configurado, responde 404.
import type { NextRequest } from "next/server";
import { CURRICULO_MAX_BYTES } from "@/lib/limits";
import { verifyLocal } from "@/server/files/local";
import { isS3Configured, storage } from "@/server/files/storage";

type Ctx = { params: Promise<{ caminho: string[] }> };

function ligada(): boolean {
  return process.env.NODE_ENV !== "production" && !isS3Configured();
}

async function autorizar(req: NextRequest, ctx: Ctx, op: "put" | "get"): Promise<string | Response> {
  if (!ligada()) return new Response(null, { status: 404 });
  const path = (await ctx.params).caminho.join("/");
  const q = req.nextUrl.searchParams;
  if (q.get("op") !== op || !verifyLocal(op, path, Number(q.get("exp")), q.get("sig") ?? "")) return new Response(null, { status: 403 });
  return path;
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const path = await autorizar(req, ctx, "put");
  if (path instanceof Response) return path;
  const bytes = new Uint8Array(await req.arrayBuffer());
  // Folga acima do limite do produto para o servidor recusar com a mensagem certa ao concluir.
  if (bytes.length > CURRICULO_MAX_BYTES + 1024 * 1024) return new Response(null, { status: 413 });
  await storage().write(path, bytes, req.headers.get("content-type") ?? "application/octet-stream");
  return new Response(null, { status: 200 });
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const path = await autorizar(req, ctx, "get");
  if (path instanceof Response) return path;
  const bytes = await storage().read(path, CURRICULO_MAX_BYTES * 4);
  if (!bytes) return new Response(null, { status: 404 });
  const nome = req.nextUrl.searchParams.get("nome");
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": path.endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
      ...(nome ? { "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nome)}` } : {}),
    },
  });
}
