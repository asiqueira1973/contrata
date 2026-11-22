// [Público] Termos (8.12; seção 20): modelo que quem hospeda ajusta. Quem opera e o contato
// vêm de OPERADOR_NOME e OPERADOR_CONTATO (ou ADMIN_EMAIL); sem eles, "quem hospeda esta
// instância". Indexável.
import type { Metadata } from "next";
import { NOME_PRODUTO, copy } from "@/lib/copy";
import { DocPage } from "@/features/public/doc-page";
import { operador } from "@/server/org/operador";

const c = copy.legal.termos;
export const metadata: Metadata = {
  title: `${c.titulo} — ${NOME_PRODUTO}`,
  description: c.meta,
  alternates: { canonical: "/termos" },
  robots: { index: true, follow: true },
};

export default function TermosPage() {
  const op = operador();
  return (
    <DocPage
      titulo={c.titulo}
      atualizado={copy.legal.atualizado}
      aviso={copy.legal.modelo}
      secoes={c.secoes(op.nome, op.contato)}
    />
  );
}
