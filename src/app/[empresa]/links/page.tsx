// [Público] /{empresa}/links — "Perdi o link" da empresa (6.2, 15.1). Só com a página publicada.
// noindex.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { copy } from "@/lib/copy";
import s from "@/features/candidate/candidate.module.css";
import { LinksForm } from "@/features/candidate/links-form";
import { empresaEmCache } from "../dados";

export const instant = false;
export const metadata: Metadata = { title: copy.perdiLink.titulo, robots: { index: false, follow: false } };

export async function generateStaticParams() {
  return [{ empresa: "padaria-exemplo" }];
}

export default async function PerdiOLinkEmpresaPage({ params }: PageProps<"/[empresa]/links">) {
  const empresa = await empresaEmCache((await params).empresa);
  if (!empresa?.pagina_publicada) notFound();
  const estilo = empresa.cor_destaque ? ({ "--destaque": empresa.cor_destaque } as CSSProperties) : undefined;
  return (
    <main className={s.page} style={estilo}>
      <Link className={s.link} href={`/${empresa.slug}`}>{empresa.nome}</Link>
      <h1 className={s.title}>{copy.perdiLink.titulo}</h1>
      <p className={s.lead}>{copy.perdiLink.textoEmpresa(empresa.nome)}</p>
      <LinksForm empresaSlug={empresa.slug} />
    </main>
  );
}
