// Formulário "Excluir a empresa" (8.9; 7.4, 13.3): só administrador, escopo decisao, sem fallback
// (o modelo não pode excluir sozinho). A pessoa digita o endereço (slug) da empresa; com
// candidaturas em andamento, o domínio recusa. Desfaz em 7 dias pelo desfazer_exclusao.
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { CONFIRMACAO_SLUG_MAX, FUSO } from "@/lib/limits";
import { DomainError } from "@/server/http";
import { deleteCompany } from "@/server/org/companies";
import type { DefinicaoFormulario } from "../registrar";

const c = copy.mcp.form.excluir_empresa;
const DATA = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
export const schemaExcluirEmpresa = z.object({ confirmacao: z.string().trim().max(CONFIRMACAO_SLUG_MAX) });

export const formularioExcluirEmpresa: DefinicaoFormulario<typeof schemaExcluirEmpresa> = {
  acao: "excluir_empresa",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "decisao",
  papel: "administrador",
  entrada: z.object({}),
  async montar(_args, ctx) {
    return {
      campos: [{ tipo: "texto", nome: "confirmacao", rotulo: c.confirmacao(ctx.empresa.slug), obrigatorio: true, max: CONFIRMACAO_SLUG_MAX }],
      valores: { confirmacao: "" },
      avisos: [c.aviso(ctx.empresa.nome)],
      botao: c.botao,
    };
  },
  async opcoes() {
    return {};
  },
  schema: schemaExcluirEmpresa,
  async gravar(dados, ctx) {
    if (ctx.membro.papel !== "administrador") throw new DomainError("papel_insuficiente", 403);
    const r = await deleteCompany(ctx, dados.confirmacao);
    return { ok: true as const, ids: [ctx.empresa.id], resumo: c.resumo(DATA.format(new Date(r.expurgar_em))) };
  },
  fallback: false,
};
