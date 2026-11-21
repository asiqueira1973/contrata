// Dados da página de carreiras em cache (seção 17: cache de 60 s, revalidado ao editar). A tag
// `carreiras:{slug}` é limpa pelo domínio a cada escrita de vaga ou da página (invalidarPaginas).
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { PAGINA_PUBLICA_CACHE_S } from "@/lib/limits";
import { empresaPorSlug, vagaPublica, vagasPublicadas } from "@/server/careers/public";

const vida = { stale: PAGINA_PUBLICA_CACHE_S, revalidate: PAGINA_PUBLICA_CACHE_S, expire: 3600 };

export async function empresaEmCache(slug: string) {
  "use cache";
  cacheTag(`carreiras:${slug}`);
  cacheLife(vida);
  return empresaPorSlug(slug);
}

export async function vagasEmCache(slug: string, empresaId: string) {
  "use cache";
  cacheTag(`carreiras:${slug}`);
  cacheLife(vida);
  return vagasPublicadas(empresaId);
}

export async function vagaEmCache(slug: string, empresaId: string, vagaSlug: string) {
  "use cache";
  cacheTag(`carreiras:${slug}`);
  cacheLife(vida);
  return vagaPublica(empresaId, vagaSlug);
}
