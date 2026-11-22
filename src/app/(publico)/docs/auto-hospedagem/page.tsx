// [Público] Como hospedar (8.12; 10.1 e 27): o roteiro do README em página (Supabase, R2,
// Resend, Google, Vercel, a primeira empresa e os textos legais). Indexável.
import type { Metadata } from "next";
import { NOME_PRODUTO, copy } from "@/lib/copy";
import { DocPage } from "@/features/public/doc-page";

const c = copy.docs.hospedar;
export const metadata: Metadata = {
  title: `${c.titulo} — ${NOME_PRODUTO}`,
  description: c.meta,
  alternates: { canonical: "/docs/auto-hospedagem" },
  robots: { index: true, follow: true },
};

export default function DocsHospedarPage() {
  return <DocPage titulo={c.titulo} intro={c.intro} secoes={c.secoes} />;
}
