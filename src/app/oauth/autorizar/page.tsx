// [Membro] Consentimento do conector — seção 6.4 e 10.1: a porta de entrada do produto.
// Ordem: entrar (sem sessão vai para /entrar e volta) → Termos (primeira vez) → empresa (escolher;
// ou criar, para quem está em CRIACAO_EMPRESA_EMAILS, 11.33) → escopos limitados pelo papel
// (11.16) → Permitir/Cancelar, enviados a /oauth/autorizar/decidir, que confere tudo de novo.
// Pedido inválido mostra a tela de erro, sem redirecionar (nunca um redirecionador aberto).
import { Suspense } from "react";
import { redirect } from "next/navigation";
import styles from "@/features/oauth/oauth.module.css";
import { WelcomeForm } from "@/features/account/welcome-form";
import { NewCompanyForm } from "@/features/org/new-company-form";
import { ERROS, NOME_PRODUTO, copy } from "@/lib/copy";
import { canCreateCompany } from "@/server/auth/allowlist";
import { getCurrentUser } from "@/server/auth/require-usuario";
import { AUTHORIZE_PARAMS, checkAuthorizeParams, redirectHost } from "@/server/oauth/authorize";
import { listCompaniesForUser } from "@/server/org/companies";

// Lê a sessão: fora da casca estática da navegação instantânea (pegadinha do Next 16.4).
export const instant = false;

type Props = PageProps<"/oauth/autorizar">;

async function Consent({ searchParams }: Props) {
  const sp = await searchParams;
  const p = Object.fromEntries(AUTHORIZE_PARAMS.map((k) => [k, typeof sp[k] === "string" ? (sp[k] as string) : undefined]));
  const check = await checkAuthorizeParams(p);
  const c = copy.oauth;
  if (!check.ok) {
    return (
      <div className={styles.card} role="alert">
        <p className={styles.brand}>{NOME_PRODUTO}</p>
        <h1 className={styles.title}>{c.invalidoTitulo}</h1>
        <p className={styles.muted}>{c.invalidoTexto}</p>
      </div>
    );
  }
  const usuario = await getCurrentUser();
  if (!usuario) {
    const query = new URLSearchParams(Object.entries(p).filter((e): e is [string, string] => !!e[1])).toString();
    redirect(`/entrar?volta=${encodeURIComponent(`/oauth/autorizar?${query}`)}`);
  }
  if (!usuario.termos_aceitos_em) return <WelcomeForm />;

  const empresas = await listCompaniesForUser(usuario.id);
  if (!empresas.length) {
    return (
      <div className={styles.card}>
        <p className={styles.brand}>{NOME_PRODUTO}</p>
        <h1 className={styles.title}>{canCreateCompany(usuario.email) ? c.criarEmpresa : c.semEmpresa}</h1>
        {canCreateCompany(usuario.email) ? (
          <NewCompanyForm site={process.env.NEXT_PUBLIC_SITE_URL ?? ""} emailPadrao={usuario.email} />
        ) : (
          <p className={styles.muted}>{ERROS.sem_permissao_criar_empresa}</p>
        )}
      </div>
    );
  }
  // Escrita e decisão só aparecem se algum vínculo permitir; a decisão final é recortada pelo
  // papel da empresa escolhida, no servidor (11.16).
  const podeEscrever = empresas.some((e) => e.papel !== "avaliador");
  return (
    <form className={styles.card} method="post" action="/oauth/autorizar/decidir">
      <p className={styles.brand}>{NOME_PRODUTO}</p>
      <h1 className={styles.title}>{c.titulo(check.req.client.nome)}</h1>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{c.empresa}</legend>
        {empresas.map((e, i) => (
          <label key={e.slug} className={styles.choice}>
            <input type="radio" name="empresa" value={e.slug} defaultChecked={i === 0} required />
            <span>
              {e.nome} <span className={styles.muted}>({copy.empresas.papel(e.papel)})</span>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{c.escopos}</legend>
        <label className={styles.choice}>
          <input type="checkbox" checked disabled readOnly />
          <span>{c.escopo.leitura}</span>
        </label>
        {podeEscrever ? (
          <>
            <label className={styles.choice}>
              <input type="checkbox" name="escopo" value="escrita" defaultChecked />
              <span>{c.escopo.escrita}</span>
            </label>
            <label className={styles.choice}>
              <input type="checkbox" name="escopo" value="decisao" defaultChecked />
              <span>{c.escopo.decisao}</span>
            </label>
          </>
        ) : null}
      </fieldset>
      <p className={styles.guarantee}>{c.garantia}</p>
      <p className={styles.muted}>{c.voltaPara(redirectHost(check.req.redirectUri))}</p>
      <p className={styles.muted}>{c.como(usuario.email)}</p>
      {AUTHORIZE_PARAMS.map((k) => (p[k] ? <input key={k} type="hidden" name={k} value={p[k]} /> : null))}
      <div className={styles.buttons}>
        <button className={styles.secondary} type="submit" name="decisao" value="cancelar" formNoValidate>
          {c.cancelar}
        </button>
        <button className={styles.primary} type="submit" name="decisao" value="permitir">
          {c.permitir}
        </button>
      </div>
    </form>
  );
}

export default function AutorizarPage(props: Props) {
  return (
    <main className={styles.page}>
      <Suspense fallback={<div className={styles.card} aria-busy="true" />}>
        <Consent {...props} />
      </Suspense>
    </main>
  );
}
