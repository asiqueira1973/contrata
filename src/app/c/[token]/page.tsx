// [Público] Acompanhamento — /c/{token} (8.4; 6.2, 10.1, 11.13, 11.21, 15.1, 16). Empresa, vaga,
// data, situação em letra grande na linguagem da 11.21 (sem etapas internas), linha do tempo de
// três pontos, mensagens recebidas, banco de talentos e as ações do titular. Link que não vale:
// "Link não encontrado" com "Perdi o link". noindex e no-referrer (next.config, seção 17).
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import { copy } from "@/lib/copy";
import s from "@/features/candidate/candidate.module.css";
import { TalentActions } from "@/features/candidate/talent-actions";
import { TrackingActions } from "@/features/candidate/tracking-actions";
import { mensagensRecebidas, requireCandidaturaPorToken, situacaoParaCandidato } from "@/server/recruiting/applications";

const c = copy.acompanhamento;
export const instant = false;
export const metadata: Metadata = { title: c.tituloPagina, robots: { index: false, follow: false }, referrer: "no-referrer" };

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" });

async function Corpo({ params }: { params: PageProps<"/c/[token]">["params"] }) {
  const { token } = await params;
  const cand = await requireCandidaturaPorToken(token);
  if (!cand) {
    return (
      <main className={s.page}>
        <h1 className={s.title}>{c.tituloPagina}</h1>
        <div className={s.cartao}>
          <p style={{ margin: 0 }}>{c.linkInvalido}</p>
          <Link className={s.link} href="/c">{c.perdiLink}</Link>
        </div>
      </main>
    );
  }
  const chave = situacaoParaCandidato(cand.situacao, cand.etapa_tipo);
  const mensagens = await mensagensRecebidas(cand.id);
  const estilo = cand.empresa.cor_destaque ? ({ "--destaque": cand.empresa.cor_destaque } as CSSProperties) : undefined;
  const final = chave === "aprovada" ? c.linhaDoTempo.aprovada : c.linhaDoTempo.encerrada;
  const passo = cand.situacao === "ativa" ? (chave === "analise" ? 1 : 2) : 3;
  return (
    <main className={s.page} style={estilo}>
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p className={s.empresa}>{cand.empresa.nome}</p>
        <h1 className={s.title}>{c.titulo(cand.vaga.titulo)}</h1>
        <p className={s.lead}>{c.enviadaEm(data(cand.recebida_em))}</p>
      </header>
      <section className={s.cartao} aria-labelledby="situacao">
        <p id="situacao" className={s.situacao}>{c.situacao[chave]}</p>
        <ol className={s.linha}>
          <li data-feito={passo >= 1}>{c.linhaDoTempo.recebida}</li>
          <li data-feito={passo >= 2}>{c.linhaDoTempo.andamento}</li>
          <li data-feito={passo >= 3}>{final}</li>
        </ol>
        <p style={{ margin: 0, lineHeight: 1.5 }}>{c.explicacao[chave](cand.empresa.nome)}</p>
      </section>
      <TalentActions token={token} empresa={cand.empresa.nome} meses={cand.empresa.talentos_meses} ate={cand.candidato.talentos_expira_em} />
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-labelledby="mensagens">
        <h2 id="mensagens" className={s.secao}>{c.mensagens}</h2>
        {mensagens.length ? mensagens.map((m) => (
          <article key={m.data} className={s.mensagem}>
            <span className={s.mensagemData}>{data(m.data)}</span>
            <strong>{m.assunto}</strong>
            <p>{m.corpo}</p>
          </article>
        )) : <p className={s.dica}>{c.semMensagens}</p>}
      </section>
      <TrackingActions token={token} ativa={cand.situacao === "ativa"} vaga={cand.vaga.titulo} empresa={cand.empresa.nome}
        revisao={revisao(cand)} />
      <p className={s.rodape}>{copy.carreiras.rodape}</p>
    </main>
  );
}

// Pedir revisão (11.13): reprovada ou encerrada com a vaga, ainda não expurgada; uma vez só.
function revisao(c: { situacao: string; revisao_pedida_em: string | null; expurgar_em: string | null }): "pode" | "pedida" | null {
  if (c.situacao !== "reprovada" && c.situacao !== "encerrada_vaga") return null;
  if (c.revisao_pedida_em) return "pedida";
  return !c.expurgar_em || new Date(c.expurgar_em) > new Date() ? "pode" : null;
}

export default function AcompanhamentoPage({ params }: PageProps<"/c/[token]">) {
  return (
    <Suspense fallback={<main className={s.page} aria-busy="true" />}>
      <Corpo params={params} />
    </Suspense>
  );
}
