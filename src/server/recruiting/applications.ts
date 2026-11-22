// Candidaturas — domínio do épico 8.4 (seções 6.2, 7.3–7.5, 9.2, 11.2–11.5, 11.10, 11.12–11.14,
// 11.21, 14.2 e 20.3). Uma regra, quatro portas: a página do candidato, a API pública, a API v1 e
// o formulário do chat chamam estas funções. O banco confere de novo (migration rs_candidaturas).
// Fluxo (9.2): criar (sem token visível, devolve a URL de upload e o token de conclusão) → o
// navegador sobe o currículo direto ao armazenamento → concluir (confere os bytes, gera o link
// /c, grava e manda o e-mail, extrai o texto em segundo plano). O site da empresa nunca vê o /c.
// Nada de dado pessoal em log, evento ou erro (20.2).
import "server-only";
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { copy } from "@/lib/copy";
import {
  AVISO_PRIVACIDADE_VERSAO, CANDIDATURAS_POR_IP_HORA, CANDIDATURAS_POR_VAGA_MAX, CODIGO_DIGITOS, CODIGO_INTERVALO_S, CODIGO_TENTATIVAS,
  CODIGO_VALIDADE_S, CODIGOS_POR_HORA, CONCLUIR_TOKEN_SEGUNDOS, CURRICULO_MAX_BYTES, CURRICULO_TIPOS, DOWNLOAD_URL_SEGUNDOS,
  LINKS_POR_EMAIL_HORA, LINKS_POR_IP_HORA, REVISAO_TEXTO_MAX, UPLOAD_URL_SEGUNDOS, USO_EMPRESA_MAX_BYTES,
} from "@/lib/limits";
import {
  camposDaCandidatura, candidaturaSchema, dadosDoCandidatoSchema, validarRespostas, type PerguntaDaVaga,
} from "@/lib/schemas/applications";
import { generateToken, hashToken } from "@/server/auth/tokens";
import { giraLink, hashDoLink, urlDoLink, urlDoToken } from "@/server/messages/link";
import { db } from "@/server/db/client";
import type { Database } from "@/server/db/types";
import { afterResponse, deliverLater, enqueue } from "@/server/email/outbox";
import { candidaturaRecebida, candidaturaRetirada, codigoExclusao, linksReenviados, revisaoPedida } from "@/server/email/templates";
import { extrairTexto } from "@/server/files/extract";
import { caminhoDoCurriculo, pastaDaCandidatura, storage } from "@/server/files/storage";
import { confereCurriculo, type TipoCurriculo } from "@/server/files/verifica";
import { CamposInvalidos, DomainError } from "@/server/http";
import { atorJson, type Ator } from "@/server/org/actor";
import { deliverDueLater } from "@/server/webhooks/deliver";
import { urlDoLogo } from "@/server/files/logo";

type Origem = Database["public"]["Enums"]["rs_origem_candidatura"];
type Situacao = Database["public"]["Enums"]["rs_situacao_candidatura"];

// Ator do candidato nas rotas públicas e no /c (seção 18).
export const ATOR_CANDIDATO: Ator = { tipo: "candidato", origem: "publico" };

export type EmpresaDaCandidatura = {
  id: string; slug: string; nome: string; email_contato: string; cor_destaque: string | null; logo_path: string | null;
  aviso_privacidade_extra: string | null; retencao_dias: number; talentos_meses: number;
};

const CAMPOS_EMPRESA = "id, slug, nome, email_contato, cor_destaque, logo_path, aviso_privacidade_extra, retencao_dias, talentos_meses";

