"use client";
// Boas-vindas — seções 6.1, 6.4 e 15.2, no consentimento do conector: sem marcar o aceite, o botão
// fica desabilitado. Ao aceitar, grava pelo POST /oauth/termos e recarrega do servidor (toda escrita
// invalida a leitura). Os links de Termos e Privacidade apontam para as páginas do épico 8.12.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { copy } from "@/lib/copy";
import { request } from "@/features/org/request";
import styles from "./welcome.module.css";

export function WelcomeForm() {
  const router = useRouter();
  const c = copy.boasVindas;
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [before, rest] = c.aceite.split(c.termos);
  const [middle, after] = rest.split(c.privacidade);

  // Grava o aceite; só segue depois que o servidor confirmou.
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accepted || saving) return;
    setSaving(true);
    setError(null);
    const r = await request("POST", "/oauth/termos", { aceite: true });
    if (r.ok) return router.refresh();
    setError(r.mensagem);
    setSaving(false);
  }

  return (
    <form className={styles.card} onSubmit={submit}>
      <h1 className={styles.title}>{c.titulo}</h1>
      <label className={styles.accept}>
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>
          {before}
          <Link href="/termos" target="_blank">{c.termos}</Link>
          {middle}
          <Link href="/privacidade" target="_blank">{c.privacidade}</Link>
          {after}
        </span>
      </label>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <button className={styles.button} type="submit" disabled={!accepted || saving} aria-busy={saving}>
        {c.botao}
      </button>
    </form>
  );
}
