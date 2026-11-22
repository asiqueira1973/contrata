"use client";
// Banco de talentos no link de acompanhamento (8.7; 15.1): quem está no banco vê até quando e pode
// renovar ou sair; quem não está pode entrar. Fala só com /api/c/{token}/talentos (Origin conferido
// no servidor).
import { useState } from "react";
import { ERROS, copy } from "@/lib/copy";
import { FUSO } from "@/lib/limits";
import s from "./candidate.module.css";

const t = copy.talentos;
type Props = { token: string; empresa: string; meses: number; ate: string | null };

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO });

export function TalentActions(p: Props) {
  const [ate, setAte] = useState(p.ate && new Date(p.ate) > new Date() ? p.ate : null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function agir(acao: "entrar" | "renovar" | "sair") {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch(`/api/c/${p.token}/talentos`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao }) });
      const b = (await r.json().catch(() => ({}))) as { mensagem?: string; ate?: string | null };
      if (!r.ok) return setErro(b.mensagem ?? ERROS.generico);
      setAte(b.ate ?? null);
      setMensagem(b.mensagem ?? null);
    } catch {
      setErro(ERROS.generico);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className={s.cartao} aria-labelledby="talentos">
      <p id="talentos" style={{ margin: 0, lineHeight: 1.5 }}>{ate ? t.dentro(p.empresa, data(ate)) : copy.candidatura.talentos(p.empresa, p.meses)}</p>
      <div className={s.acoes}>
        {ate ? (
          <>
            <button className={s.secundario} disabled={ocupado} onClick={() => void agir("renovar")}>{t.renovar(p.meses)}</button>
            <button className={`${s.secundario} ${s.perigo}`} disabled={ocupado} onClick={() => void agir("sair")}>{t.sair}</button>
          </>
        ) : (
          <button className={s.secundario} disabled={ocupado} onClick={() => void agir("entrar")}>{t.entrar}</button>
        )}
      </div>
      {mensagem && <p className={s.dica} role="status" aria-live="polite">{mensagem}</p>}
      {erro && <p className={s.erro} role="alert">{erro}</p>}
    </section>
  );
}
