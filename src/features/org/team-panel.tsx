"use client";
// Equipe — seção 10 e critério 8.1: convidar (e-mail, papel, áreas se recrutador), reenviar e
// cancelar convite, mudar papel e áreas, remover. Toda escrita vai à rota e só depois recarrega do
// servidor (router.refresh); erro aparece no lugar, nunca como sucesso. O "último administrador"
// (11.26) é recusado pelo banco e a copy da 15.2 aparece aqui.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PAPEL, copy } from "@/lib/copy";
import { formatDateShort } from "@/lib/format";
import type { Papel } from "@/lib/limits";
import ui from "@/components/ui/ui.module.css";
import { AccessPicker, acessoBody, type Acesso, type AreaOpcao } from "./access-picker";
import { request } from "./request";

export type MembroView = {
  id: string;
  email: string;
  nome: string | null;
  papel: Papel;
  todas_areas: boolean;
  areas: AreaOpcao[];
  pendente: boolean;
  convite_expira_em: string | null;
  ultimo_acesso_em: string | null;
  eu: boolean;
};

const c = copy.equipe;

// Formulário de convite.
function InviteForm({ base, areas, onSent, onCancel }: { base: string; areas: AreaOpcao[]; onSent: () => void; onCancel: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [acesso, setAcesso] = useState<Acesso>({ papel: "recrutador", todas_areas: true, areas: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await request("POST", `${base}/convites`, { email, ...acessoBody(acesso) });
    setBusy(false);
    if (!r.ok) return setError(r.mensagem);
    onSent();
    router.refresh();
  }

  return (
    <form className={`${ui.card} ${ui.form}`} onSubmit={submit} noValidate>
      <div className={ui.field}>
        <label className={ui.label} htmlFor="convite-email">{c.email}</label>
        <input id="convite-email" className={ui.input} type="email" autoComplete="off" required value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby={error ? "convite-erro" : undefined} />
      </div>
      <AccessPicker name="convite" value={acesso} onChange={setAcesso} areas={areas} />
      {error ? <p id="convite-erro" className={ui.error} role="alert">{error}</p> : null}
      <div className={ui.formActions}>
        <button className={ui.primary} type="submit" disabled={busy || !email} aria-busy={busy}>{c.enviarConvite}</button>
        <button className={ui.secondary} type="button" onClick={onCancel}>{copy.cancelar}</button>
      </div>
    </form>
  );
}

// Linha de um membro ou convite, com as ações e as confirmações no lugar.
function MemberRow({ m, base, areas }: { m: MembroView; base: string; areas: AreaOpcao[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"" | "acesso" | "remover">("");
  const [acesso, setAcesso] = useState<Acesso>({ papel: m.papel, todas_areas: m.todas_areas, areas: m.areas.map((a) => a.id) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const nome = m.nome ?? m.email;
  const vencido = m.pendente && (!m.convite_expira_em || new Date(m.convite_expira_em) <= new Date());

  // Executa uma escrita; sucesso recarrega a lista do servidor.
  async function run(method: string, url: string, body?: unknown, ok?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await request(method, url, body);
    setBusy(false);
    if (!r.ok) return setError(r.mensagem);
    setMode("");
    if (ok) setNotice(ok);
    router.refresh();
  }

  const meta = [
    m.nome ? m.email : null,
    m.papel === "recrutador" ? (m.todas_areas ? c.todasAsAreas : m.areas.map((a) => a.nome).join(", ")) : null,
    m.pendente ? null : m.ultimo_acesso_em ? c.ultimoAcesso(formatDateShort(m.ultimo_acesso_em)) : c.nuncaEntrou,
  ].filter(Boolean);

  return (
    <li className={ui.row}>
      <div className={ui.rowMain}>
        <p className={ui.rowTitle}>
          {nome}
          {m.eu ? <span className={ui.choiceHint}> ({c.voce})</span> : null}
        </p>
        <p className={ui.rowMeta}>{meta.join(" · ")}</p>
      </div>
      {m.pendente ? (
        <span className={`${ui.pill} ${vencido ? ui.pillRed : ui.pillOrange}`}>
          {vencido ? c.vencido : c.pendente(formatDateShort(m.convite_expira_em as string))}
        </span>
      ) : (
        <span className={`${ui.pill} ${ui.pillGray}`}>{PAPEL[m.papel].rotulo}</span>
      )}
      <div className={ui.rowActions}>
          {m.pendente ? (
            <>
              <button className={ui.textButton} type="button" disabled={busy} onClick={() => run("POST", `${base}/convites/${m.id}/reenviar`, undefined, c.conviteReenviado)}>{c.reenviar}</button>
              <button className={`${ui.textButton} ${ui.danger}`} type="button" disabled={busy} onClick={() => run("DELETE", `${base}/convites/${m.id}`)}>{c.cancelarConvite}</button>
            </>
          ) : (
            <>
              <button className={ui.textButton} type="button" onClick={() => setMode(mode === "acesso" ? "" : "acesso")} aria-expanded={mode === "acesso"}>{c.mudarAcesso}</button>
              <button className={`${ui.textButton} ${ui.danger}`} type="button" onClick={() => setMode(mode === "remover" ? "" : "remover")}>{c.remover}</button>
            </>
          )}
      </div>
      {mode === "acesso" ? (
        <div className={`${ui.rowExtra} ${ui.form}`}>
          <AccessPicker name={`acesso-${m.id}`} value={acesso} onChange={setAcesso} areas={areas} />
          <div className={ui.formActions}>
            <button className={ui.primary} type="button" disabled={busy} aria-busy={busy} onClick={() => run("PATCH", `${base}/membros/${m.id}`, acessoBody(acesso))}>{copy.salvar}</button>
            <button className={ui.secondary} type="button" onClick={() => setMode("")}>{copy.cancelar}</button>
          </div>
        </div>
      ) : null}
      {mode === "remover" ? (
        <div className={`${ui.rowExtra} ${ui.confirm}`}>
          <span>{c.confirmarRemocao(nome)}</span>
          <button className={`${ui.textButton} ${ui.danger}`} type="button" disabled={busy} aria-busy={busy} onClick={() => run("DELETE", `${base}/membros/${m.id}`)}>{c.remover}</button>
          <button className={ui.textButton} type="button" onClick={() => setMode("")}>{copy.cancelar}</button>
        </div>
      ) : null}
      {error ? <p className={`${ui.rowExtra} ${ui.error}`} role="alert">{error}</p> : null}
      {notice ? <p className={`${ui.rowExtra} ${ui.ok}`} role="status">{notice}</p> : null}
    </li>
  );
}

export function TeamPanel({ base, membros, areas }: { base: string; membros: MembroView[]; areas: AreaOpcao[] }) {
  const [inviting, setInviting] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <div className={ui.stack}>
      {inviting ? (
        <InviteForm base={base} areas={areas} onSent={() => { setInviting(false); setSent(true); }} onCancel={() => setInviting(false)} />
      ) : (
        <div>
          <button className={ui.primary} type="button" onClick={() => { setInviting(true); setSent(false); }}>{c.convidar}</button>
        </div>
      )}
      {sent ? <p className={ui.ok} role="status">{c.conviteEnviado}</p> : null}
      <ul className={ui.list}>
        {membros.map((m) => (
          <MemberRow key={m.id} m={m} base={base} areas={areas} />
        ))}
      </ul>
    </div>
  );
}
