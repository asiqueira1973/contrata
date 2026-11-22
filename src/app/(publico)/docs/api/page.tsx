// [Público] Guia da API v1 (8.12; 10.1 e 14): chave e escopos, convenções (paginação,
// Idempotency-Key, erros), decisões que viram proposta (202), webhooks assinados, a trilha por
// eventos e a API pública. O detalhe de cada rota fica no OpenAPI. Indexável.
import type { Metadata } from "next";
import { NOME_PRODUTO, copy } from "@/lib/copy";
import { DocPage } from "@/features/public/doc-page";
import { siteOrigin } from "@/server/oauth/server";

const c = copy.docs.api;
export const metadata: Metadata = {
  title: `${c.titulo} — ${NOME_PRODUTO}`,
  description: c.meta,
  alternates: { canonical: "/docs/api" },
  robots: { index: true, follow: true },
};

export default function DocsApiPage() {
  return <DocPage titulo={c.titulo} intro={c.intro} secoes={c.secoes(siteOrigin())} />;
}
