// salvar_pessoa / registrar_pessoa (8.2): cadastra, edita, arquiva ou dá acesso (vira convite),
// pelo domínio do 8.1 (7.3, 7.4, 11.31). Arquivar e dar acesso só para administrador (seção 5).
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { acessoSchema, pessoaSchema } from "@/lib/schemas/org";
import type { ContextoMembro } from "@/server/auth/require-membro";
import { DomainError } from "@/server/http";
import { grantAccess } from "@/server/org/members";
import { archivePerson, savePerson } from "@/server/org/people";
import { acessoDoFormulario } from "../comum";
import type { schemaPessoa } from "./index";

export async function gravarPessoa(dados: z.infer<typeof schemaPessoa>, ctx: ContextoMembro) {
  const r = copy.mcp.form.pessoa.resumo;
  const adminOnly = dados.operacao === "arquivar" || dados.operacao === "dar_acesso";
  if (adminOnly && ctx.membro.papel !== "administrador") throw new DomainError("papel_insuficiente", 403);
  if (dados.operacao !== "cadastrar" && !dados.pessoa) throw new DomainError("campo_invalido");
  if (dados.operacao === "arquivar") {
    await archivePerson(ctx, dados.pessoa!);
    return { ok: true as const, ids: [dados.pessoa!], resumo: r.arquivar("") };
  }
  if (dados.operacao === "dar_acesso") {
    if (!dados.papel) throw new DomainError("campo_invalido");
    const id = await grantAccess(ctx, dados.pessoa!, acessoSchema.parse(acessoDoFormulario({ papel: dados.papel, todas: dados.todas, areas: dados.areas })));
    return { ok: true as const, ids: [id], resumo: r.dar_acesso("") };
  }
  const corpo = pessoaSchema.parse({ nome: dados.nome, email: dados.email, cargo: dados.cargo, area_id: dados.area || null, recebe_resumo: dados.recebe_resumo ?? true });
  const id = await savePerson(ctx, dados.operacao === "editar" ? dados.pessoa! : null, corpo);
  return { ok: true as const, ids: [id], resumo: r[dados.operacao](corpo.nome) };
}