// Empresa ativa pelo id ou pela slug (sem conferir a página: quem chama decide).
export async function empresaParaCandidatura(por: { id?: string; slug?: string }): Promise<EmpresaDaCandidatura | null> {
  let q = db().from("rs_empresas").select(CAMPOS_EMPRESA).is("excluida_em", null).is("suspensa_em", null);
  q = por.id ? q.eq("id", por.id) : q.eq("slug", por.slug ?? "");
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------- segredos derivados (20.3)
function segredo(): string {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET ausente ou curto");
  return s;
}
const hmac = (texto: string) => createHmac("sha256", segredo()).update(texto).digest("base64url");

// Chave do limite por IP: só o HMAC do IP vai para o banco (11.14).
export function chaveDoIp(ip: string | null): string {
  return hmac(`ip:${ip ?? "sem-ip"}`);
}

// Token de conclusão (1 h): liga o id da candidatura e a extensão declarada do currículo. Formato
// "{exp}.{ext|-}.{assinatura}". Substitui o cookie rs_cand_{id} do spec (funciona em outra origem).
export function tokenDeConclusao(candidaturaId: string, ext: TipoCurriculo | null, agora = Date.now()): string {
  const exp = Math.floor(agora / 1000) + CONCLUIR_TOKEN_SEGUNDOS;
  return `${exp}.${ext ?? "-"}.${hmac(`concluir:${candidaturaId}:${ext ?? "-"}:${exp}`)}`;
}
export function lerTokenDeConclusao(candidaturaId: string, token: unknown, agora = Date.now()): { ext: TipoCurriculo | null } | null {
  if (typeof token !== "string") return null;
  const [expTxt, ext, sig] = token.split(".");
  const exp = Number(expTxt);
  if (!Number.isInteger(exp) || exp < Math.floor(agora / 1000) || !sig || !["pdf", "docx", "-"].includes(ext)) return null;
  const esperado = Buffer.from(hmac(`concluir:${candidaturaId}:${ext}:${exp}`));
  const dado = Buffer.from(sig);
  if (esperado.length !== dado.length || !timingSafeEqual(esperado, dado)) return null;
  return { ext: ext === "-" ? null : (ext as TipoCurriculo) };
}

// Hash do código de exclusão: ligado à candidatura (o mesmo código não serve em outra).
const hashDoCodigo = (candidaturaId: string, codigo: string) => hmac(`exclusao:${candidaturaId}:${codigo}`);

// Versão do aviso aceito (15.5): a padrão, mais um resumo do texto extra da empresa, se houver.
export function versaoDoAviso(extra: string | null): string {
  return extra?.trim() ? `${AVISO_PRIVACIDADE_VERSAO}+${createHash("sha256").update(extra.trim()).digest("hex").slice(0, 8)}` : AVISO_PRIVACIDADE_VERSAO;
}

const linkDoCandidato = (token: string) => urlDoToken(token);

// Versão atual do link de uma candidatura (0 até alguém girar).
async function versaoDoLink(empresaId: string, candidaturaId: string): Promise<number> {
  const { data, error } = await db().from("rs_candidaturas").select("link_versao").eq("empresa_id", empresaId).eq("id", candidaturaId).single();
  if (error) throw error;
  return data.link_versao;
}
const extensaoDoTipo = (tipo: string): TipoCurriculo => (tipo === CURRICULO_TIPOS.docx ? "docx" : "pdf");

// ---------------------------------------------------------------- criar (11.2, 11.3, 11.14)
type VagaParaCandidatura = { id: string; titulo: string; status: string; curriculo_obrigatorio: boolean; perguntas: PerguntaDaVaga[] };

async function vagaDaEmpresa(empresaId: string, por: { id?: string; slug?: string }): Promise<VagaParaCandidatura | null> {
  let q = db().from("rs_vagas").select("id, titulo, status, curriculo_obrigatorio, rs_perguntas(id, texto, tipo, opcoes, obrigatoria, ordem)").eq("empresa_id", empresaId);
  q = por.id ? q.eq("id", por.id) : q.eq("slug", por.slug ?? "");
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id, titulo: data.titulo, status: data.status, curriculo_obrigatorio: data.curriculo_obrigatorio,
    perguntas: [...data.rs_perguntas].sort((a, b) => a.ordem - b.ordem).map((p) => ({ id: p.id, texto: p.texto, tipo: p.tipo, opcoes: p.opcoes ?? [], obrigatoria: p.obrigatoria })),
  };
}

// Perguntas da vaga para o formulário de candidatura (página, 8.4).
export async function vagaParaFormulario(empresaId: string, vagaSlug: string) {
  return vagaDaEmpresa(empresaId, { slug: vagaSlug });
}

async function usoDaEmpresa(empresaId: string): Promise<number> {
  const { data, error } = await db().from("rs_arquivos").select("bytes").eq("empresa_id", empresaId);
  if (error) throw error;
  return (data ?? []).reduce((s, a) => s + a.bytes, 0);
}

export type ResultadoCriacao =
  | { duplicada: true; id: string }
  | { duplicada: false; id: string; upload_url: string | null; concluir_token: string };

