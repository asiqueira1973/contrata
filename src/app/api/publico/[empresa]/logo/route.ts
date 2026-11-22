// GET /api/publico/{empresa}/logo (8.9; seção 20): o logo da empresa (página, e-mails, JSON-LD).
// Empresa ativa (excluída ou suspensa: 404). Os bytes já foram conferidos e, se SVG, limpos ao
// salvar; mesmo assim vai com nosniff e, para SVG, uma CSP que não roda nada. Cache longo: a URL
// muda quando o logo muda (?v= do hash).
import { LOGO_MAX_BYTES } from "@/lib/limits";
import { storage } from "@/server/files/storage";
import { jsonError } from "@/server/http";
import { empresaParaCandidatura } from "@/server/recruiting/applications";

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml" };

export async function GET(_req: Request, { params }: { params: Promise<{ empresa: string }> }) {
  const { empresa: slug } = await params;
  const e = await empresaParaCandidatura({ slug });
  const ext = e?.logo_path ? /\.(png|jpg|svg)$/.exec(e.logo_path)?.[1] : undefined;
  if (!e?.logo_path || !ext) return jsonError("nao_encontrado", 404);
  const bytes = await storage().read(e.logo_path, LOGO_MAX_BYTES);
  if (!bytes) return jsonError("nao_encontrado", 404);
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": MIME[ext],
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "cache-control": "public, max-age=86400, immutable",
      "cross-origin-resource-policy": "cross-origin",
    },
  });
}
