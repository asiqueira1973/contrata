// GET /api/cron/diario — faxina diária (8.10; regra 11.11), chamada 1×/dia pelo cron da Vercel
// (vercel.json), como no Assina. Exige `Authorization: Bearer CRON_SECRET` (a Vercel manda sozinha
// quando a variável existe), comparado em tempo constante; sem o segredo configurado, ninguém
// passa. Devolve 200 com as contagens · 401 {"codigo":"nao_autorizado"}.
import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { runDailyCleanup } from "@/server/cron";

export const maxDuration = 60;

// Compara pelo SHA-256 dos dois lados (mesmo tamanho), em tempo constante.
function autorizado(req: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || segredo.length < 16) return false;
  const dado = createHash("sha256").update(req.headers.get("authorization") ?? "").digest();
  const esperado = createHash("sha256").update(`Bearer ${segredo}`).digest();
  return timingSafeEqual(dado, esperado);
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ codigo: "nao_autorizado", mensagem: "Não autorizado." }, { status: 401 });
  return Response.json(await runDailyCleanup(), { headers: { "cache-control": "no-store" } });
}
