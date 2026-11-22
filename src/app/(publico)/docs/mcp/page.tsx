// [Público] Como conectar (8.12; 10.1): passo a passo no Claude, no ChatGPT e no Claude Code, com o
// endereço do conector desta instância, os escopos, os papéis e exemplos de pedidos. Indexável.
import type { Metadata } from "next";
import { NOME_PRODUTO, copy } from "@/lib/copy";
import { DocPage } from "@/features/public/doc-page";
import { mcpResource } from "@/server/oauth/server";

const c = copy.docs.mcp;
export const metadata: Metadata = {
  title: `${c.titulo} — ${NOME_PRODUTO}`,
  description: c.meta,
  alternates: { canonical: "/docs/mcp" },
  robots: { index: true, follow: true },
};

export default function DocsMcpPage() {
  const url = mcpResource();
  return <DocPage titulo={c.titulo} intro={c.intro(url)} secoes={c.secoes(url)} />;
}
