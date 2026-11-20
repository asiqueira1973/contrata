"use client";
// Criar empresa — seção 10, 15.2 e critério 8.1: nome, endereço da página de carreiras mostrado ao
// vivo como {site}/{slug} (reservado ou em uso recusado com a copy da 15), e-mail de contato
// (padrão: o de quem cria). Quem pode criar (11.33) já foi conferido pela página.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { copy, mensagemDeErro } from "@/lib/copy";
import { slugFromName, slugProblem } from "@/lib/schemas/org";
import ui from "@/components/ui/ui.module.css";
import { request } from "./request";

export function NewCompanyForm({ site, emailPadrao }: { site: string; emailPadrao: string }) {
  const router = useRouter();
  const c = copy.novaEmpresa;
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [email, setEmail] = useState(emailPadrao);
  const [slugMsg, setSlugMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const host = site.replace(/^https?:\/\//, "");

  // Sugere o slug a partir do nome até a pessoa mexer nele.
  function onNome(v: string) {
    setNome(v);
    if (!slugTocado) setSlug(slugFromName(v));
  }

  // Confere o slug: formato e reservados na hora; disponibilidade no servidor, com atraso.
  useEffect(() => {
    const problem = slug ? slugProblem(slug) : null;
    if (!slug || problem) {
      const t = setTimeout(() => setSlugMsg(problem ? { ok: false, texto: mensagemDeErro(problem) } : null), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(async () => {
      const r = await request<{ livre: boolean; codigo?: string }>("GET", `/api/painel/empresas/slug?valor=${encodeURIComponent(slug)}`);
      if (r.ok) setSlugMsg(r.data.livre ? { ok: true, texto: c.enderecoLivre } : { ok: false, texto: mensagemDeErro(r.data.codigo) });
    }, 350);
    return () => clearTimeout(t);
  }, [slug, c.enderecoLivre]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await request<{ slug: string }>("POST", "/api/painel/empresas", { nome, slug, email_contato: email });
    if (!r.ok) {
      setBusy(false);
      return setError(r.mensagem);
    }
    router.push(`/painel/${r.data.slug}`);
  }

  return (
    <form className={`${ui.card} ${ui.form}`} onSubmit={submit} noValidate>
      <div className={ui.field}>
        <label className={ui.label} htmlFor="empresa-nome">{c.nome}</label>
        <input id="empresa-nome" className={ui.input} value={nome} onChange={(e) => onNome(e.target.value)} required autoComplete="organization" />
      </div>
      <div className={ui.field}>
        <label className={ui.label} htmlFor="empresa-slug">{c.endereco}</label>
        <div className={ui.prefixed}>
          <span className={ui.prefix} aria-hidden="true">{host}/</span>
          <input
            id="empresa-slug"
            className={ui.input}
            value={slug}
            onChange={(e) => { setSlugTocado(true); setSlug(e.target.value.toLowerCase().replace(/\s/g, "-")); }}
            required
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={slugMsg ? !slugMsg.ok : undefined}
            aria-describedby="empresa-slug-status"
          />
        </div>
        <span id="empresa-slug-status" className={slugMsg ? (slugMsg.ok ? ui.ok : ui.error) : ui.hint} aria-live="polite">
          {slugMsg?.texto ?? ""}
        </span>
      </div>
      <div className={ui.field}>
        <label className={ui.label} htmlFor="empresa-email">{c.email}</label>
        <input id="empresa-email" className={ui.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </div>
      {error ? <p className={ui.error} role="alert">{error}</p> : null}
      <div className={ui.formActions}>
        <button className={ui.primary} type="submit" disabled={busy || !nome.trim() || !slug || slugMsg?.ok === false || !email} aria-busy={busy}>{c.botao}</button>
      </div>
    </form>
  );
}