// Cria a candidatura (sem concluir). Recebe: empresa, vaga (id ou slug), a entrada (validada aqui
// com o schema da 11.2), a origem, o IP (limite, só nas portas públicas) e o ator. Duplicada já
// recebida: reenvia o link e devolve {duplicada: true} (11.3). Não recebida: a mesma candidatura,
// com URL de upload nova (o "Tentar de novo" da 9.4).
export async function applyToJob(p: {
  empresa: EmpresaDaCandidatura; vaga: { id?: string; slug?: string }; entrada: unknown; origem: Exclude<Origem, "manual" | "banco_talentos">;
  ip: string | null; ator: Ator;
}): Promise<ResultadoCriacao> {
  const parsed = candidaturaSchema.safeParse(p.entrada);
  // Campo-armadilha preenchido: recusa sem dizer por quê (11.14).
  if (parsed.success && parsed.data.website) throw new DomainError("envio_recusado", 400);
  if (!parsed.success) throw new CamposInvalidos(camposDaCandidatura(parsed.error));
  const e = parsed.data;
  if (p.origem !== "integracao" && !(await contaTentativa(chaveDoIp(p.ip), "candidatura", CANDIDATURAS_POR_IP_HORA))) {
    throw new DomainError("envio_recusado", 429);
  }
  const vaga = await vagaDaEmpresa(p.empresa.id, p.vaga);
  if (!vaga) throw new DomainError("nao_encontrado", 404);
  if (vaga.status !== "publicada") throw new DomainError("vaga_fechada", 409);
  const r = validarRespostas(vaga.perguntas, e.respostas);
  if (vaga.curriculo_obrigatorio && !e.curriculo) r.campos.push({ campo: "curriculo", codigo: "curriculo_obrigatorio" });
  if (r.campos.length) throw new CamposInvalidos(r.campos);
  if (e.curriculo && (await usoDaEmpresa(p.empresa.id)) + e.curriculo.bytes > USO_EMPRESA_MAX_BYTES) throw new DomainError("armazenamento_cheio", 409);
  // Hash provisório (não é link de ninguém): o link de verdade nasce na conclusão (link.ts).
  const versao = versaoDoAviso(p.empresa.aviso_privacidade_extra);
  // O texto que esta versão representa fica guardado (8.9; 15.5), também para o texto anterior ao 8.9.
  if (versao.includes("+") && p.empresa.aviso_privacidade_extra) {
    await db().from("rs_avisos_privacidade").upsert({ empresa_id: p.empresa.id, versao, texto_extra: p.empresa.aviso_privacidade_extra.trim() },
      { onConflict: "empresa_id,versao", ignoreDuplicates: true });
  }
  const criada = await chamaCria(p.empresa, vaga.id, e, r.respostas, p.origem, p.ator, versao, e.talentos, generateToken().hash, e.convite);
  if (criada.existente && criada.recebida) {
    // 11.3: não muda nada; gira o link e manda de novo.
    const url = await giraLink(p.empresa.id, criada.id);
    if (url) await mandaLinks(p.empresa, e.email, [{ vaga: vaga.titulo, url }], `duplicada:${criada.id}:${Date.now()}`);
    return { duplicada: true, id: criada.id };
  }
  const ext = e.curriculo ? extensaoDoTipo(e.curriculo.tipo) : null;
  const upload = e.curriculo && ext
    ? await storage().createUploadUrl(caminhoDoCurriculo(p.empresa.id, criada.id, ext), e.curriculo.tipo, UPLOAD_URL_SEGUNDOS)
    : null;
  return { duplicada: false, id: criada.id, upload_url: upload?.url ?? null, concluir_token: tokenDeConclusao(criada.id, ext) };
}

async function chamaCria(empresa: EmpresaDaCandidatura, vagaId: string, e: z.infer<typeof dadosDoCandidatoSchema>,
  respostas: { pergunta_id: string; valor: string }[], origem: Origem, ator: Ator, consentimento: string, talentos: boolean, tokenHash: string, convite?: string) {
  const { data, error } = await db().rpc("rs_fn_cria_candidatura", {
    p_empresa: empresa.id,
    p_vaga: vagaId,
    p_candidato: { nome: e.nome, email: e.email, telefone: e.telefone, linkedin_url: e.linkedin_url, cidade: e.cidade } as never,
    p_respostas: respostas as never,
    p_origem: origem,
    p_ator: atorJson(ator),
    p_consentimento: consentimento,
    p_talentos: talentos,
    p_token_hash: tokenHash,
    p_max_por_vaga: CANDIDATURAS_POR_VAGA_MAX,
    // 8.7: o banco só aceita o convite desta vaga, desta pessoa e no prazo (origem banco_talentos).
    ...(convite ? { p_convite: convite } : {}),
  });
  // 11.14: o teto por vaga recusa como os outros limites, sem dizer qual foi.
  if (error?.message === "limite_candidaturas_vaga") throw new DomainError("envio_recusado", 429);
  if (error) throw error;
  return data as { id: string; existente: boolean; recebida: boolean };
}

async function contaTentativa(chave: string, tipo: "candidatura" | "links" | "links_email", limite: number): Promise<boolean> {
  const { data, error } = await db().rpc("rs_fn_conta_tentativa", { p_chave: chave, p_tipo: tipo, p_limite: limite, p_janela_s: 3600 });
  if (error) throw error;
  return data as boolean;
}

// ---------------------------------------------------------------- concluir (9.2)
type CandidaturaParaConcluir = {
  id: string; origem: Origem; recebida_em: string | null; vaga: { titulo: string }; candidato: { nome: string; email: string | null };
};

async function candidaturaDaEmpresa(empresaId: string, id: string): Promise<CandidaturaParaConcluir | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await db().from("rs_candidaturas")
    .select("id, origem, recebida_em, vaga:vaga_id(titulo), candidato:candidato_id(nome, email)")
    .eq("empresa_id", empresaId).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as CandidaturaParaConcluir | null;
}

