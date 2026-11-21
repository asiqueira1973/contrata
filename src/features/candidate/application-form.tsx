"use client";
// Formulário de candidatura (8.4; 10.1, 11.2, 15.1, 16): uma tela, que funciona em 375 px e com
// teclado; erros por campo ligados por aria-describedby; currículo conferido no navegador (tipo e
// 5 MB; o servidor confere de novo pelos bytes); upload direto ao armazenamento com progresso;
// "O envio não terminou" com "Tentar de novo" (a mesma candidatura). O campo-armadilha `website`
// fica fora da vista. Fala só com a API pública da própria empresa (sem segredo nenhum aqui).
import { useId, useRef, useState } from "react";
import { ERROS, copy } from "@/lib/copy";
import { CURRICULO_MAX_BYTES, CURRICULO_TIPOS } from "@/lib/limits";
import s from "./candidate.module.css";

type Pergunta = { id: string; texto: string; tipo: string; opcoes: string[]; obrigatoria: boolean };
type Props = {
  empresaSlug: string; empresaNome: string; vagaSlug: string; vagaTitulo: string; curriculoObrigatorio: boolean;
  perguntas: Pergunta[]; aviso: string[]; avisoExtra: string | null; talentosMeses: number;
};
type Fase = "editando" | "enviando" | "enviado" | "duplicada";

const c = copy.candidatura;
const TIPOS: string[] = [CURRICULO_TIPOS.pdf, CURRICULO_TIPOS.docx];

// Tipo do arquivo pela extensão, quando o navegador não diz (alguns não informam o do .docx).
function tipoDoArquivo(f: File): string {
  if (TIPOS.includes(f.type)) return f.type;
  if (/\.pdf$/i.test(f.name)) return CURRICULO_TIPOS.pdf;
  if (/\.docx$/i.test(f.name)) return CURRICULO_TIPOS.docx;
  return f.type || "application/octet-stream";
}

// PUT direto na URL assinada, com progresso (fetch não informa o progresso do envio).
function subir(url: string, arquivo: File, tipo: string, aoAvancar: (pct: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", tipo);
    xhr.upload.onprogress = (e) => e.lengthComputable && aoAvancar(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(arquivo);
  });
}

