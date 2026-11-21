// salvar_pagina_de_carreiras (8.3): publica ou tira do ar a página de carreiras. Só administrador.
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { DomainError } from "@/server/http";
import { siteOrigin } from "@/server/oauth/server";
import { setCareersPagePublished } from "@/server/org/companies";
import type { ContextoFormulario } from "../registrar";
import type { schemaPagina } from "./index";

export async function gravarPagina(dados: z.infer<typeof schemaPagina>, ctx: ContextoFormulario) {
  if (ctx.membro.papel !== "administrador") throw new DomainError("papel_insuficiente", 403);
  const r = copy.mcp.form.pagina_de_carreiras.resumo;
  await setCareersPagePublished(ctx, dados.operacao === "publicar");
  return { ok: true as const, ids: [ctx.empresa.id], resumo: dados.operacao === "publicar" ? r.publicar(`${siteOrigin()}/${ctx.empresa.slug}`) : r.despublicar };
}
