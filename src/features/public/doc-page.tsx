// Página de texto (8.12; 10.1): documentação e textos legais, no padrão do LegalPage do Assina.
// Recebe título, introdução, data opcional, aviso opcional e as seções (parágrafos, lista e um
// trecho de código); devolve a página com o rodapé público. Todo texto vem de copy.ts.
import Link from "next/link";
import { copy } from "@/lib/copy";
import { SiteFooter } from "./site-footer";
import s from "./public.module.css";

export type SecaoDoc = {
  titulo: string;
  paragrafos?: readonly string[];
  lista?: readonly string[];
  codigo?: string;
};

export function DocPage(props: {
  titulo: string;
  intro?: string;
  atualizado?: string;
  aviso?: string;
  secoes: readonly SecaoDoc[];
}) {
  return (
    <main className={s.page}>
      <article className={s.column}>
        <Link href="/" className={s.brand}>{copy.docs.voltar}</Link>
        <h1 className={s.docTitle}>{props.titulo}</h1>
        {props.atualizado && <p className={s.updated}>{props.atualizado}</p>}
        {props.intro && <p className={s.intro}>{props.intro}</p>}
        {props.aviso && <p className={s.aviso}>{props.aviso}</p>}
        {props.secoes.map((x) => (
          <section key={x.titulo} className={s.section}>
            <h2>{x.titulo}</h2>
            {x.paragrafos?.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {x.codigo && <pre className={s.code}><code>{x.codigo}</code></pre>}
            {x.lista && (
              <ul>
                {x.lista.map((l) => <li key={l}>{l}</li>)}
              </ul>
            )}
          </section>
        ))}
      </article>
      <SiteFooter />
    </main>
  );
}