// Conclui a candidatura: confere o token de conclusão e o currículo pelos bytes (11.2, 20.3),
// gera o link /c, grava tudo numa transação e manda o e-mail e a extração depois da resposta.
// Recebe: empresa, id, token de conclusão e o ator. Idempotente: já recebida devolve ok.
export async function completeApplication(p: { empresa: EmpresaDaCandidatura; id: string; concluirToken: unknown; ator: Ator }) {
  const c = await candidaturaDaEmpresa(p.empresa.id, p.id);
  const token = c ? lerTokenDeConclusao(c.id, p.concluirToken) : null;
  if (!c || !token) throw new DomainError("concluir_invalido", 400);
  if (c.recebida_em) return { recebida: true };
  let arquivo: { path: string; nome_original: string; mime: string; bytes: number; sha256: string } | null = null;
  let bytes: Uint8Array | null = null;
  if (token.ext) {
    const path = caminhoDoCurriculo(p.empresa.id, c.id, token.ext);
    try {
      bytes = await storage().read(path, CURRICULO_MAX_BYTES);
    } catch (e) {
      if (e instanceof Error && e.message === "arquivo_grande") {
        await storage().delete(path);
        throw new CamposInvalidos([{ campo: "curriculo", codigo: "curriculo_invalido" }]);
      }
      throw e;
    }
    if (!bytes) throw new DomainError("envio_interrompido", 409);
    const conferido = confereCurriculo(bytes);
    if (conferido === "curriculo_invalido" || conferido.tipo !== token.ext) {
      await storage().delete(path);
      throw new CamposInvalidos([{ campo: "curriculo", codigo: "curriculo_invalido" }]);
    }
    arquivo = { path, nome_original: `curriculo.${token.ext}`, mime: CURRICULO_TIPOS[token.ext], bytes: conferido.bytes, sha256: conferido.sha256 };
  }
  return conclui(p.empresa, c, arquivo, bytes, p.ator);
}

async function conclui(empresa: EmpresaDaCandidatura, c: CandidaturaParaConcluir,
  arquivo: { path: string; nome_original: string; mime: string; bytes: number; sha256: string } | null, bytes: Uint8Array | null, ator: Ator) {
  // Link derivado da versão atual (decisão 1 do 8.6): o hash vai ao banco na mesma chamada.
  const versao = await versaoDoLink(empresa.id, c.id);
  const email = candidaturaRecebida({
    empresa: empresa.nome, cor: empresa.cor_destaque, logo: urlDoLogo(empresa.slug, empresa.logo_path), vaga: c.vaga.titulo, nome: c.candidato.nome, url: urlDoLink(c.id, versao), manual: c.origem === "manual",
  });
  const { data, error } = await db().rpc("rs_fn_conclui_candidatura", {
    p_candidatura: c.id,
    p_empresa: empresa.id,
    p_arquivo: arquivo as never,
    p_mensagem: { assunto: email.assunto, corpo: email.corpoGuardado } as never,
    p_notificacao: {
      tipo: "candidatura_recebida", destinatario: c.candidato.email, chave: `recebida:${c.id}`,
      assunto: email.assunto, html: email.html, texto: email.texto, reply_to: empresa.email_contato,
    } as never,
    p_ator: atorJson(ator),
    p_token_hash: hashDoLink(c.id, versao),
  });
  if (error) throw error;
  const r = data as { ja_recebida?: boolean; notificacao_id?: string; arquivo_id?: string | null };
  if (r.ja_recebida) return { recebida: true };
  if (r.notificacao_id) await deliverLater(r.notificacao_id, empresa.nome);
  deliverDueLater(empresa.id); // candidatura.criada (8.8)
  if (r.arquivo_id && arquivo && bytes) {
    const arquivoId = r.arquivo_id;
    const tipo = arquivo.mime === CURRICULO_TIPOS.docx ? "docx" : "pdf";
    await afterResponse(async () => {
      const x = await extrairTexto(bytes, tipo);
      await db().rpc("rs_fn_grava_extracao", { p_arquivo: arquivoId, p_status: x.status, p_texto: x.texto as string });
    });
  }
  return { recebida: true };
}

// ---------------------------------------------------------------- manual (11.2; adicionar_candidato)
// Inclui uma pessoa pelo chat (origem manual): sem aceite, sem respostas; currículo opcional
// (bytes lidos no formulário). Manda o e-mail "{empresa} incluiu você…" com o link para retirar
// e excluir (LGPD art. 9º). A vaga precisa estar no alcance (quem chama confere com getJob).
export async function addCandidateManually(p: {
  empresa: EmpresaDaCandidatura; vagaId: string; dados: unknown; curriculo: { nome: string; bytes: Uint8Array } | null; ator: Ator;
}) {
  const parsed = dadosDoCandidatoSchema.safeParse(p.dados);
  if (!parsed.success) throw new CamposInvalidos(camposDaCandidatura(parsed.error));
  const vaga = await vagaDaEmpresa(p.empresa.id, { id: p.vagaId });
  if (!vaga) throw new DomainError("nao_encontrado", 404);
  if (vaga.status !== "publicada") throw new DomainError("vaga_fechada", 409);
  let conferido: Exclude<ReturnType<typeof confereCurriculo>, "curriculo_invalido"> | null = null;
  if (p.curriculo) {
    const r = confereCurriculo(p.curriculo.bytes);
    if (r === "curriculo_invalido") throw new CamposInvalidos([{ campo: "curriculo", codigo: "curriculo_invalido" }]);
    if ((await usoDaEmpresa(p.empresa.id)) + r.bytes > USO_EMPRESA_MAX_BYTES) throw new DomainError("armazenamento_cheio", 409);
    conferido = r;
  }
  const criada = await chamaCria(p.empresa, vaga.id, parsed.data, [], "manual", p.ator, "manual", false, generateToken().hash);
  if (criada.existente) throw new DomainError("candidato_ja_inscrito", 409);
  let arquivo = null;
  if (p.curriculo && conferido) {
    const path = caminhoDoCurriculo(p.empresa.id, criada.id, conferido.tipo);
    await storage().write(path, p.curriculo.bytes, CURRICULO_TIPOS[conferido.tipo]);
    arquivo = { path, nome_original: p.curriculo.nome.slice(0, 200) || `curriculo.${conferido.tipo}`, mime: CURRICULO_TIPOS[conferido.tipo], bytes: conferido.bytes, sha256: conferido.sha256 };
  }
  const c = await candidaturaDaEmpresa(p.empresa.id, criada.id);
  await conclui(p.empresa, c!, arquivo, p.curriculo?.bytes ?? null, p.ator);
  return { id: criada.id };
}

