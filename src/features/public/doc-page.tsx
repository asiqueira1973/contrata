// Página de texto do site institucional (8.12): documentação e textos legais, no visual editorial
// (cabeçalho e rodapé vêm do layout de (publico)). Recebe título, introdução, data e aviso
// opcionais e as seções (parágrafos, lista e um trecho de código); todo texto vem de copy.ts.
import s from "./site.module.css";

export type SecaoDoc = {
  titulo: string;
  paragrafos?: readonly string[];
  lista?: readonly string[];
  codigo?: string;
};

export function DocPage(props: { titulo: string; intro?: string; atualizado?: string; aviso?: string; secoes: readonly SecaoDoc[] }) {
  return (
    <main className={s.doc}>
      <article className={`${s.wrap} ${s.docColuna}`}>
        {props.atualizado && <p className={s.docData}>{props.atualizado}</p>}
        <h1 className={`${s.display} ${s.docTitulo}`}>{props.titulo}</h1>
        {props.intro && <p className={s.docIntro}>{props.intro}</p>}
        {props.aviso && <p className={s.docAviso}>{props.aviso}</p>}
        {props.secoes.map((x) => (
          <section key={x.titulo} className={s.docSecao}>
            <h2 className={s.display}>{x.titulo}</h2>
            {x.paragrafos?.map((p, i) => <p key={i}>{p}</p>)}
            {x.codigo && <pre className={s.codigo}><code>{x.codigo}</code></pre>}
            {x.lista && <ul>{x.lista.map((l) => <li key={l}>{l}</li>)}</ul>}
          </section>
        ))}
      </article>
    </main>
  );
}
