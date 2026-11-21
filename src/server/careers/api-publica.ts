// Formato da API pública de vagas (seção 13.2): só o que a página da vaga mostra, mais o endereço.
// Nada interno (dono, equipe, candidaturas, perguntas com resposta esperada).
import "server-only";
import { siteOrigin } from "@/server/oauth/server";
import type { EmpresaPublica, VagaPublica } from "./public";

// CORS aberto (*) só nas leituras públicas (13.2); cache de 60 s na borda (seção 17).
export const CORS_PUBLICO: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
};

export function vagaDaApiPublica(empresa: EmpresaPublica, v: VagaPublica) {
  return {
    id: v.id, slug: v.slug, titulo: v.titulo, area: v.area, modelo_trabalho: v.modelo_trabalho, cidade: v.cidade, uf: v.uf,
    regime: v.regime, salario: v.salario, descricao: v.descricao, requisitos: v.requisitos, encerra_em: v.encerra_em,
    publicada_em: v.publicada_em, url: `${siteOrigin()}/${empresa.slug}/vagas/${v.slug}`,
  };
}

// CORS do POST público de candidatura (13.2; assunção 24.8): no MVP, qualquer origem https (e o
// próprio site), com os limites da 11.14. Sem credenciais (nada de cookie entre origens).
export function corsDoPost(req: Request): Record<string, string> {
  const origem = req.headers.get("origin");
  const site = siteOrigin();
  const aceita = !!origem && (origem === site || /^https:\/\/[^/]+$/.test(origem));
  return {
    ...(aceita ? { "access-control-allow-origin": origem! } : {}),
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    vary: "Origin",
    "cache-control": "no-store",
  };
}

// Junta os cabeçalhos de CORS numa resposta pronta.
export function comCors(r: Response, cors: Record<string, string>): Response {
  for (const [k, v] of Object.entries(cors)) r.headers.set(k, v);
  return r;
}
