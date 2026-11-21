// [Público] Página da vaga — seções 10.1, 16 e 17; regra 11.20. Publicada: descrição, requisitos,
// local, regime, salário (se mostrar) e o JSON-LD JobPosting. Pausada ou encerrada: 200 com "Esta
// vaga não recebe mais candidaturas" e sem JSON-LD. Rascunho, ou empresa sem página publicada (sem
// pré-visualização válida): 404. Vaga publicada leva o botão "Candidatar-me" (8.4).
import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { copy } from "@/lib/copy";
import s from "@/features/careers/careers.module.css";
import { localDaVaga } from "@/features/careers/format";
import { jobPosting, jsonLdSeguro } from "@/server/careers/jsonld";
import { previaValida } from "@/server/careers/preview";
import type { EmpresaPublica, VagaPublica } from "@/server/careers/public";
import { siteOrigin } from "@/server/oauth/server";
import { empresaEmCache, vagaEmCache } from "../../dados";

const c = copy.carreiras;

// Bloqueia a navegação até o slug ser conhecido: a página sai inteira no HTML (SEO, seção 17) e a
// empresa ou vaga inexistente dá 404 de verdade, antes do streaming.
export const instant = false;
type Props = PageProps<"/[empresa]/vagas/[slug]">;

export async function generateStaticParams() {
  return [{ empresa: "padaria-exemplo", slug: "atendente-de-padaria" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { empresa: slugEmpresa, slug } = await params;
  const e = await empresaEmCache(slugEmpresa);
  const v = e ? await vagaEmCache(e.slug, e.id, slug) : null;
  if (!e?.pagina_publicada || !v) return { robots: { index: false, follow: false } };
  return {
    title: c.tituloVaga(v.titulo, e.nome),
    robots: v.status === "publicada" ? { index: true, follow: true } : { index: false, follow: true },
    alternates: { canonical: `/${e.slug}/vagas/${v.slug}` },
  };
}

function Vaga({ empresa, vaga, previa }: { empresa: EmpresaPublica; vaga: VagaPublica; previa?: string }) {
  const estilo = empresa.cor_destaque ? ({ "--destaque": empresa.cor_destaque } as CSSProperties) : undefined;
  const voltar = `/${empresa.slug}${previa ? `?previa=${encodeURIComponent(previa)}` : ""}`;
  const ld = jobPosting(empresa, vaga, `${siteOrigin()}/${empresa.slug}/vagas/${vaga.slug}`);
  const fatos = [
    { rotulo: c.local, valor: localDaVaga(vaga) },
    { rotulo: c.regimeRotulo, valor: c.regime[vaga.regime] },
    ...(vaga.salario ? [{ rotulo: c.salarioRotulo, valor: c.salario(vaga.salario) }] : []),
    ...(vaga.encerra_em ? [{ rotulo: c.dataLimite, valor: new Date(`${vaga.encerra_em}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" }) }] : []),
  ];
  return (
    <main className={s.page} style={estilo}>
      {previa && <meta name="robots" content="noindex, nofollow" />}
      {previa && <p className={s.previa} role="status">{c.previa}</p>}
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSeguro(ld) }} />}
      <header className={s.header}>
        <Link className={s.link} href={voltar}>{c.voltar(empresa.nome)}</Link>
        <h1 className={s.title}>{vaga.titulo}</h1>
        {vaga.area && <p className={s.empresa}>{vaga.area}</p>}
      </header>
      {vaga.status !== "publicada" && (
        <div className={s.aviso} role="status">
          <strong>{c.fechada}</strong>
          <Link className={s.link} href={voltar}>{c.verOutras(empresa.nome)}</Link>
        </div>
      )}
      {vaga.status === "publicada" && !previa && (
        <Link className={s.botao} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center" }} href={`/${empresa.slug}/vagas/${vaga.slug}/candidatar`}>
          {copy.candidatura.botaoVaga}
        </Link>
      )}
      <dl className={s.fatos}>
        {fatos.map((f) => (
          <div key={f.rotulo} className={s.fato}><dt>{f.rotulo}</dt><dd>{f.valor}</dd></div>
        ))}
      </dl>
      <section aria-labelledby="sobre">
        <h2 id="sobre" className={s.secao}>{c.sobre}</h2>
        {/* HTML já sanitizado (markdownSeguro, 20.3): lista fechada de tags, sem script nem on*. */}
        <div className={s.texto} dangerouslySetInnerHTML={{ __html: vaga.descricao_html }} />
      </section>
      {vaga.requisitos_html && (
        <section aria-labelledby="requisitos">
          <h2 id="requisitos" className={s.secao}>{c.requisitos}</h2>
          <div className={s.texto} dangerouslySetInnerHTML={{ __html: vaga.requisitos_html }} />
        </section>
      )}
      <p className={s.rodape}>{c.rodape}</p>
    </main>
  );
}

async function Previa({ empresa, vaga, searchParams }: { empresa: EmpresaPublica; vaga: VagaPublica; searchParams: Props["searchParams"] }) {
  const sp = await searchParams;
  // A validade do token depende da hora: lê o relógio só na requisição, nunca no prerender.
  await connection();
  const token = typeof sp.previa === "string" ? sp.previa : null;
  if (!previaValida(empresa.id, token)) notFound();
  return <Vaga empresa={empresa} vaga={vaga} previa={token!} />;
}

export default async function VagaPage({ params, searchParams }: Props) {
  const { empresa: slugEmpresa, slug } = await params;
  const empresa = await empresaEmCache(slugEmpresa);
  if (!empresa) notFound();
  const vaga = await vagaEmCache(empresa.slug, empresa.id, slug);
  if (!vaga) notFound();
  if (!empresa.pagina_publicada) {
    return (
      <Suspense fallback={null}>
        <Previa empresa={empresa} vaga={vaga} searchParams={searchParams} />
      </Suspense>
    );
  }
  return <Vaga empresa={empresa} vaga={vaga} />;
}