export function ApplicationForm(p: Props) {
  const base = useId();
  const [valores, setValores] = useState({ nome: "", email: "", telefone: "", linkedin_url: "", website: "" });
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [aceite, setAceite] = useState(false);
  const [talentos, setTalentos] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [geral, setGeral] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>("editando");
  const [progresso, setProgresso] = useState<number | null>(null);
  const [falhouEnvio, setFalhouEnvio] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const id = (campo: string) => `${base}-${campo}`;
  const erroDe = (campo: string) => erros[campo] ?? null;
  const ligado = (campo: string) => ({ "aria-invalid": !!erroDe(campo), "aria-describedby": erroDe(campo) ? id(`${campo}-erro`) : undefined });
  const erroEl = (campo: string) => (erroDe(campo) ? <p id={id(`${campo}-erro`)} className={s.erro}>{erroDe(campo)}</p> : null);

  function conferirNoNavegador(): Record<string, string> {
    const e: Record<string, string> = {};
    if (valores.nome.trim().length < 2) e.nome = ERROS.campo_invalido;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.email.trim())) e.email = ERROS.campo_invalido;
    for (const q of p.perguntas) if (q.obrigatoria && !respostas[q.id]?.trim()) e[`respostas.${q.id}`] = ERROS.resposta_obrigatoria;
    if (arquivo && (!TIPOS.includes(tipoDoArquivo(arquivo)) || arquivo.size > CURRICULO_MAX_BYTES)) e.curriculo = ERROS.curriculo_invalido;
    if (!arquivo && p.curriculoObrigatorio) e.curriculo = ERROS.curriculo_obrigatorio;
    if (!aceite) e.aceite_privacidade = ERROS.aceite_obrigatorio;
    return e;
  }

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    if (fase === "enviando") return;
    const locais = conferirNoNavegador();
    setErros(locais);
    setGeral(null);
    if (Object.keys(locais).length) {
      formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    setFase("enviando");
    setFalhouEnvio(false);
    try {
      const tipo = arquivo ? tipoDoArquivo(arquivo) : null;
      const r = await fetch(`/api/publico/${p.empresaSlug}/vagas/${p.vagaSlug}/candidaturas`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...valores,
          respostas: Object.entries(respostas).filter(([, v]) => v.trim()).map(([pergunta_id, valor]) => ({ pergunta_id, valor })),
          aceite_privacidade: aceite,
          talentos,
          curriculo: arquivo && tipo ? { nome: arquivo.name.slice(0, 200), tipo, bytes: arquivo.size } : null,
        }),
      });
      const b = await r.json();
      if (!r.ok) {
        const porCampo: Record<string, string> = {};
        for (const x of (b.campos ?? []) as { campo: string; mensagem: string }[]) porCampo[x.campo] = x.mensagem;
        setErros(porCampo);
        setGeral(Object.keys(porCampo).length ? null : b.mensagem ?? ERROS.generico);
        setFase("editando");
        return;
      }
      if (b.duplicada) return setFase("duplicada");
      if (b.upload_url && arquivo) {
        setProgresso(0);
        const ok = await subir(b.upload_url, arquivo, tipoDoArquivo(arquivo), setProgresso);
        if (!ok) throw new Error("upload");
      }
      const concluir = await fetch(`/api/publico/${p.empresaSlug}/candidaturas/${b.id}/concluir`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ concluir_token: b.concluir_token }),
      });
      if (!concluir.ok) {
        const cb = await concluir.json().catch(() => ({}));
        if (cb.campos?.length) {
          setErros({ curriculo: cb.campos[0].mensagem });
          setFase("editando");
          setProgresso(null);
          return;
        }
        throw new Error("concluir");
      }
      setFase("enviado");
    } catch {
      setFalhouEnvio(true);
      setGeral(ERROS.envio_interrompido);
      setFase("editando");
    } finally {
      setProgresso(null);
    }
  }

  if (fase === "enviado" || fase === "duplicada") {
    return (
      <div className={s.sucesso} role="status" aria-live="polite">
        {fase === "enviado" ? (
          <>
            <strong>{c.enviadaTitulo}</strong>
            <span>{c.enviadaTexto(valores.email.trim())}</span>
          </>
        ) : (
          <span>{c.duplicada}</span>
        )}
      </div>
    );
  }

  const enviando = fase === "enviando";
  return (
    <form ref={formRef} className={s.form} onSubmit={enviar} noValidate>
      <div className={s.campo}>
        <label className={s.rotulo} htmlFor={id("nome")}>{c.nome}</label>
        <input id={id("nome")} className={s.input} autoComplete="name" required maxLength={120} value={valores.nome}
          onChange={(e) => setValores({ ...valores, nome: e.target.value })} {...ligado("nome")} />
        {erroEl("nome")}
      </div>
      <div className={s.campo}>
        <label className={s.rotulo} htmlFor={id("email")}>{c.email}</label>
        <input id={id("email")} className={s.input} type="email" autoComplete="email" inputMode="email" required maxLength={254} value={valores.email}
          onChange={(e) => setValores({ ...valores, email: e.target.value })} {...ligado("email")} />
        {erroEl("email")}
      </div>
      <div className={s.campo}>
        <label className={s.rotulo} htmlFor={id("telefone")}>{c.telefone}</label>
        <input id={id("telefone")} className={s.input} type="tel" autoComplete="tel" inputMode="tel" maxLength={20} value={valores.telefone}
          onChange={(e) => setValores({ ...valores, telefone: e.target.value })} {...ligado("telefone")} />
        <span className={s.dica}>{c.telefoneDica}</span>
        {erroEl("telefone")}
      </div>
      <div className={s.campo}>
        <label className={s.rotulo} htmlFor={id("linkedin")}>{c.linkedin}</label>
        <input id={id("linkedin")} className={s.input} type="url" inputMode="url" maxLength={300} value={valores.linkedin_url}
          onChange={(e) => setValores({ ...valores, linkedin_url: e.target.value })} {...ligado("linkedin_url")} />
        {erroEl("linkedin_url")}
      </div>
      <div className={s.campo}>
        <label className={s.rotulo} htmlFor={id("curriculo")}>{p.curriculoObrigatorio ? c.curriculo : c.curriculoOpcional}</label>
        <input id={id("curriculo")} className={s.input} style={{ paddingTop: 10 }} type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setArquivo(f);
            const ruim = f && (!TIPOS.includes(tipoDoArquivo(f)) || f.size > CURRICULO_MAX_BYTES);
            setErros((x) => {
              const resto = Object.fromEntries(Object.entries(x).filter(([k]) => k !== "curriculo"));
              return ruim ? { ...resto, curriculo: ERROS.curriculo_invalido } : resto;
            });
          }} {...ligado("curriculo")} />
        {erroEl("curriculo")}
      </div>
      {p.perguntas.length > 0 && (
        <fieldset className={s.campo} style={{ gap: 16 }}>
          <legend className={s.rotulo}>{c.perguntas}</legend>
          {p.perguntas.map((q) => {
            const campo = `respostas.${q.id}`;
            const rotulo = q.obrigatoria ? q.texto : `${q.texto} (${c.opcional})`;
            const set = (v: string) => setRespostas({ ...respostas, [q.id]: v });
            if (q.tipo === "sim_nao" || q.tipo === "escolha_unica") {
              const opcoes = q.tipo === "sim_nao" ? [{ v: "sim", r: c.sim }, { v: "nao", r: c.nao }] : q.opcoes.map((o) => ({ v: o, r: o }));
              return (
                <fieldset key={q.id} className={s.campo} {...ligado(campo)}>
                  <legend className={s.rotulo}>{rotulo}</legend>
                  <div className={s.opcoes}>
                    {opcoes.map((o) => (
                      <label key={o.v} className={s.opcao}>
                        <input type="radio" name={id(q.id)} value={o.v} checked={respostas[q.id] === o.v} onChange={() => set(o.v)} />
                        {o.r}
                      </label>
                    ))}
                  </div>
                  {erroEl(campo)}
                </fieldset>
              );
            }
            return (
              <div key={q.id} className={s.campo}>
                <label className={s.rotulo} htmlFor={id(q.id)}>{rotulo}</label>
                {q.tipo === "texto_longo" ? (
                  <textarea id={id(q.id)} className={s.textarea} maxLength={3000} value={respostas[q.id] ?? ""} onChange={(e) => set(e.target.value)} {...ligado(campo)} />
                ) : (
                  <input id={id(q.id)} className={s.input} inputMode={q.tipo === "numero" ? "decimal" : undefined} maxLength={q.tipo === "numero" ? 20 : 200}
                    value={respostas[q.id] ?? ""} onChange={(e) => set(e.target.value)} {...ligado(campo)} />
                )}
                {erroEl(campo)}
              </div>
            );
          })}
        </fieldset>
      )}
      <details className={s.aviso}>
        <summary className={s.link} style={{ cursor: "pointer" }}>{c.lerAviso}</summary>
        <ul>{p.aviso.map((l) => <li key={l}>{l}</li>)}</ul>
        {p.avisoExtra && <p style={{ whiteSpace: "pre-line", margin: "8px 0 0" }}>{p.avisoExtra}</p>}
      </details>
      <div className={s.campo}>
        <label className={s.marcar}>
          <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} {...ligado("aceite_privacidade")} />
          <span>{c.aceite(p.empresaNome)}</span>
        </label>
        {erroEl("aceite_privacidade")}
        <label className={s.marcar}>
          <input type="checkbox" checked={talentos} onChange={(e) => setTalentos(e.target.checked)} />
          <span>{c.talentos(p.empresaNome, p.talentosMeses)}</span>
        </label>
      </div>
      {/* Campo-armadilha (11.14): fora da vista e do teclado; quem preenche é robô. */}
      <div className={s.escondido} aria-hidden="true">
        <label htmlFor={id("website")}>Website</label>
        <input id={id("website")} tabIndex={-1} autoComplete="off" value={valores.website} onChange={(e) => setValores({ ...valores, website: e.target.value })} />
      </div>
      {progresso !== null && (
        <div role="status" aria-live="polite">
          <span className={s.dica}>{c.enviandoArquivo(progresso)}</span>
          <div className={s.progresso}><span style={{ width: `${progresso}%` }} /></div>
        </div>
      )}
      {geral && <p className={s.erro} role="alert">{geral}</p>}
      <div className={s.acoes}>
        <button className={s.botao} type="submit" disabled={enviando}>
          {enviando ? c.enviando : falhouEnvio ? c.tentarDeNovo : c.enviar}
        </button>
      </div>
    </form>
  );
}
