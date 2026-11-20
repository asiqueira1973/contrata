// Usuários do painel (rs_usuarios) — seção 6.1. Fronteira com o banco: nomes em português nos
// campos, como nos tipos gerados (seção 18).
import "server-only";
import { db } from "./client";

export type Usuario = {
  id: string;
  email: string;
  nome: string;
  foto_url: string | null;
  termos_aceitos_em: string | null;
};

// Lê um usuário ativo (não suspenso) pelo id da sessão. Devolve: o usuário ou null.
export async function getUserById(usuarioId: string): Promise<Usuario | null> {
  const { data, error } = await db()
    .from("rs_usuarios")
    .select("id, email, nome, foto_url, termos_aceitos_em, suspenso_em")
    .eq("id", usuarioId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.suspenso_em) return null;
  return { id: data.id, email: data.email, nome: data.nome, foto_url: data.foto_url, termos_aceitos_em: data.termos_aceitos_em };
}

// Entrada pelo Google (6.1): cria ou atualiza o usuário e aceita os convites pendentes do e-mail
// (11.24), tudo em rs_fn_entra_usuario. Devolve: id, se é novo e os slugs das empresas.
// Lança P0001 "usuario_suspenso" ou "email_em_uso".
export async function enterUser(identity: { sub: string; email: string; name: string; picture: string | null }) {
  const { data, error } = await db().rpc("rs_fn_entra_usuario", {
    p_google_sub: identity.sub,
    p_email: identity.email,
    p_nome: identity.name,
    p_foto: identity.picture as string,
  });
  if (error) throw error;
  const r = data as { usuario_id: string; novo: boolean; empresas: string[] };
  return { usuarioId: r.usuario_id, novo: r.novo, empresas: r.empresas };
}

// Grava o aceite dos Termos e da Política (6.1, boas-vindas). Só preenche se ainda estiver nulo.
export async function acceptTerms(usuarioId: string): Promise<void> {
  const { error } = await db()
    .from("rs_usuarios")
    .update({ termos_aceitos_em: new Date().toISOString() })
    .eq("id", usuarioId)
    .is("termos_aceitos_em", null);
  if (error) throw error;
}
