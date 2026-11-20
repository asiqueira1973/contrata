"use client";
// Pessoas — seção 10 e critério 8.1: cadastrar com nome, e-mail, cargo e área; selo "Com acesso ·
// {papel}" ou "Sem acesso"; "Dar acesso" (administrador) vira convite. Recrutador cadastra e edita;
// só administrador arquiva e dá acesso (seção 5). Escrita → rota → router.refresh.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { copy } from "@/lib/copy";
import type { Papel } from "@/lib/limits";
import ui from "@/components/ui/ui.module.css";
import { AccessPicker, acessoBody, type Acesso, type AreaOpcao } from "./access-picker";
import { request } from "./request";

export type PessoaView = {
  id: string;
  nome: string;
  email: string;
  cargo: string | null;
  area: AreaOpcao | null;
  recebe_resumo: boolean;
  acesso: { papel: Papel; pendente: boolean } | null;
};

const c = copy.pessoas;

// Formulário de cadastrar ou editar uma pessoa.
function PersonForm({ base, areas, pessoa, onClose }: { base: string; areas: AreaOpcao[]; pessoa?: PessoaView; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    nome: pessoa?.nome ?? "",
    email: pessoa?.email ?? "",
    cargo: pessoa?.cargo ?? "",
    area_id: pessoa?.area?.id ?? "",
    recebe_resumo: pessoa?.recebe_resumo ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = pessoa ? `pessoa-${pessoa.id}` : "pessoa-nova";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = { ...v, cargo: v.cargo || null, area_id: v.area_id || null };
    const r = pessoa ? await request("PATCH", `${base}/pessoas/${pessoa.id}`, body) : await request("POST", `${base}/pessoas`, body);
    setBusy(false);
    if (!r.ok) return setError(r.mensagem);
    onClose();
    router.refresh();
  }

  return (
    <form className={`${pessoa ? "" : ui.card} ${ui.form}`} onSubmit={submit} noValidate>
      <div className={ui.field}>
        <label className={ui.label} htmlFor={`${id}-nome`}>{c.nome}</label>
        <input id={`${id}-nome`} className={ui.input} value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} required autoComplete="off" />
      </div>
      <div className={ui.field}>
        <label className={ui.label} htmlFor={`${id}-email`}>{c.email}</label>
        <input id={`${id}-email`} className={ui.input} type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required autoComplete="off" />
      </div>
      <div className={ui.field}>
        <label className={ui.label} htmlFor={`${id}-cargo`}>{c.cargo}</label>
        <input id={`${id}-cargo`} className={ui.input} value={v.cargo} onChange={(e) => setV({ ...v, cargo: e.target.value })} autoComplete="off" />
      </div>
      <div className={ui.field}>
        <label className={ui.label} htmlFor={`${id}-area`}>{c.area}</label>
        <select id={`${id}-area`} className={ui.select} value={v.area_id} onChange={(e) => setV({ ...v, area_id: e.target.value })}>
          <option value="">{c.semArea}</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.nome}</option>
          ))}
        </select>
      </div>
      <label className={ui.choice}>
        <input type="checkbox" checked={v.recebe_resumo} onChange={(e) => setV({ ...v, recebe_resumo: e.target.checked })} />
        <span>{c.recebeResumo}</span>
      </label>
      {error ? <p className={ui.error} role="alert">{error}</p> : null}
      <div className={ui.formActions}>
        <button className={ui.primary} type="submit" disabled={busy || !v.nome.trim() || !v.email.trim()} aria-busy={busy}>{copy.salvar}</button>
        <button className={ui.secondary} type="button" onClick={onClose}>{copy.cancelar}</button>
      </div>
    </form>
  );
}

