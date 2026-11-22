// Janela de chat simulada da página inicial (8.12): um pedido, as ferramentas chamadas, a resposta
// e o formulário de decisões no chat, com o botão de confirmar. Só ilustração em HTML e CSS (sem
// imagem, sem dado real); mostra o princípio 6: o modelo propõe e a pessoa grava. Copy em copy.inicio.chat.
import { copy } from "@/lib/copy";
import s from "./public.module.css";

export function ChatDemo() {
  const c = copy.inicio.chat;
  return (
    <figure className={s.demo} aria-label={c.rotulo}>
      <div className={s.demoBar}>
        <span className={s.dots} aria-hidden="true"><span /><span /><span /></span>
        <strong>{c.janela}</strong>
        <span className={s.conector}>{c.conector}</span>
      </div>
      <div className={s.demoBody}>
        <p className={s.pedido}>{c.pedido}</p>
        <div className={s.ferramentas}>
          <div className={s.ferramentasTitulo}>{c.chamando}</div>
          {c.ferramentas.map((f) => (
            <div key={f.nome} className={s.ferramenta}>
              <code>{f.nome}</code>
              <span className={s.args}>{f.args}</span>
              <span className={`${s.ok} tabular`}>✓ {f.tempo}</span>
            </div>
          ))}
        </div>
        <p className={s.resposta}>{c.resposta}</p>
        <div className={s.form}>
          <div className={s.formTitulo}>{c.formulario}</div>
          {c.itens.map((i) => (
            <div key={i.nome} className={s.item}>
              <span>{i.nome}</span>
              <span>{i.motivo}</span>
            </div>
          ))}
          <p className={s.formNota}>{c.devolutiva}</p>
          <div className={s.formRodape}>
            <span className={s.botaoDecisao} aria-hidden="true">{c.botao}</span>
            <small>{c.nota}</small>
          </div>
        </div>
      </div>
    </figure>
  );
}
