"use client";
// Áreas — seção 10 e critério 8.1: criar, renomear, definir responsável e arquivar (com as recusas
// da 7.4, copy "Arquivar área recusado" da 15.2). Escrita → rota → router.refresh.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { copy } from "@/lib/copy";
import ui from "@/components/ui/ui.module.css";
import { request } from "./request";

export type AreaView = { id: string; nome: string; responsavel: { id: string; nome: string } | null; vagas_abertas: number; recrutadores: number };
export type PessoaOpcao = { id: string; nome: string };

const c = copy.areas;

// Formulário de criar ou editar uma área.
function AreaForm({ base, pessoas, area, onClose }: { base: string; pessoas: PessoaOpcao[]; area?: AreaView; onClose: () => void }) {
  const router = useRouter();
  const [nome, setNome] = useState(area?.nome ?? "");
  const [responsavel, setResponsavel] = useState(area?.responsavel?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idBase = area ? `area-${area.id}` : "area-nova";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = { nome, responsavel_pessoa_id: responsavel || null };
    const r = area ? await request("PATCH", `${base}/areas/${area.id}`, body) : await request("POST", `${base}/areas`, body);
    setBusy(false);
    if (!r.ok) return setError(r.mensagem);
    onClose();
    router.refresh();
  }

  return (
    <form className={`${area ? "" : ui.card} ${ui.form}`} onSubmit={submit} noValidate>
      <div className={ui.field}>
        <label className={ui.label} htmlFor={`${idBase}-nome`}>{c.nome}</label>
        <input id={`${idBase}-nome`} className={ui.input} value={nome} onChange={(e) => setNome(e.target.value)} required aria-describedby={error ? `${idBase}-erro` : undefined} />
      </div>
      <div className={ui.field}>
        <label className={ui.label} htmlFor={`${idBase}-resp`}>{c.responsavel}</label>
        <select id={`${idBase}-resp`} className={ui.select} value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
          <option value="">{c.semResponsavel}</option>
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
      </div>
      {error ? <p id={`${idBase}-erro`} className={ui.error} role="alert">{error}</p> : null}
      <div className={ui.formActions}>
        <button className={ui.primary} type="submit" disabled={busy || nome.trim().length < 2} aria-busy={busy}>{copy.salvar}</button>
        <button className={ui.secondary} type="button" onClick={onClose}>{copy.cancelar}</button>
      </div>
    </form>
  );
}

function AreaRow({ a, base, pessoas }: { a: AreaView; base: string; pessoas: PessoaOpcao[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"" | "editar" | "arquivar">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function archive() {
    setBusy(true);
    setError(null);
    const r = await request("DELETE", `${base}/areas/${a.id}`);
    setBusy(false);
    if (!r.ok) return setError(r.mensagem);
    router.refresh();
  }

  return (
    <li className={ui.row}>
      <div className={ui.rowMain}>
        <p className={ui.rowTitle}>{a.nome}</p>
        <p className={`${ui.rowMeta} tabular`}>{c.resumo(a.responsavel?.nome ?? c.semResponsavel, a.vagas_abertas, a.recrutadores)}</p>
      </div>
      <div className={ui.rowActions}>
        <button className={ui.textButton} type="button" onClick={() => setMode(mode === "editar" ? "" : "editar")} aria-expanded={mode === "editar"}>{c.editar}</button>
        <button className={`${ui.textButton} ${ui.danger}`} type="button" onClick={() => setMode(mode === "arquivar" ? "" : "arquivar")}>{c.arquivar}</button>
      </div>
      {mode === "editar" ? (
        <div className={ui.rowExtra}>
          <AreaForm base={base} pessoas={pessoas} area={a} onClose={() => setMode("")} />
        </div>
      ) : null}
      {mode === "arquivar" ? (
        <div className={`${ui.rowExtra} ${ui.confirm}`}>
          <span>{c.confirmarArquivar(a.nome)}</span>
          <button className={`${ui.textButton} ${ui.danger}`} type="button" disabled={busy} aria-busy={busy} onClick={archive}>{c.arquivar}</button>
          <button className={ui.textButton} type="button" onClick={() => { setMode(""); setError(null); }}>{copy.cancelar}</button>
        </div>
      ) : null}
      {error ? <p className={`${ui.rowExtra} ${ui.error}`} role="alert">{error}</p> : null}
    </li>
  );
}

export function AreasPanel({ base, areas, pessoas }: { base: string; areas: AreaView[]; pessoas: PessoaOpcao[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className={ui.stack}>
      {creating ? (
        <AreaForm base={base} pessoas={pessoas} onClose={() => setCreating(false)} />
      ) : (
        <div>
          <button className={ui.primary} type="button" onClick={() => setCreating(true)}>{c.nova}</button>
        </div>
      )}
      {areas.length ? (
        <ul className={ui.list}>
          {areas.map((a) => (
            <AreaRow key={a.id} a={a} base={base} pessoas={pessoas} />
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
