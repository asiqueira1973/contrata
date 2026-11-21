// [Público] Candidatar-me — /{empresa}/vagas/{slug}/candidatar (8.4; 10.1, 11.2, 15.1, 15.5).
// Formulário numa tela só; o aviso de privacidade padrão mais o texto extra da empresa. noindex
// (seção 17). Vaga que não está publicada: "Esta vaga não recebe mais candidaturas". Exige
// JavaScript (upload direto ao armazenamento), com mensagem clara se estiver desligado.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { copy } from "@/lib/copy";
import { ApplicationForm } from "@/features/candidate/application-form";
import s from "@/features/candidate/candidate.module.css";
import { empresaParaCandidatura, vagaParaFormulario } from "@/server/recruiting/applications";
import { empresaPorSlug } from "@/server/careers/public";

const c = copy.candidatura;
type Props = PageProps<"/[empresa]/vagas/[slug]/candidatar">;

export const instant = false;
export const metadata: Metadata = { robots: { index: false, follow: false } };

export async function generateStaticParams() {
  return [{ empresa: "padaria-exemplo", slug: "atendente-de-padaria" }];
}

async function Corpo({ params }: { params: Props["params"] }) {
  const { empresa: slugEmpresa, slug } = await params;
  const publica = await empresaPorSlug(slugEmpresa);
  const empresa = publica?.pagina_publicada ? await empresaParaCandidatura({ id: publica.id }) : null;
  const vaga = empresa ? await vagaParaFormulario(empresa.id, slug) : null;
  if (!empresa || !vaga || vaga.status === "rascunho") notFound();
  const estilo = empresa.cor_destaque ? ({ "--destaque": empresa.cor_destaque } as CSSProperties) : undefined;
  const voltar = `/${empresa.slug}/vagas/${slug}`;
  return (
    <main className={s.page} style={estilo}>
      <title>{c.tituloPagina(vaga.titulo, empresa.nome)}</title>
      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Link className={s.link} href={voltar}>{empresa.nome}</Link>
        <h1 className={s.title}>{c.titulo(vaga.titulo)}</h1>
        <p className={s.lead}>{c.subtitulo}</p>
      </header>
      {vaga.status !== "publicada" ? (
        <div className={s.cartao} role="status">
          <strong>{copy.carreiras.fechada}</strong>
          <Link className={s.link} href={`/${empresa.slug}`}>{copy.carreiras.verOutras(empresa.nome)}</Link>
        </div>
      ) : (
        <>
          <noscript><p className={s.cartao}>{c.semJs}</p></noscript>
          <ApplicationForm
            empresaSlug={empresa.slug} empresaNome={empresa.nome} vagaSlug={slug} vagaTitulo={vaga.titulo}
            curriculoObrigatorio={vaga.curriculo_obrigatorio} perguntas={vaga.perguntas}
            aviso={copy.avisoPrivacidade(empresa.nome, empresa.email_contato, empresa.retencao_dias)}
            avisoExtra={empresa.aviso_privacidade_extra} talentosMeses={empresa.talentos_meses}
          />
          <Link className={s.link} href={`/${empresa.slug}/links`}>{c.perdiLink}</Link>
        </>
      )}
      <p className={s.rodape}>{copy.carreiras.rodape}</p>
    </main>
  );
}

export default function CandidatarPage({ params }: Props) {
  return (
    <Suspense fallback={<main className={s.page} aria-busy="true" />}>
      <Corpo params={params} />
    </Suspense>
  );
}
