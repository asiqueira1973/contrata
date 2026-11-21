// [Público] /c — "Perdi o link" sem empresa (6.2, 15.1): mandamos os links de cada empresa onde o
// e-mail tem candidatura, um e-mail por empresa. noindex.
import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import s from "@/features/candidate/candidate.module.css";
import { LinksForm } from "@/features/candidate/links-form";

export const metadata: Metadata = { title: copy.perdiLink.titulo, robots: { index: false, follow: false } };

export default function PerdiOLinkPage() {
  return (
    <main className={s.page}>
      <h1 className={s.title}>{copy.perdiLink.titulo}</h1>
      <p className={s.lead}>{copy.perdiLink.texto}</p>
      <LinksForm />
    </main>
  );
}