// ---------------------------------------------------------------- link do candidato (6.2, 11.4)
export type CandidaturaDoToken = {
  id: string; situacao: Situacao; recebida_em: string; criado_em: string; candidato_id: string; empresa: EmpresaDaCandidatura;
  revisao_pedida_em: string | null; expurgar_em: string | null;
  vaga: { id: string; titulo: string; slug: string }; etapa_tipo: string | null;
  candidato: { nome: string; email: string | null; telefone: string | null; linkedin_url: string | null; cidade: string | null; talentos_consentido_em: string | null; talentos_expira_em: string | null; anonimizado_em: string | null };
};

// Guardião do link (requireCandidaturaPorToken, seção 5): formato, hash, candidatura recebida, empresa
// ativa. Devolve null para qualquer link que não vale (a página mostra "Link não encontrado").
export async function requireCandidaturaPorToken(token: string): Promise<CandidaturaDoToken | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const { data, error } = await db().from("rs_candidaturas")
    .select(`id, situacao, recebida_em, criado_em, candidato_id, revisao_pedida_em, expurgar_em, etapa:etapa_id(tipo), vaga:vaga_id(id, titulo, slug),
      empresa:empresa_id(${CAMPOS_EMPRESA}, excluida_em, suspensa_em),
      candidato:candidato_id(nome, email, telefone, linkedin_url, cidade, talentos_consentido_em, talentos_expira_em, anonimizado_em)`)
    .eq("token_hash", hashToken(token)).not("recebida_em", "is", null).maybeSingle();
  if (error) throw error;
  const d = data as unknown as (Omit<CandidaturaDoToken, "etapa_tipo" | "empresa"> & { etapa: { tipo: string } | null; empresa: EmpresaDaCandidatura & { excluida_em: string | null; suspensa_em: string | null } }) | null;
  if (!d || d.empresa.excluida_em || d.empresa.suspensa_em || d.candidato.anonimizado_em) return null;
  const { etapa, ...resto } = d;
  return { ...resto, etapa_tipo: etapa?.tipo ?? null };
}

// Situação na linguagem do candidato (11.21): ele não vê o nome das etapas.
export function situacaoParaCandidato(situacao: Situacao, etapaTipo: string | null): keyof typeof copy.acompanhamento.situacao {
  if (situacao === "desistiu") return "retirada";
  if (situacao === "contratada") return "aprovada";
  if (situacao === "reprovada" || situacao === "encerrada_vaga") return "encerrada";
  if (etapaTipo === "proposta") return "final";
  if (etapaTipo === "entrevista" || etapaTipo === "avaliacao") return "entrevistas";
  return "analise";
}

// Mensagens recebidas pela pessoa nesta candidatura (as que ainda têm texto), mais novas antes.
export async function mensagensRecebidas(candidaturaId: string) {
  const { data, error } = await db().from("rs_mensagens").select("criado_em, assunto, corpo")
    .eq("candidatura_id", candidaturaId).neq("corpo", "").order("criado_em", { ascending: false });
  if (error) throw error;
  // O link guardado como variável não aparece na página (a pessoa já está nele).
  return (data ?? []).map((m) => ({ data: m.criado_em, assunto: m.assunto, corpo: m.corpo.replace(/\{\{link_acompanhamento\}\}/g, copy.acompanhamento.esteLink) }));
}

