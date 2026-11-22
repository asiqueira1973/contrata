// Rodapé das páginas públicas (8.12; 10.1): privacidade, termos, documentação e o código.
// Recebe nada; devolve o rodapé. Copy de copy.rodapePublico.
import Link from "next/link";
import { URL_CODIGO, copy } from "@/lib/copy";
import s from "./public.module.css";

export function SiteFooter() {
  const c = copy.rodapePublico;
  return (
    <footer className={s.footer}>
      <div className={s.footerInner}>
        <span>{c.feito}</span>
        <nav className={s.footerLinks} aria-label={c.navegacao}>
          <Link href="/docs/mcp">{c.docsMcp}</Link>
          <Link href="/docs/api">{c.docsApi}</Link>
          <Link href="/docs/auto-hospedagem">{c.hospedar}</Link>
          <Link href="/privacidade">{c.privacidade}</Link>
          <Link href="/termos">{c.termos}</Link>
          <a href={URL_CODIGO} rel="noopener">{c.codigo}</a>
        </nav>
      </div>
    </footer>
  );
}
