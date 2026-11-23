// [Público] Página inicial (8.12, refeita em 23/11/2026 no jeito editorial do Fechou Por Quanto;
// seção 10.1 e 16): o recrutamento inteiro dentro da IA (Claude, ChatGPT, Grok), sem painel. Abertura
// com a conversa recriada, o problema, no que acreditamos, como funciona, uma vaga do começo ao
// fim, o candidato, pedidos para copiar, para quem e o que não faz, como conectar, integrações e
// perguntas frequentes. Fotos documentais em public/site (prompts em docs/referencias/fotos-site.md).
// Indexável (seção 17).
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { copy } from "@/lib/copy";
import { Copiar } from "@/features/public/copiar";
import { Conversa, EmailDevolutiva, TelaAcompanhamento, TelaDecisoes, TelaResumo, TelaVaga } from "@/features/public/telas";
import s from "@/features/public/site.module.css";
import { mcpResource } from "@/server/oauth/server";

export const metadata: Metadata = {
  title: { absolute: copy.inicio.metaTitulo },
  description: copy.inicio.metaDescricao,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: { title: copy.inicio.metaTitulo, description: copy.inicio.metaDescricao, type: "website", images: ["/site/padaria.webp"] },
};

const LARGA = "(max-width: 1120px) 100vw, 1120px";
const MEIA = "(max-width: 860px) 100vw, 540px";