// Pedir revisão (11.13; 8.6): uma vez, só para reprovada ou encerrada com a vaga, antes do
// expurgo, com texto opcional de até 1.000. Avisa o responsável da vaga (ou, sem responsável, os
// administradores) pelo e-mail revisao_pedida. Recebe: o token e o texto.
export async function requestReview(token: string, texto: unknown): Promise<void> {
  const c = await requireCandidaturaPorToken(token);
  if (!c) throw new DomainError("link_invalido", 404);
  if (texto !== undefined && texto !== null && typeof texto !== "string") throw new CamposInvalidos([{ campo: "texto", codigo: "campo_invalido" }]);
  const t = typeof texto === "string" ? texto.trim() : "";
  if (t.length > REVISAO_TEXTO_MAX) throw new CamposInvalidos([{ campo: "texto", codigo: "revisao_texto_longo" }]);
  const { data: vagaId, error } = await db().rpc("rs_fn_pede_revisao", { p_candidatura: c.id, p_texto: t || (null as never) });
  if (error) throw error;
  deliverDueLater(c.empresa.id); // revisao.pedida (8.8)
  // Quem recebe: o responsável da vaga; sem ele, os administradores ativos.
  const { data: resp } = await db().from("rs_vaga_equipe").select("membro_id, membro:membro_id(empresa_id, removido_em, usuario_id)")
    .eq("vaga_id", vagaId as string).eq("papel_na_vaga", "responsavel");
  // Responsável removido ou sem conta não conta: cai para os administradores.
  let membros = ((resp ?? []) as unknown as { membro_id: string; membro: { empresa_id: string; removido_em: string | null; usuario_id: string | null } | null }[])
    .filter((r) => r.membro && r.membro.empresa_id === c.empresa.id && !r.membro.removido_em && r.membro.usuario_id).map((r) => r.membro_id);
  if (!membros.length) {
    const { data: adms } = await db().from("rs_membros").select("id").eq("empresa_id", c.empresa.id).eq("papel", "administrador").is("removido_em", null).not("usuario_id", "is", null);
    membros = (adms ?? []).map((m) => m.id);
  }
  const { data: usuarios } = membros.length
    ? await db().from("rs_membros").select("id, usuario:usuario_id(email)").eq("empresa_id", c.empresa.id).in("id", membros).is("removido_em", null)
    : { data: [] };
  const email = revisaoPedida({ empresa: c.empresa.nome, nome: c.candidato.nome, vaga: c.vaga.titulo, texto: t || null });
  for (const u of (usuarios ?? []) as unknown as { id: string; usuario: { email: string } | null }[]) {
    if (!u.usuario) continue;
    await enqueue({ empresaId: c.empresa.id, candidaturaId: c.id, tipo: "revisao_pedida", destinatario: u.usuario.email, chave: `revisao:${c.id}:${u.id}`,
      assunto: email.assunto, html: email.html, texto: email.texto });
  }
}

// Retirar (12.2): ativa → desistiu, com a confirmação por e-mail (11.5) e expurgar_em (11.12).
export async function withdraw(token: string): Promise<void> {
  const c = await requireCandidaturaPorToken(token);
  if (!c) throw new DomainError("link_invalido", 404);
  if (c.situacao !== "ativa") throw new DomainError("transicao_proibida", 409);
  const email = candidaturaRetirada({ empresa: c.empresa.nome, cor: c.empresa.cor_destaque, logo: urlDoLogo(c.empresa.slug, c.empresa.logo_path), vaga: c.vaga.titulo, nome: c.candidato.nome, url: linkDoCandidato(token) });
  const { data, error } = await db().rpc("rs_fn_encerra_candidatura", {
    p_candidatura: c.id,
    p_empresa: c.empresa.id,
    p_situacao: "desistiu",
    p_ator: atorJson(ATOR_CANDIDATO),
    p_motivo: null as never,
    p_mensagem: {
      tipo: "desistencia", assunto: email.assunto, corpo: email.corpoGuardado,
      notificacao: { tipo: "mensagem_candidato", destinatario: c.candidato.email, chave: `desistencia:${c.id}`, assunto: email.assunto, html: email.html, texto: email.texto, reply_to: c.empresa.email_contato },
    } as never,
    p_dados: {} as never,
  });
  if (error) throw error;
  const id = (data as { notificacao_id: string | null }).notificacao_id;
  if (id) await deliverLater(id, c.empresa.nome);
  deliverDueLater(c.empresa.id); // candidatura.desistiu (8.8)
}

