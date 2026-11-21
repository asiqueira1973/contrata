"use client";
// Ações do titular no link de acompanhamento (8.4; 11.13, 15.1): retirar (com confirmação no
// lugar), baixar os dados (download do JSON) e excluir com o código de 6 dígitos por e-mail.
// Fala só com /api/c/{token} do próprio site (Origin conferido no servidor).
import { useId, useState } from "react";
import { ERROS, copy } from "@/lib/copy";
import s from "./candidate.module.css";

const c = copy.acompanhamento;
type Props = { token: string; ativa: boolean; vaga: string; empresa: string };
type Modo = "nada" | "retirar" | "excluir" | "codigo" | "excluido" | "retirado";

async function post(url: string, body?: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const b = await r.json().catch(() => ({}));
  return { ok: r.ok, b: b as { mensagem?: string; email?: string; campos?: { mensagem: string }[] } };
}

export function TrackingActions(p: Props) {
  const base = useId();
  const [modo, setModo] = useState<Modo>("nada");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const api = `/api/c/${p.token}`;

  async function rodar(fn: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      await fn();
    } catch {
      setErro(ERROS.generico);
    } finally {
      setOcupado(false);
    }
  }

  if (modo === "excluido" || modo === "retirado") {
    return <div className={s.sucesso} role="status" aria-live="polite">{mensagem}</div>;
  }

  return (
    <section className={s.cartao} aria-label={c.retirar}>
      {modo === "retirar" ? (
        <>
          <p style={{ margin: 0 }}>{c.confirmarRetirar(p.vaga, p.empresa)}</p>
          <div className={s.acoes}>
            <button className={`${s.secundario} ${s.perigo}`} disabled={ocupado} onClick={() => rodar(async () => {
              const r = await post(`${api}/retirar`);
              if (!r.ok) return setErro(r.b.mensagem ?? ERROS.generico);
              setMensagem(r.b.mensagem ?? c.retirada);
              setModo("retirado");
            })}>{c.retirarBotao}</button>
            <button className={s.secundario} onClick={() => setModo("nada")}>{c.cancelar}</button>
          </div>
        </>
      ) : modo === "excluir" || modo === "codigo" ? (
        <>
          <p style={{ margin: 0 }}>{c.excluirTexto(email || "…")}</p>
          {modo === "excluir" ? (
            <div className={s.acoes}>
              <button className={`${s.secundario} ${s.perigo}`} disabled={ocupado} onClick={() => rodar(async () => {
                const r = await post(`${api}/excluir/codigo`);
                if (!r.ok) return setErro(r.b.mensagem ?? ERROS.generico);
                setEmail(r.b.email ?? "");
                setModo("codigo");
              })}>{c.enviarCodigo}</button>
              <button className={s.secundario} onClick={() => setModo("nada")}>{c.cancelar}</button>
            </div>
          ) : (
            <form className={s.form} onSubmit={(e) => {
              e.preventDefault();
              void rodar(async () => {
                const r = await post(`${api}/excluir`, { codigo });
                if (!r.ok) return setErro(r.b.campos?.[0]?.mensagem ?? r.b.mensagem ?? ERROS.generico);
                setMensagem(r.b.mensagem ?? null);
                setModo("excluido");
              });
            }}>
              <p className={s.dica} role="status">{c.codigoEnviado}</p>
              <div className={s.campo}>
                <label className={s.rotulo} htmlFor={`${base}-codigo`}>{c.codigo}</label>
                <input id={`${base}-codigo`} className={s.input} inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}"
                  value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} aria-invalid={!!erro} aria-describedby={erro ? `${base}-erro` : undefined} />
              </div>
              <div className={s.acoes}>
                <button className={`${s.botao}`} style={{ background: "var(--red)" }} type="submit" disabled={ocupado || codigo.length !== 6}>{c.excluirBotao}</button>
                <button className={s.secundario} type="button" onClick={() => setModo("nada")}>{c.cancelar}</button>
              </div>
            </form>
          )}
        </>
      ) : (
        <div className={s.acoes}>
          {p.ativa && <button className={s.secundario} onClick={() => setModo("retirar")}>{c.retirar}</button>}
          <a className={s.secundario} href={`${api}/exportar`} download rel="noreferrer">{c.baixar}</a>
          <button className={`${s.secundario} ${s.perigo}`} onClick={() => setModo("excluir")}>{c.excluir}</button>
        </div>
      )}
      {erro && <p id={`${base}-erro`} className={s.erro} role="alert">{erro}</p>}
    </section>
  );
}