export default function InicioPage() {
  const c = copy.inicio;
  const url = mcpResource();
  const telas = [<TelaVaga key="v" />, <TelaResumo key="r" />, <TelaDecisoes key="d" />, <EmailDevolutiva key="e" />];
  return (
    <main>
      <section className={s.hero}>
        <div className={`${s.wrap} ${s.heroGrid}`}>
          <div>
            <p className={s.kicker}>{c.kicker}</p>
            <h1 className={`${s.display} ${s.heroTitulo}`}>{c.titulo.map((l) => <span key={l}>{l}</span>)}</h1>
            <p className={s.heroSub}>{c.subtitulo}</p>
            <div className={s.acoes}>
              <Link className={s.botao} href="/docs/mcp">{c.conectar}</Link>
              <Link className={s.botaoSec} href="/docs/auto-hospedagem">{c.hospedar}</Link>
            </div>
            <p className={s.assistentes}>{c.assistentes}</p>
            <ul className={s.numeros}>{c.numeros.map((n) => <li key={n} className={s.num}>{n}</li>)}</ul>
          </div>
          <Conversa />
        </div>
        <div className={s.wrap}>
          <figure className={s.foto}>
            <Image src="/site/padaria.webp" alt={c.fotoAbertura} width={1800} height={1020} sizes={LARGA} priority />
          </figure>
        </div>
      </section>

      <section className={s.secao}>
        <div className={s.wrap}>
          <p className={s.rotulo}>{c.problema.rotulo}</p>
          <h2 className={`${s.display} ${s.titulo}`}>{c.problema.titulo}</h2>
          <div className={s.colunas3}>
            {c.problema.colunas.map((x) => (
              <div key={x.titulo} className={s.item}><h3 className={s.display}>{x.titulo}</h3><p>{x.texto}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${s.secao} ${s.secaoAlt}`}>
        <div className={`${s.wrap} ${s.manifesto}`}>
          <p className={s.rotulo}>{c.acreditamos.rotulo}</p>
          <h2 className={`${s.display} ${s.titulo}`}>{c.acreditamos.titulo}</h2>
          {c.acreditamos.paragrafos.map((p) => <p key={p}>{p}</p>)}
        </div>
      </section>

      <section className={s.secao} id="como-funciona">
        <div className={s.wrap}>
          <p className={s.rotulo}>{c.comoFunciona.rotulo}</p>
          <h2 className={`${s.display} ${s.titulo}`}>{c.comoFunciona.titulo}</h2>
          <div className={s.colunas3}>
            {c.comoFunciona.passos.map((x, i) => (
              <div key={x.titulo} className={s.item}>
                <span className={s.passoNum}>{String(i + 1).padStart(2, "0")}</span>
                <h3 className={s.display}>{x.titulo}</h3>
                <p>{x.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${s.secao} ${s.secaoAlt}`}>
        <div className={s.wrap}>
          <p className={s.rotulo}>{c.fluxo.rotulo}</p>
          <h2 className={`${s.display} ${s.titulo}`}>{c.fluxo.titulo}</h2>
          <p className={s.lead}>{c.fluxo.lead}</p>
          <div className={s.etapas}>
            {c.fluxo.etapas.map((e, i) => (
              <div key={e} className={s.etapa}>
                <p className={s.etapaRotulo}><b>{String(i + 1).padStart(2, "0")}</b>{e}</p>
                {telas[i]}
              </div>
            ))}
          </div>
          <figure className={s.fotoLarga}>
            <Image src="/site/escritorio.webp" alt={c.fluxo.fotoAlt} width={1800} height={1020} sizes={LARGA} />
          </figure>
        </div>
      </section>

      <section className={s.secao} id="candidato">
        <div className={`${s.wrap} ${s.duas}`}>
          <Image src="/site/cadeira.webp" alt={c.candidato.fotoAlt} width={1200} height={1600} sizes={MEIA} />
          <div>
            <p className={s.rotulo}>{c.candidato.rotulo}</p>
            <h2 className={`${s.display} ${s.titulo}`}>{c.candidato.titulo}</h2>
            <ul className={s.lista}>{c.candidato.itens.map((x) => <li key={x}>{x}</li>)}</ul>
            <div className={s.blocoTela}><TelaAcompanhamento /></div>
          </div>
        </div>
      </section>

      <section className={`${s.secao} ${s.secaoAlt}`} id="perguntas">
        <div className={s.wrap}>
          <p className={s.rotulo}>{c.pecaAssim.rotulo}</p>
          <h2 className={`${s.display} ${s.titulo}`}>{c.pecaAssim.titulo}</h2>
          <p className={s.lead}>{c.pecaAssim.lead}</p>
          <div className={s.grupos}>
            {c.pecaAssim.grupos.map((g) => (
              <div key={g.titulo} className={s.grupo}>
                <h3>{g.titulo}</h3>
                {g.perguntas.map((p) => (
                  <div key={p} className={s.pergunta}>
                    <p>{p}</p>
                    <Copiar texto={p} rotulo={c.pecaAssim.copiar} copiado={c.pecaAssim.copiado} className={s.copiar} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={s.secao}>
        <div className={`${s.wrap} ${s.listas}`}>
          <div><h3>{c.paraQuem.titulo}</h3><ul className={s.lista}>{c.paraQuem.itens.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div><h3>{c.naoFaz.titulo}</h3><ul className={s.lista}>{c.naoFaz.itens.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </div>
      </section>

      <section className={`${s.secao} ${s.secaoAlt}`} id="conectar">
        <div className={s.wrap}>
          <p className={s.rotulo}>{c.conectar2.rotulo}</p>
          <h2 className={`${s.display} ${s.titulo}`}>{c.conectar2.titulo}</h2>
          <div className={s.endereco}>
            <code>{url}</code>
            <Copiar texto={url} rotulo={c.conectar2.copiar} copiado={c.conectar2.copiado} />
          </div>
          <ol className={s.passos}>{c.conectar2.passos.map((p) => <li key={p}><span>{p}</span></li>)}</ol>
          <Link className={s.linkSeta} href="/docs/mcp">{c.conectar2.link} →</Link>
          <figure className={s.fotoLarga}>
            <Image src="/site/loja.webp" alt={c.conectar2.fotoAlt} width={1800} height={1020} sizes={LARGA} />
          </figure>
        </div>
      </section>

      <section className={s.secao}>
        <div className={s.wrap}>
          <p className={s.rotulo}>{c.integracoes.rotulo}</p>
          <h2 className={`${s.display} ${s.titulo}`}>{c.integracoes.titulo}</h2>
          <div className={s.colunas3}>
            {c.integracoes.colunas.map((x) => (
              <div key={x.titulo} className={s.item}><h3 className={s.display}>{x.titulo}</h3><p>{x.texto}</p></div>
            ))}
          </div>
          <div className={s.linksLinha}>
            <Link className={s.linkSeta} href="/docs/api">{c.integracoes.links.api} →</Link>
            <Link className={s.linkSeta} href="/docs/auto-hospedagem">{c.integracoes.links.hospedar} →</Link>
          </div>
          <figure className={s.fotoLarga}>
            <Image src="/site/oficina.webp" alt={c.integracoes.fotoAlt} width={1800} height={1020} sizes={LARGA} />
          </figure>
        </div>
      </section>

      <section className={`${s.secao} ${s.secaoAlt}`}>
        <div className={s.wrap}>
          <p className={s.rotulo}>{c.faq.rotulo}</p>
          <div className={s.faq}>
            {c.faq.itens.map((x) => (
              <details key={x.p}><summary>{x.p}</summary><p>{x.r}</p></details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
