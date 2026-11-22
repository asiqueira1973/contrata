// Formulário "Desfazer a exclusão da empresa" (8.9; 7.4): só administrador, sem fallback. É a única
// escrita que o conector oferece enquanto a empresa está excluída (dentro de 7 dias).
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { EXCLUSAO_EMPRESA_DIAS, FUSO } from "@/lib/limits";
import { DomainError } from "@/server/http";
import { companySettings, restoreCompany } from "@/server/org/companies";
import type { DefinicaoFormulario } from "../registrar";

const c = copy.mcp.form.desfazer_exclusao;
const DATA = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
export const schemaDesfazer = z.object({});

export const formularioDesfazerExclusao: DefinicaoFormulario<typeof schemaDesfazer> = {
  acao: "desfazer_exclusao",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "escrita",
  papel: "administrador",
  entrada: z.object({}),
  async montar(_args, ctx) {
    const e = await companySettings(ctx.empresa.id);
    const expurgo = e.excluida_em ? new Date(new Date(e.excluida_em).getTime() + EXCLUSAO_EMPRESA_DIAS * 86_400_000) : null;
    return { campos: [], valores: {}, avisos: expurgo ? [c.aviso(e.nome, DATA.format(expurgo))] : [], botao: c.botao };
  },
  async opcoes() {
    return {};
  },
  schema: schemaDesfazer,
  async gravar(_dados, ctx) {
    if (ctx.membro.papel !== "administrador") throw new DomainError("papel_insuficiente", 403);
    await restoreCompany(ctx);
    return { ok: true as const, ids: [ctx.empresa.id], resumo: c.resumo };
  },
  fallback: false,
};
