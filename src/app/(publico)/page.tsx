// [Público] Página inicial (8.12; seção 10.1): o que é ("o sistema de recrutamento para agentes"),
// a janela de chat que mostra o modelo propondo e a pessoa decidindo, as portas (conector, Claude,
// ChatGPT, API), para quem, o que não faz, e os caminhos "Conecte no Claude ou no ChatGPT" e
// "Como hospedar". Indexável (seção 17). Sem painel: quem recruta usa o chat.
import type { Metadata } from "next";
import Link from "next/link";
import { NOME_PRODUTO, copy } from "@/lib/copy";
import { ChatDemo } from "@/features/public/chat-demo";
import { SiteFooter } from "@/features/public/site-footer";
import s from "@/features/public/public.module.css";

export const metadata: Metadata = {
  title: { absolute: copy.inicio.metaTitulo },
  description: copy.inicio.metaDescricao,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: { title: copy.inicio.metaTitulo, description: copy.inicio.metaDescricao, type: "website" },
};

export default function InicioPage() {
  const c = copy.inicio;
  return (
    <main className={s.page}>
      <header className={s.top}>
        <Link href="/" className={s.brand}>{NOME_PRODUTO}</Link>
        <nav className={s.topLinks} aria-label={copy.rodapePublico.navegacao}>
          <Link href="/docs/mcp">{copy.rodapePublico.docsMcp}</Link>
          <Link href="/docs/api">{copy.rodapePublico.docsApi}</Link>
        </nav>
      </header>

      <section className={s.hero}>
        <span className={s.selo}>{c.selo}</span>
        <h1 className={s.title}>
          {c.titulo} <em>{c.tituloDestaque}</em>
        </h1>
        <p className={s.lead}>{c.subtitulo}</p>
        <div className={s.ctas}>
          <Link className={s.primary} href="/docs/mcp">{c.conectar}</Link>
          <Link className={s.secondary} href="/docs/auto-hospedagem">{c.hospedar}</Link>
        </div>
        <ul className={s.numeros}>
          {c.numeros.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </section>

      <ChatDemo />

      <section className={s.secao}>
        <h2 className={s.secaoTitulo}>{c.cartoes.titulo}</h2>
        <p className={s.secaoLead}>{c.cartoes.subtitulo}</p>
        <div className={s.grade}>
          {c.cartoes.itens.map((x) => (
            <article key={x.titulo} className={s.cartao}>
              <h3>{x.titulo}</h3>
              <p>{x.texto}</p>
              {"ferramentas" in x && (
                <div className={s.chips}>
                  {x.ferramentas.map((f) => <code key={f}>{f}</code>)}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className={s.secao}>
        <h2 className={s.secaoTitulo}>{c.comoFunciona.titulo}</h2>
        <div className={s.grade}>
          {c.comoFunciona.passos.map((p, i) => (
            <article key={p.titulo} className={s.cartao}>
              <div className={s.passo}>{i + 1}</div>
              <h3>{p.titulo}</h3>
              <p>{p.texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={s.secao}>
        <div className={s.duas}>
          <article className={s.cartao}>
            <h3>{c.paraQuem.titulo}</h3>
            <ul className={`${s.lista} ${s.sim}`}>
              {c.paraQuem.itens.map((x) => <li key={x}>{x}</li>)}
            </ul>
          </article>
          <article className={s.cartao}>
            <h3>{c.naoFaz.titulo}</h3>
            <ul className={`${s.lista} ${s.nao}`}>
              {c.naoFaz.itens.map((x) => <li key={x}>{x}</li>)}
            </ul>
          </article>
        </div>
      </section>

      <section className={s.secao}>
        <article className={s.cartao}>
          <h3>{c.candidato.titulo}</h3>
          <p>{c.candidato.texto}</p>
        </article>
      </section>

      <section className={`${s.secao} ${s.final}`}>
        <h2 className={s.secaoTitulo}>{c.final.titulo}</h2>
        <p className={s.secaoLead}>{c.final.texto}</p>
        <div className={s.ctas}>
          <Link className={s.primary} href="/docs/mcp">{c.conectar}</Link>
          <Link className={s.secondary} href="/docs/auto-hospedagem">{c.hospedar}</Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
