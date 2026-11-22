// Cadastro de pessoas — seção 7.3, 7.4 e regra 11.31. Recrutador e administrador cadastram e
// editam; só o administrador arquiva e dá acesso (seção 5). Sem porta de escrita na API nem no
// MCP (13.2); a leitura (listar_pessoas, GET /pessoas) entra no 8.2 sobre listPeople.
import "server-only";
import type { z } from "zod";
import type { pessoaSchema } from "@/lib/schemas/org";
import type { Papel } from "@/lib/limits";
import type { ContextoMembro } from "@/server/auth/require-membro";
import { db } from "@/server/db/client";
import { atorJson } from "./actor";
import { quemDoAtor, track } from "@/server/analytics/client";

export type PessoaListada = {
  id: string;
  nome: string;
  email: string;
  cargo: string | null;
  area: { id: string; nome: string } | null;
  recebe_resumo: boolean;
  // Acesso: papel do membro ativo, "pendente" se há convite aberto para o e-mail, ou null.
  acesso: { papel: Papel; pendente: boolean } | null;
  vagas_como_dono: number;
};

// Pessoas ativas da empresa (tela Pessoas). Recebe: id da empresa.
export async function listPeople(empresaId: string): Promise<PessoaListada[]> {
  const [{ data, error }, { data: convites, error: e2 }] = await Promise.all([
    db()
      .from("rs_pessoas")
      .select("id, nome, email, cargo, recebe_resumo, area:area_id(id, nome), membro:membro_id(papel, removido_em), rs_vagas(status)")
      .eq("empresa_id", empresaId)
      .is("arquivada_em", null)
      .order("nome"),
    db().from("rs_membros").select("email, papel").eq("empresa_id", empresaId).is("usuario_id", null).is("removido_em", null),
  ]);
  if (error) throw error;
  if (e2) throw e2;
  const pendentes = new Map((convites ?? []).map((c) => [c.email.toLowerCase(), c.papel]));
  return (data ?? []).map((p) => {
    const ativo = p.membro && !p.membro.removido_em ? p.membro : null;
    const pendente = pendentes.get(p.email.toLowerCase());
    return {
      id: p.id,
      nome: p.nome,
      email: p.email,
      cargo: p.cargo,
      area: p.area ?? null,
      recebe_resumo: p.recebe_resumo,
      acesso: ativo ? { papel: ativo.papel, pendente: false } : pendente ? { papel: pendente, pendente: true } : null,
      vagas_como_dono: (p.rs_vagas ?? []).filter((v) => v.status !== "encerrada").length,
    };
  });
}

// Cria (id nulo) ou edita uma pessoa; o banco confere área, e-mail repetido e e-mail de quem tem
// acesso. Devolve: id.
export async function savePerson(ctx: ContextoMembro, id: string | null, input: z.infer<typeof pessoaSchema>): Promise<string> {
  const { data, error } = await db().rpc("rs_fn_salva_pessoa", {
    p_empresa: ctx.empresa.id,
    p_id: id as string,
    p_nome: input.nome,
    p_email: input.email,
    p_cargo: input.cargo as string,
    p_area: input.area_id as string,
    p_recebe_resumo: input.recebe_resumo,
    p_ator: atorJson(ctx.ator),
  });
  if (error) throw error;
  if (!id) {
    const pessoaId = data as string;
    track("contrata_pessoa_cadastrada", {
      quem: quemDoAtor(ctx.ator, ctx.empresa.id), chave: pessoaId,
      // Com acesso: o cadastro ligou a pessoa a um membro de mesmo e-mail.
      propriedades: async () => {
        const { data: p } = await db().from("rs_pessoas").select("membro_id").eq("id", pessoaId).eq("empresa_id", ctx.empresa.id).maybeSingle();
        return { com_acesso: !!p?.membro_id };
      },
    });
  }
  return data as string;
}

// Arquiva uma pessoa (7.4); o banco recusa quem tem acesso ou é dono de vaga aberta.
export async function archivePerson(ctx: ContextoMembro, id: string): Promise<void> {
  const { error } = await db().rpc("rs_fn_arquiva_pessoa", { p_pessoa: id, p_empresa: ctx.empresa.id, p_ator: atorJson(ctx.ator) });
  if (error) throw error;
}
