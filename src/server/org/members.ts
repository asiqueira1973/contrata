// Equipe e convites — seções 5 e 6.1, regras 11.24, 11.26 e 11.32. Sem porta de API nem MCP
// (13.2: quem dá acesso é sempre uma pessoa, pelo clique no formulário). Toda função recebe a empresa do guardião
// e confere que o membro alvo é dela antes de chamar o banco (a service role ignora RLS, 6.5).
import "server-only";
import type { z } from "zod";
import type { acessoSchema, conviteSchema } from "@/lib/schemas/org";
import { CONVITE_DIAS, CONVITES_PENDENTES_MAX, type Papel } from "@/lib/limits";
import type { ContextoMembro } from "@/server/auth/require-membro";
import { generateToken, hashToken } from "@/server/auth/tokens";
import { db } from "@/server/db/client";
import { conviteMembro } from "@/server/email/templates";
import { enqueue } from "@/server/email/outbox";
import { DomainError } from "@/server/http";
import { atorJson } from "./actor";

export type MembroDaEquipe = {
  id: string;
  email: string;
  nome: string | null;
  papel: Papel;
  todas_areas: boolean;
  areas: { id: string; nome: string }[];
  pendente: boolean;
  convite_expira_em: string | null;
  ultimo_acesso_em: string | null;
};

// Lista membros e convites pendentes da empresa (tela Equipe). Recebe: id da empresa.
export async function listTeam(empresaId: string): Promise<MembroDaEquipe[]> {
  const { data, error } = await db()
    .from("rs_membros")
    .select("id, email, papel, todas_areas, usuario_id, convite_expira_em, rs_usuarios(nome, ultimo_acesso_em), rs_membro_areas(rs_areas(id, nome))")
    .eq("empresa_id", empresaId)
    .is("removido_em", null)
    .order("criado_em");
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    email: m.email,
    nome: m.rs_usuarios?.nome ?? null,
    papel: m.papel,
    todas_areas: m.todas_areas,
    areas: (m.rs_membro_areas ?? []).map((a) => a.rs_areas).filter((a): a is { id: string; nome: string } => !!a),
    pendente: !m.usuario_id,
    convite_expira_em: m.convite_expira_em,
    ultimo_acesso_em: m.rs_usuarios?.ultimo_acesso_em ?? null,
  }));
}

