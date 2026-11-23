// Telas do produto recriadas em HTML para o site institucional (8.12, refeito em 23/11/2026): a
// conversa com o conector, o formulário da vaga, a comparação com os requisitos, o formulário de
// decisões, o e-mail da devolutiva e a página do candidato. Dados fictícios de copy.telas (nenhum
// dado real); são ilustração, não interagem. O que acontece na IA aparece dentro de uma moldura de
// chat (balão do pedido, "Usou o Vaga Aberta", o formulário com o nome da ferramenta, a resposta e a
// caixa de digitar), sem a marca de nenhuma IA. Recebe nada; devolve cada tela.
import type { ReactNode } from "react";
import { copy } from "@/lib/copy";
import s from "./site.module.css";

const ch = copy.telas.chat;

// Moldura de conversa com a IA: pedido à direita, a ferramenta usada, o formulário (widget) com o
// cabeçalho "Vaga Aberta · ferramenta", a resposta e a caixa de digitar.
function Chat(p: { pedido: string; ferramenta?: string; widget?: ReactNode; resposta?: ReactNode; antes?: ReactNode }) {
  return (
    <div className={s.chat}>
      <div className={s.chatCorpo}>
        <p className={s.chatPedido}>{p.pedido}</p>
        <p className={s.chatUsou}>{ch.usou} ›</p>
        {p.antes}
        {p.widget && (
          <div className={s.widget}>
            <div className={s.widgetTopo}><span className={s.widgetMarca} aria-hidden="true">V</span>{ch.widget} · <span className={s.mono}>{p.ferramenta}</span></div>
            <div className={s.widgetCorpo}>{p.widget}</div>
          </div>
        )}
        {p.resposta && <div className={s.chatResposta}>{p.resposta}</div>}
      </div>
      <div className={s.chatCaixa} aria-hidden="true"><span>{ch.responder}</span><span className={s.chatEnviar}>↑</span></div>
    </div>
  );
}

const c = copy.inicio.conversa;
const t = copy.telas;

// A conversa da abertura: pedido, ferramentas chamadas com o tempo, resposta e o formulário.
export function Conversa() {
  const consulta = (
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
  );
  return (
    <figure className={s.conversa} aria-label={c.rotulo}>
      <Chat
        pedido={c.pedido}
        antes={<>{consulta}<p className={s.chatTexto}>{c.resposta}</p></>}
        ferramenta="abrir_formulario_decisoes"
        widget={
          <>
            <p className={s.telaTitulo}>{c.formulario}</p>
            {c.itens.map((i) => (
              <div key={i.nome} className={s.telaLinha}><span>{i.nome}</span><span>{i.motivo}</span></div>
            ))}
            <p className={s.telaTexto}>{c.devolutiva}</p>
            <div className={s.telaRodape}>
              <span className={s.telaNota}>{c.nota}</span>
              <span className={s.telaBotao} aria-hidden="true">{c.botao}</span>
            </div>
          </>
        }
      />
    </figure>
  );
}

// Formulário da vaga, como aparece no chat.
export function TelaVaga() {
  return (
    <Chat
      pedido={ch.vaga.pedido}
      ferramenta={ch.vaga.ferramenta}
      widget={
        <>
          <p className={s.telaTitulo}>{t.vaga.titulo}</p>
          {t.vaga.campos.map((f) => (
            <div key={f.rotulo} className={s.telaLinha}><span>{f.rotulo}</span><span>{f.valor}</span></div>
          ))}
          <p className={s.telaAviso}>{t.vaga.etapas}</p>
          <div className={s.telaRodape}><span /><span className={s.telaBotao} aria-hidden="true">{t.vaga.botao}</span></div>
        </>
      }
      resposta={ch.vaga.resposta}
    />
  );
}

// Comparação do currículo com os requisitos (sem nota nem ordem de preferência), na resposta da IA.
export function TelaResumo() {
  return (
    <Chat
      pedido={ch.resumo.pedido}
      resposta={
        <>
          <p className={s.chatTexto}>{ch.resumo.resposta}</p>
          <table className={s.tabela}>
            <tbody>
              {t.resumo.linhas.map((l) => (
                <tr key={l.requisito}><td>{l.requisito}</td><td>✓ {l.situacao}</td><td>{l.onde}</td></tr>
              ))}
            </tbody>
          </table>
          <p className={s.telaAviso}>{t.resumo.nota}</p>
        </>
      }
    />
  );
}

// Formulário de decisões com contratar e encerrar a vaga juntos.
export function TelaDecisoes() {
  return (
    <Chat
      pedido={ch.decisoes.pedido}
      ferramenta={ch.decisoes.ferramenta}
      widget={
        <>
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
        </>
      }
      resposta={ch.decisoes.resposta}
    />
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