// Baixar meus dados (14.2): a pessoa nesta empresa e todas as candidaturas dela aqui, com o
// currículo por URL de 5 min. Sem notas, avaliações nem motivo interno. Evento dados_exportados.
export async function exportData(token: string) {
  const c = await requireCandidaturaPorToken(token);
  if (!c) throw new DomainError("link_invalido", 404);
  const { data, error } = await db().from("rs_candidaturas")
    .select("id, situacao, criado_em, recebida_em, consentimento_versao, etapa:etapa_id(tipo), vaga:vaga_id(titulo), rs_respostas(valor, pergunta:pergunta_id(texto, ordem)), rs_arquivos(path, nome_original, tipo), rs_mensagens(criado_em, assunto, corpo)")
    .eq("empresa_id", c.empresa.id).eq("candidato_id", c.candidato_id).not("recebida_em", "is", null).order("criado_em");
  if (error) throw error;
  // Texto extra do aviso que cada candidatura aceitou (8.9; 15.5), pela versão gravada.
  const versoes = [...new Set((data ?? []).map((l) => l.consentimento_versao).filter((v) => v.includes("+")))];
  const { data: avisos } = versoes.length
    ? await db().from("rs_avisos_privacidade").select("versao, texto_extra").eq("empresa_id", c.empresa.id).in("versao", versoes)
    : { data: [] };
  const extra = new Map((avisos ?? []).map((a) => [a.versao, a.texto_extra]));
  type Linha = { id: string; situacao: Situacao; criado_em: string; consentimento_versao: string; etapa: { tipo: string } | null; vaga: { titulo: string };
    rs_respostas: { valor: string; pergunta: { texto: string; ordem: number } }[]; rs_arquivos: { path: string; nome_original: string; tipo: string }[];
    rs_mensagens: { criado_em: string; assunto: string; corpo: string }[] };
  const candidaturas = await Promise.all(((data ?? []) as unknown as Linha[]).map(async (l) => {
    const cv = l.rs_arquivos.find((a) => a.tipo === "curriculo");
    return {
      vaga: l.vaga.titulo,
      candidatou_em: l.criado_em,
      aviso_de_privacidade: { versao: l.consentimento_versao, texto_extra: extra.get(l.consentimento_versao) ?? null },
      situacao: copy.acompanhamento.situacao[situacaoParaCandidato(l.situacao, l.etapa?.tipo ?? null)],
      respostas: [...l.rs_respostas].sort((a, b) => a.pergunta.ordem - b.pergunta.ordem).map((r) => ({ pergunta: r.pergunta.texto, resposta: r.valor })),
      curriculo: cv ? { nome_original: cv.nome_original, url: (await storage().createDownloadUrl(cv.path, DOWNLOAD_URL_SEGUNDOS, cv.nome_original)).url } : null,
      mensagens_recebidas: l.rs_mensagens.filter((m) => m.corpo).sort((a, b) => a.criado_em.localeCompare(b.criado_em))
        .map((m) => ({ data: m.criado_em, assunto: m.assunto, corpo: m.corpo.replace(/\{\{link_acompanhamento\}\}/g, copy.acompanhamento.esteLink) })),
    };
  }));
  const { error: eEvento } = await db().rpc("rs_fn_registra_evento", {
    p_empresa: c.empresa.id, p_vaga: c.vaga.id, p_candidatura: c.id, p_tipo: "dados_exportados",
    p_ator: atorJson(ATOR_CANDIDATO), p_origem: "publico", p_dados: { candidatura_id: c.id } as never,
  });
  if (eEvento) throw eEvento;
  const hoje = new Date().toISOString().slice(0, 10);
  return {
    arquivo: `dados-${c.empresa.slug}-${hoje}.json`,
    conteudo: {
      empresa: c.empresa.nome,
      gerado_em: new Date().toISOString(),
      pessoa: {
        nome: c.candidato.nome, email: c.candidato.email, telefone: c.candidato.telefone, linkedin: c.candidato.linkedin_url, cidade: c.candidato.cidade,
        banco_de_talentos: { consentido_em: c.candidato.talentos_consentido_em, expira_em: c.candidato.talentos_expira_em },
      },
      candidaturas,
    },
  };
}

// E-mail mascarado para a tela do código (11.13): a••••@d••••.com.
export function mascararEmail(email: string | null): string {
  if (!email) return "";
  const [u, d] = email.split("@");
  const [dom, ...resto] = d.split(".");
  return `${u.slice(0, 1)}••••@${dom.slice(0, 1)}••••.${resto.join(".")}`;
}

// Pede o código de exclusão (11.13). Devolve o e-mail mascarado; erros: aguarde, limite_hora.
export async function requestDeletionCode(token: string): Promise<{ email: string }> {
  const c = await requireCandidaturaPorToken(token);
  if (!c) throw new DomainError("link_invalido", 404);
  const codigo = String(randomInt(0, 10 ** CODIGO_DIGITOS)).padStart(CODIGO_DIGITOS, "0");
  const { data, error } = await db().rpc("rs_fn_novo_codigo_exclusao", {
    p_candidatura: c.id, p_codigo_hash: hashDoCodigo(c.id, codigo), p_validade_s: CODIGO_VALIDADE_S, p_intervalo_s: CODIGO_INTERVALO_S, p_max_hora: CODIGOS_POR_HORA,
  });
  if (error) throw error;
  if (data === "aguarde") throw new DomainError("codigo_aguarde", 429);
  if (data === "limite_hora") throw new DomainError("codigo_limite_hora", 429);
  if (data !== "ok") throw new DomainError("link_invalido", 404);
  const email = codigoExclusao({ empresa: c.empresa.nome, codigo });
  await enqueue({
    empresaId: c.empresa.id, candidaturaId: c.id, tipo: "codigo_exclusao", destinatario: c.candidato.email!, chave: `codigo:${c.id}:${hashDoCodigo(c.id, codigo).slice(0, 16)}`,
    assunto: email.assunto, html: email.html, texto: email.texto, replyTo: c.empresa.email_contato, fromName: c.empresa.nome,
  });
  return { email: mascararEmail(c.candidato.email) };
}