// Confere que o membro é da empresa do guardião. Devolve: a linha mínima. Lança membro_invalido.
async function memberOfCompany(empresaId: string, membroId: string) {
  const { data, error } = await db()
    .from("rs_membros")
    .select("id, email, papel, usuario_id")
    .eq("id", membroId)
    .eq("empresa_id", empresaId)
    .is("removido_em", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new DomainError("membro_invalido", 404);
  return data;
}

function inviteExpiry(): string {
  return new Date(Date.now() + CONVITE_DIAS * 24 * 3600_000).toISOString();
}

// Enfileira o e-mail convite_membro (15.4) com o link /convite/{token}. A chave idempotente leva o
// hash do token: reenviar (token novo) manda outro e-mail; repetir a mesma chamada, não.
async function sendInviteEmail(ctx: ContextoMembro, membroId: string, email: string, papel: Papel, token: string) {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/convite/${token}`;
  const m = conviteMembro({ empresa: ctx.empresa.nome, quemConvidou: ctx.usuario.nome, papel, email, url });
  await enqueue({
    empresaId: ctx.empresa.id,
    tipo: "convite_membro",
    destinatario: email,
    chave: `convite_membro:${membroId}:${hashToken(token).slice(0, 16)}`,
    assunto: m.assunto,
    html: m.html,
    texto: m.texto,
    replyTo: ctx.empresa.email_contato,
    fromName: ctx.empresa.nome,
  });
}

// Convida um membro (11.24) e manda o e-mail. Recebe: contexto do administrador e os dados.
// Devolve: id do convite (membro pendente).
export async function inviteMember(ctx: ContextoMembro, input: z.infer<typeof conviteSchema>): Promise<string> {
  const { token, hash } = generateToken();
  const { data, error } = await db().rpc("rs_fn_convida_membro", {
    p_empresa: ctx.empresa.id,
    p_email: input.email,
    p_papel: input.papel,
    p_todas_areas: input.todas_areas,
    p_areas: input.areas,
    p_token_hash: hash,
    p_expira_em: inviteExpiry(),
    p_max_pendentes: CONVITES_PENDENTES_MAX,
    p_ator: atorJson(ctx.ator),
  });
  if (error) throw error;
  await sendInviteEmail(ctx, data as string, input.email, input.papel, token);
  return data as string;
}

// "Dar acesso" a uma pessoa sem acesso (7.5): convite para o e-mail dela.
export async function grantAccess(ctx: ContextoMembro, pessoaId: string, input: z.infer<typeof acessoSchema>): Promise<string> {
  const { data: pessoa, error: e1 } = await db()
    .from("rs_pessoas").select("email").eq("id", pessoaId).eq("empresa_id", ctx.empresa.id).is("arquivada_em", null).maybeSingle();
  if (e1) throw e1;
  if (!pessoa) throw new DomainError("pessoa_invalida", 404);
  const { token, hash } = generateToken();
  const { data, error } = await db().rpc("rs_fn_da_acesso", {
    p_pessoa: pessoaId,
    p_empresa: ctx.empresa.id,
    p_papel: input.papel,
    p_todas_areas: input.todas_areas,
    p_areas: input.areas,
    p_token_hash: hash,
    p_expira_em: inviteExpiry(),
    p_max_pendentes: CONVITES_PENDENTES_MAX,
    p_ator: atorJson(ctx.ator),
  });
  if (error) throw error;
  await sendInviteEmail(ctx, data as string, pessoa.email, input.papel, token);
  return data as string;
}

// Reenvia um convite pendente: token novo invalida o anterior (11.24).
export async function resendInvite(ctx: ContextoMembro, membroId: string): Promise<void> {
  const alvo = await memberOfCompany(ctx.empresa.id, membroId);
  if (alvo.usuario_id) throw new DomainError("convite_invalido", 404);
  const { token, hash } = generateToken();
  const { error } = await db().rpc("rs_fn_reenvia_convite", {
    p_membro: membroId, p_token_hash: hash, p_expira_em: inviteExpiry(), p_ator: atorJson(ctx.ator),
  });
  if (error) throw error;
  await sendInviteEmail(ctx, membroId, alvo.email, alvo.papel, token);
}

// Cancela um convite pendente.
export async function cancelInvite(ctx: ContextoMembro, membroId: string): Promise<void> {
  const alvo = await memberOfCompany(ctx.empresa.id, membroId);
  if (alvo.usuario_id) throw new DomainError("convite_invalido", 404);
  const { error } = await db().rpc("rs_fn_cancela_convite", { p_membro: membroId, p_ator: atorJson(ctx.ator) });
  if (error) throw error;
}

// Muda papel e áreas (11.32); o banco revoga os tokens MCP e recusa o último administrador (11.26).
export async function changeAccess(ctx: ContextoMembro, membroId: string, input: z.infer<typeof acessoSchema>): Promise<void> {
  await memberOfCompany(ctx.empresa.id, membroId);
  const { error } = await db().rpc("rs_fn_muda_acesso", {
    p_membro: membroId, p_papel: input.papel, p_todas_areas: input.todas_areas, p_areas: input.areas, p_ator: atorJson(ctx.ator),
  });
  if (error) throw error;
}

// Remove um membro (7.4); vale também para sair da empresa. O último administrador é recusado.
export async function removeMember(ctx: ContextoMembro, membroId: string): Promise<void> {
  await memberOfCompany(ctx.empresa.id, membroId);
  const { error } = await db().rpc("rs_fn_remove_membro", { p_membro: membroId, p_ator: atorJson(ctx.ator) });
  if (error) throw error;
}

export type ConviteVisto = {
  membroId: string;
  email: string;
  papel: Papel;
  empresa: string;
  quemConvidou: string | null;
  vencido: boolean;
};

// Lê um convite pelo token do link (/convite/{token}). Devolve null se não existir ou já tiver
// sido usado ou cancelado (a tela mostra "Convite vencido" nos dois casos, sem revelar mais).
export async function getInviteByToken(token: string): Promise<ConviteVisto | null> {
  const { data, error } = await db()
    .from("rs_membros")
    .select("id, email, papel, convite_expira_em, rs_empresas!inner(nome, excluida_em), convidado:convidado_por_membro_id(rs_usuarios(nome))")
    .eq("convite_token_hash", hashToken(token))
    .is("usuario_id", null)
    .is("removido_em", null)
    .is("rs_empresas.excluida_em", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    membroId: data.id,
    email: data.email,
    papel: data.papel,
    empresa: data.rs_empresas.nome,
    quemConvidou: data.convidado?.rs_usuarios?.nome ?? null,
    vencido: !data.convite_expira_em || new Date(data.convite_expira_em) <= new Date(),
  };
}

// Aceita o convite do link com o usuário logado (11.24: só o mesmo e-mail). Devolve o slug da
// empresa. Lança convite_invalido, convite_outro_email ou convite_vencido.
export async function acceptInvite(usuarioId: string, token: string): Promise<string> {
  const convite = await getInviteByToken(token);
  if (!convite) throw new DomainError("convite_invalido", 404);
  const { error } = await db().rpc("rs_fn_aceita_convite", { p_membro: convite.membroId, p_usuario: usuarioId });
  if (error) throw error;
  const { data, error: e2 } = await db().from("rs_membros").select("rs_empresas!inner(slug)").eq("id", convite.membroId).single();
  if (e2) throw e2;
  return data.rs_empresas.slug;
}
