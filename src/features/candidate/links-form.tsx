"use client";
// "Perdi o link" (6.2, 15.1): o e-mail e a resposta sempre igual. Com `empresaSlug`, só os links
// daquela empresa; sem, um e-mail por empresa (/c).
import { useId, useState } from "react";
import { ERROS, copy } from "@/lib/copy";
import s from "./candidate.module.css";

export function LinksForm({ empresaSlug }: { empresaSlug?: string }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [feito, setFeito] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  if (feito) return <div className={s.sucesso} role="status">{copy.perdiLink.resposta}</div>;
  return (
    <form className={s.form} noValidate onSubmit={async (e) => {
      e.preventDefault();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErro(ERROS.campo_invalido);
      setOcupado(true);
      setErro(null);
      try {
        const r = await fetch(empresaSlug ? `/api/publico/${empresaSlug}/links` : "/api/publico/links", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }),
        });
        if (r.ok) setFeito(true);
        else setErro(((await r.json().catch(() => ({}))) as { mensagem?: string }).mensagem ?? ERROS.generico);
      } catch {
        setErro(ERROS.generico);
      } finally {
        setOcupado(false);
      }
    }}>
      <div className={s.campo}>
        <label className={s.rotulo} htmlFor={id}>{copy.perdiLink.email}</label>
        <input id={id} className={s.input} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!erro} aria-describedby={erro ? `${id}-erro` : undefined} />
        {erro && <p id={`${id}-erro`} className={s.erro}>{erro}</p>}
      </div>
      <div className={s.acoes}><button className={s.botao} type="submit" disabled={ocupado}>{copy.perdiLink.enviar}</button></div>
    </form>
  );
}
