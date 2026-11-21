// [Público] Página de carreiras — seções 10.1, 16 e 17; regra 11.20. Só com a página publicada
// (pagina_publicada); antes disso, só com o link de pré-visualização assinado de 10 min, com a
// faixa "Página ainda não publicada" e noindex. Vagas publicadas, filtro por área (nome da área,
// nunca o dono) e por modelo. Dados em cache de 60 s, revalidados a cada edição.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { copy } from "@/lib/copy";
import { MODELOS_TRABALHO } from "@/lib/limits";
import s from "@/features/careers/careers.module.css";
import { previaValida } from "@/server/careers/preview";
import type { EmpresaPublica } from "@/server/careers/public";
import { localDaVaga } from "@/features/careers/format";
import { empresaEmCache, vagasEmCache } from "./dados";

const c = copy.carreiras;

// Bloqueia a navegação até o slug ser conhecido: a página sai inteira no HTML (SEO, seção 17) e a
// empresa ou vaga inexistente dá 404 de verdade, antes do streaming.
export const instant = false;

// Uma amostra: com ela, os outros slugs são renderizados no primeiro acesso e guardados (Cache
// Components), e o slug é conhecido fora do Suspense (404 de verdade para empresa inexistente).
export async function generateStaticParams() {
  return [{ empresa: "padaria-exemplo" }];
}

export async function generateMetadata({ params }: PageProps<"/[empresa]">): Promise<Metadata> {
  const e = await empresaEmCache((await params).empresa);
  // Página não publicada: nada da empresa nos metadados (só a pré-visualização mostra algo).
  if (!e?.pagina_publicada) return { robots: { index: false, follow: false } };
  return {
    title: c.tituloPagina(e.nome),
    description: e.descricao ?? undefined,
    robots: { index: true, follow: true },
    alternates: { canonical: `/${e.slug}` },
  };
}

async function Vagas({ empresa, searchParams }: { empresa: EmpresaPublica; searchParams: PageProps<"/[empresa]">["searchParams"] }) {
  const sp = await searchParams;
  const area = typeof sp.area === "string" ? sp.area : "";
  const modelo = typeof sp.modelo === "string" ? sp.modelo : "";
  const todas = await vagasEmCache(empresa.slug, empresa.id);
  const areas = [...new Set(todas.map((v) => v.area ?? c.semArea))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const vagas = todas.filter((v) => (!area || (v.area ?? c.semArea) === area) && (!modelo || v.modelo_trabalho === modelo));
  return (
    <>
      {todas.length > 0 && (
        <form className={s.filtros} method="get">
          <label className={s.filtro}>
            {c.filtroArea}
            <select name="area" defaultValue={area}>
              <option value="">{c.todas}</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className={s.filtro}>
            {c.filtroModelo}
            <select name="modelo" defaultValue={modelo}>
              <option value="">{c.todos}</option>
              {MODELOS_TRABALHO.map((m) => <option key={m} value={m}>{c.modelo[m]}</option>)}
            </select>
          </label>
          {typeof sp.previa === "string" && <input type="hidden" name="previa" value={sp.previa} />}
          <button className={s.botao} type="submit">{c.filtrar}</button>
        </form>
      )}
      {vagas.length ? (
        <ul className={s.lista}>
          {vagas.map((v) => (
            <li key={v.id}>
              <Link className={s.item} href={`/${empresa.slug}/vagas/${v.slug}${typeof sp.previa === "string" ? `?previa=${encodeURIComponent(sp.previa)}` : ""}`}>
                <p className={s.itemTitulo}>{v.titulo}</p>
                <p className={s.itemMeta}>{[v.area, localDaVaga(v), c.regime[v.regime]].filter(Boolean).join(" · ")}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.vazio}>{todas.length ? c.nenhumaNoFiltro : c.nenhumaVaga}</p>
      )}
    </>
  );
}

const esqueleto = <ul className={s.lista}>{[0, 1, 2].map((i) => <li key={i} className={s.esqueleto} />)}</ul>;

function Pagina({ empresa, previa, children }: { empresa: EmpresaPublica; previa?: boolean; children: React.ReactNode }) {
  const estilo = empresa.cor_destaque ? ({ "--destaque": empresa.cor_destaque } as CSSProperties) : undefined;
  return (
    <main className={s.page} style={estilo}>
      {previa && <meta name="robots" content="noindex, nofollow" />}
      {previa && <p className={s.previa} role="status">{c.previa}</p>}
      <header className={s.header}>
        <h1 className={s.title}>{empresa.nome}</h1>
        {empresa.descricao && <p className={s.lead}>{empresa.descricao}</p>}
        {empresa.site_url && <a className={s.link} href={empresa.site_url} rel="noopener">{c.site}</a>}
      </header>
      <section style={{ display: "flex", flexDirection: "column", gap: 16 }} aria-labelledby="vagas">
        <h2 id="vagas" className={s.secao}>{c.vagasAbertas}</h2>
        {children}
      </section>
      <p className={s.rodape}>{c.rodape}</p>
    </main>
  );
}

// Página ainda não publicada: só com a pré-visualização válida; senão, 404 sem mostrar nada.
async function Previa({ empresa, searchParams }: { empresa: EmpresaPublica; searchParams: PageProps<"/[empresa]">["searchParams"] }) {
  const sp = await searchParams;
  if (!previaValida(empresa.id, typeof sp.previa === "string" ? sp.previa : null)) notFound();
  return (
    <Pagina empresa={empresa} previa>
      <Vagas empresa={empresa} searchParams={searchParams} />
    </Pagina>
  );
}

export default async function CarreirasPage({ params, searchParams }: PageProps<"/[empresa]">) {
  const empresa = await empresaEmCache((await params).empresa);
  if (!empresa) notFound();
  if (!empresa.pagina_publicada) {
    return (
      <Suspense fallback={null}>
        <Previa empresa={empresa} searchParams={searchParams} />
      </Suspense>
    );
  }
  return (
    <Pagina empresa={empresa}>
      <Suspense fallback={esqueleto}>
        <Vagas empresa={empresa} searchParams={searchParams} />
      </Suspense>
    </Pagina>
  );
}
