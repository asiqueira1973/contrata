// Layout do site institucional (8.12, refeito em 23/11/2026; spec 16, v0.4.15): fontes (Geist nos
// títulos, Inter no texto, Geist Mono nos nomes de ferramenta e no endereço do conector),
// cabeçalho com as seções e o rodapé com quem opera a instância (OPERADOR_NOME, nunca escrito à mão).
// Recebe: a página. Devolve: a página.
import { Geist, Geist_Mono, Inter } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { URL_CODIGO, copy } from "@/lib/copy";
import s from "@/features/public/site.module.css";
import { operador } from "@/server/org/operador";

const geist = Geist({ subsets: ["latin"], variable: "--font-display" });
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export default function SiteLayout({ children }: { children: ReactNode }) {
  const r = copy.rodapePublico;
  const op = operador().nome;
  return (
    <div className={`${s.site} ${geist.variable} ${inter.variable} ${mono.variable}`}>
      <header className={s.header}>
        <div className={`${s.wrap} ${s.headerInner}`}>
          <Link href="/" className={s.marca}>{r.produto}</Link>
          <nav className={s.nav} aria-label={r.secoes}>
            <Link href="/#como-funciona">{r.comoFunciona}</Link>
            <Link href="/#candidato">{r.candidato}</Link>
            <Link href="/#perguntas">{r.perguntas}</Link>
            <Link href="/docs/mcp" className={s.navCta}>{r.conectar}</Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className={s.rodape}>
        <div className={`${s.wrap} ${s.rodapeGrid}`}>
          <div>
            <p className={s.rodapeProduto}>{r.produto}</p>
            <p className={s.rodapeFrase}>{r.frase}</p>
            {op && <p className={s.rodapeFrase}>{r.operadoPor(op)}</p>}
          </div>
          <nav className={s.rodapeLinks} aria-label={r.navegacao}>
            <Link href="/docs/mcp">{r.docsMcp}</Link>
            <Link href="/docs/api">{r.docsApi}</Link>
            <Link href="/docs/auto-hospedagem">{r.hospedar}</Link>
            <Link href="/privacidade">{r.privacidade}</Link>
            <Link href="/termos">{r.termos}</Link>
            <a href={URL_CODIGO} rel="noopener">{r.codigo}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