// Exclui os dados com o código (11.13; rs_fn_exclui_dados_candidato): encerra as ativas como
// desistiu (sem e-mail), anonimiza tudo da pessoa na empresa e apaga os arquivos depois do commit.
// Arquivo que falhar fica no bucket sem linha no banco; o log diz só "arquivo_nao_apagado", sem o
// caminho. A varredura de arquivos órfãos fica pendente (registrada para o expurgo do 8.10).
// Devolve o nome da empresa.
export async function deleteData(token: string, codigo: unknown): Promise<{ empresa: string }> {
  const c = await requireCandidaturaPorToken(token);
  if (!c) throw new DomainError("link_invalido", 404);
  if (typeof codigo !== "string" || !new RegExp(`^[0-9]{${CODIGO_DIGITOS}}$`).test(codigo.trim())) {
    throw new CamposInvalidos([{ campo: "codigo", codigo: "codigo_errado" }]);
  }
  const { data: r, error: e1 } = await db().rpc("rs_fn_valida_codigo_exclusao", { p_candidatura: c.id, p_codigo_hash: hashDoCodigo(c.id, codigo.trim()), p_max_tentativas: CODIGO_TENTATIVAS });
  if (e1) throw e1;
  const resultado = String(r);
  if (resultado.startsWith("errado")) throw new CamposInvalidos([{ campo: "codigo", codigo: "codigo_errado" }]);
  if (resultado === "bloqueado") throw new CamposInvalidos([{ campo: "codigo", codigo: "codigo_bloqueado" }]);
  if (resultado === "expirado") throw new CamposInvalidos([{ campo: "codigo", codigo: "codigo_expirado" }]);
  if (resultado !== "ok") throw new CamposInvalidos([{ campo: "codigo", codigo: "codigo_ausente" }]);
  const { data: paths, error: e2 } = await db().rpc("rs_fn_exclui_dados_candidato", { p_candidatura: c.id, p_empresa: c.empresa.id });
  if (e2) throw e2;
  const lista = (paths as string[] | null) ?? [];
  deliverDueLater(c.empresa.id); // candidatura.anonimizada (8.8)
  await afterResponse(async () => {
    for (const path of lista) {
      try {
        await storage().delete(path);
      } catch {
        console.error("arquivo_nao_apagado");
      }
    }
  });
  return { empresa: c.empresa.nome };
}

// ---------------------------------------------------------------- "Perdi o link" (6.2)
async function mandaLinks(empresa: EmpresaDaCandidatura, email: string, links: { vaga: string; url: string }[], chave: string) {
  const m = linksReenviados({ empresa: empresa.nome, cor: empresa.cor_destaque, logo: urlDoLogo(empresa.slug, empresa.logo_path), links });
  await enqueue({ empresaId: empresa.id, tipo: "links_reenviados", destinatario: email, chave, assunto: m.assunto, html: m.html, texto: m.texto, replyTo: empresa.email_contato, fromName: empresa.nome });
}

// Reenvia os links das candidaturas do e-mail: só de uma empresa (/{empresa}/links) ou de todas
// (/c), um e-mail por empresa (11.27). Cada link é trocado (o banco só tem o hash). Resposta
// sempre igual para quem pede; limites por IP e por e-mail calam o excesso sem avisar.
export async function resendLinks(p: { email: unknown; empresaId?: string; ip: string | null }): Promise<void> {
  const email = z.string().trim().toLowerCase().max(254).pipe(z.email()).safeParse(p.email);
  if (!email.success) throw new CamposInvalidos([{ campo: "email", codigo: "campo_invalido" }]);
  if (!(await contaTentativa(chaveDoIp(p.ip), "links", LINKS_POR_IP_HORA))) return;
  if (!(await contaTentativa(hmac(`email:${email.data}`), "links_email", LINKS_POR_EMAIL_HORA))) return;
  let q = db().from("rs_candidatos").select("id, empresa_id").eq("email", email.data).is("anonimizado_em", null);
  if (p.empresaId) q = q.eq("empresa_id", p.empresaId);
  const { data: pessoas, error } = await q;
  if (error) throw error;
  for (const pessoa of pessoas ?? []) {
    const empresa = await empresaParaCandidatura({ id: pessoa.empresa_id });
    if (!empresa) continue;
    const { data: cands } = await db().from("rs_candidaturas").select("id, vaga:vaga_id(titulo)").eq("candidato_id", pessoa.id).not("recebida_em", "is", null);
    const links: { vaga: string; url: string }[] = [];
    for (const cand of (cands ?? []) as unknown as { id: string; vaga: { titulo: string } }[]) {
      const url = await giraLink(empresa.id, cand.id);
      if (url) links.push({ vaga: cand.vaga.titulo, url });
    }
    if (links.length) await mandaLinks(empresa, email.data, links, `links:${pessoa.id}:${Date.now()}`);
  }
}

// ---------------------------------------------------------------- faxina (9.4)
// Apaga as candidaturas não recebidas com mais de 24 h e os arquivos delas. Devolve quantas.
export async function cleanAbandonedApplications(lote: number): Promise<number> {
  const { data, error } = await db().rpc("rs_fn_faxina_candidaturas_abandonadas", { p_lote: lote });
  if (error) throw error;
  const prefixos = (data as string[] | null) ?? [];
  for (const prefixo of prefixos) {
    try {
      await storage().deletePrefix(prefixo);
    } catch {
      console.error("arquivo_nao_apagado");
    }
  }
  return prefixos.length;
}

export { pastaDaCandidatura };
