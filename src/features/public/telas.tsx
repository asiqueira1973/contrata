// Telas do produto recriadas em HTML para o site institucional (8.12, refeito em 23/11/2026): a
// conversa com o conector, o formulário da vaga, a comparação com os requisitos, o formulário de
// decisões, o e-mail da devolutiva e a página do candidato. Dados fictícios de copy.telas (nenhum
// dado real); são ilustração, não interagem. Recebe nada; devolve cada tela.
import { copy } from "@/lib/copy";
import s from "./site.module.css";

const c = copy.inicio.conversa;
const t = copy.telas;

// A conversa da abertura: pedido, ferramentas chamadas com o tempo, resposta e o formulário.
export function Conversa() {
  return (
    <figure className={s.conversa} aria-label={c.rotulo}>
      <div className={s.conversaTopo}><span>{c.topoEsquerda}</span><span>{c.topoDireita}</span></div>
      <div className={s.conversaCorpo}>
        <p className={s.balao}>{c.pedido}</p>
        <div className={s.consulta}>
          <strong>{c.consultando}</strong>
          {c.ferramentas.map((f) => (
            <div key={f.nome} className={s.consultaLinha}>
              <span className={s.mono}>{f.nome}</span>
              <span className={s.detalhe}>{f.detalhe}</span>
              <span className={`${s.feito} ${s.num}`}>✓ {f.tempo}</span>
            </div>
          ))}
        </div>
        <p className={s.resposta}>{c.resposta}</p>
        <div className={s.tela}>
          <p className={s.telaTitulo}>{c.formulario}</p>
          {c.itens.map((i) => (
            <div key={i.nome} className={s.telaLinha}><span>{i.nome}</span><span>{i.motivo}</span></div>
          ))}
          <p className={s.telaTexto}>{c.devolutiva}</p>
          <div className={s.telaRodape}>
            <span className={s.telaBotao} aria-hidden="true">{c.botao}</span>
            <span className={s.telaNota}>{c.nota}</span>
          </div>
        </div>
      </div>
    </figure>
  );
}

// Formulário da vaga, como aparece no chat.
export function TelaVaga() {
  return (
    <div className={s.tela}>
      <p className={s.telaTitulo}>{t.vaga.titulo}</p>
      {t.vaga.campos.map((f) => (
        <div key={f.rotulo} className={s.telaLinha}><span>{f.rotulo}</span><span>{f.valor}</span></div>
      ))}
      <p className={s.telaAviso}>{t.vaga.etapas}</p>
      <div className={s.telaRodape}><span /><span className={s.telaBotao} aria-hidden="true">{t.vaga.botao}</span></div>
    </div>
  );
}

// Comparação do currículo com os requisitos (sem nota nem ranking).
export function TelaResumo() {
  return (
    <div className={s.tela}>
      <p className={s.telaTitulo}>{t.resumo.titulo}</p>
      <table className={s.tabela}>
        <tbody>
          {t.resumo.linhas.map((l) => (
            <tr key={l.requisito}><td>{l.requisito}</td><td>✓ {l.situacao}</td><td>{l.onde}</td></tr>
          ))}
        </tbody>
      </table>
      <p className={s.telaAviso}>{t.resumo.nota}</p>
    </div>
  );
}

// Formulário de decisões com contratar e encerrar a vaga juntos.
export function TelaDecisoes() {
  return (
    <div className={s.tela}>
      <p className={s.telaTitulo}>{t.decisoes.titulo}</p>
      <div className={s.telaItem}>
        <p className={s.telaItemTitulo}>{t.decisoes.contratar}</p>
        <p className={s.telaTexto}>{t.decisoes.mensagem}</p>
      </div>
      <div className={s.telaItem}>
        <p className={s.telaItemTitulo}>{t.decisoes.encerrar}</p>
        <p className={s.telaAviso}>{t.decisoes.aviso}</p>
      </div>
      <div className={s.telaRodape}><span /><span className={s.telaBotao} aria-hidden="true">{t.decisoes.botao}</span></div>
    </div>
  );
}

// O e-mail da devolutiva que o candidato recebe.
export function EmailDevolutiva() {
  return (
    <div className={s.email}>
      <div className={s.emailTopo}><strong>{t.email.de}</strong>{t.email.assunto}</div>
      <div className={s.emailCorpo}>
        <h4>{t.email.assunto}</h4>
        {t.email.corpo.map((p) => <p key={p}>{p}</p>)}
        <span className={s.emailBotao} aria-hidden="true">{t.email.botao}</span>
        <p className={s.emailRodape}>{t.email.rodape}</p>
      </div>
    </div>
  );
}

// A página de acompanhamento do candidato (/c).
export function TelaAcompanhamento() {
  return (
    <div className={s.tela}>
      <p className={s.telaNota}>{t.empresa}</p>
      <p className={s.telaTitulo}>{t.acompanhamento.titulo} · {t.acompanhamento.situacao}</p>
      {t.acompanhamento.linha.map((l) => <div key={l} className={s.telaLinha}><span>{l}</span><span /></div>)}
      <div className={s.telaRodape}>
        {t.acompanhamento.acoes.map((a) => <span key={a} className={s.telaNota}>{a}</span>)}
      </div>
    </div>
  );
}