function PersonRow({ p, base, areas, admin }: { p: PessoaView; base: string; areas: AreaOpcao[]; admin: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"" | "editar" | "acesso" | "arquivar">("");
  const [acesso, setAcesso] = useState<Acesso>({ papel: "avaliador", todas_areas: true, areas: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Executa uma escrita; sucesso recarrega do servidor.
  async function run(method: string, url: string, body?: unknown) {
    setBusy(true);
    setError(null);
    const r = await request(method, url, body);
    setBusy(false);
    if (!r.ok) return setError(r.mensagem);
    setMode("");
    router.refresh();
  }

  const selo = p.acesso
    ? p.acesso.pendente
      ? <span className={`${ui.pill} ${ui.pillOrange}`}>{c.conviteEnviado}</span>
      : <span className={`${ui.pill} ${ui.pillGreen}`}>{c.comAcesso(p.acesso.papel)}</span>
    : <span className={`${ui.pill} ${ui.pillGray}`}>{c.semAcesso}</span>;

  return (
    <li className={ui.row}>
      <div className={ui.rowMain}>
        <p className={ui.rowTitle}>{p.nome}</p>
        <p className={ui.rowMeta}>{[p.cargo, p.area?.nome ?? c.semArea, p.email].filter(Boolean).join(" · ")}</p>
      </div>
      {selo}
      <div className={ui.rowActions}>
        {admin && !p.acesso ? (
          <button className={ui.textButton} type="button" onClick={() => setMode(mode === "acesso" ? "" : "acesso")} aria-expanded={mode === "acesso"}>{c.darAcesso}</button>
        ) : null}
        <button className={ui.textButton} type="button" onClick={() => setMode(mode === "editar" ? "" : "editar")} aria-expanded={mode === "editar"}>{c.editar}</button>
        {admin && !p.acesso ? (
          <button className={`${ui.textButton} ${ui.danger}`} type="button" onClick={() => setMode(mode === "arquivar" ? "" : "arquivar")}>{c.arquivar}</button>
        ) : null}
      </div>
      {mode === "editar" ? (
        <div className={ui.rowExtra}>
          <PersonForm base={base} areas={areas} pessoa={p} onClose={() => setMode("")} />
        </div>
      ) : null}
      {mode === "acesso" ? (
        <div className={`${ui.rowExtra} ${ui.form}`}>
          <AccessPicker name={`dar-${p.id}`} value={acesso} onChange={setAcesso} areas={areas} />
          <div className={ui.formActions}>
            <button className={ui.primary} type="button" disabled={busy} aria-busy={busy} onClick={() => run("POST", `${base}/pessoas/${p.id}/acesso`, acessoBody(acesso))}>{copy.equipe.enviarConvite}</button>
            <button className={ui.secondary} type="button" onClick={() => setMode("")}>{copy.cancelar}</button>
          </div>
        </div>
      ) : null}
      {mode === "arquivar" ? (
        <div className={`${ui.rowExtra} ${ui.confirm}`}>
          <span>{c.confirmarArquivar(p.nome)}</span>
          <button className={`${ui.textButton} ${ui.danger}`} type="button" disabled={busy} aria-busy={busy} onClick={() => run("DELETE", `${base}/pessoas/${p.id}`)}>{c.arquivar}</button>
          <button className={ui.textButton} type="button" onClick={() => setMode("")}>{copy.cancelar}</button>
        </div>
      ) : null}
      {error ? <p className={`${ui.rowExtra} ${ui.error}`} role="alert">{error}</p> : null}
    </li>
  );
}

export function PeoplePanel({ base, pessoas, areas, admin }: { base: string; pessoas: PessoaView[]; areas: AreaOpcao[]; admin: boolean }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className={ui.stack}>
      {creating ? (
        <PersonForm base={base} areas={areas} onClose={() => setCreating(false)} />
      ) : (
        <div>
          <button className={ui.primary} type="button" onClick={() => setCreating(true)}>{c.nova}</button>
        </div>
      )}
      {pessoas.length ? (
        <ul className={ui.list}>
          {pessoas.map((p) => (
            <PersonRow key={p.id} p={p} base={base} areas={areas} admin={admin} />
          ))}
        </ul>
      ) : (
        <div className={ui.card}>
          <p className={ui.rowMeta}>{c.vazio}</p>
        </div>
      )}
    </div>
  );
}
