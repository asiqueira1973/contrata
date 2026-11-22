// salvar_empresa / registrar_empresa (8.9): grava o que veio (o fallback manda só o que muda; o
// formulário, tudo) e, se veio, troca ou tira o logo. O resumo diz o que mudou, sem valores.
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { LOGO_MAX_BYTES } from "@/lib/limits";
import { CamposInvalidos } from "@/server/http";
import { saveCompany, saveLogo, type MudancaEmpresa } from "@/server/org/companies";
import type { ContextoFormulario } from "../registrar";
import { LOGO_BASE64_MAX, type schemaEmpresa } from "./index";

export async function gravarEmpresa(dados: z.infer<typeof schemaEmpresa>, ctx: ContextoFormulario) {
  const c = copy.mcp.form.empresa;
  let logo: Uint8Array | null = null;
  if (dados.logo) {
    // Teto antes de decodificar (o corpo do /mcp tem limite).
    if (dados.logo.base64.length > LOGO_BASE64_MAX) throw new CamposInvalidos([{ campo: "logo", codigo: "logo_grande" }]);
    logo = new Uint8Array(Buffer.from(dados.logo.base64, "base64"));
    if (logo.length > LOGO_MAX_BYTES) throw new CamposInvalidos([{ campo: "logo", codigo: "logo_grande" }]);
    if (!logo.length) throw new CamposInvalidos([{ campo: "logo", codigo: "logo_invalido" }]);
  }
  // Logo e "tirar o logo" não são colunas: vão pelo saveLogo.
  const mudanca = Object.fromEntries(Object.entries(dados).filter(([k, v]) => v !== undefined && k !== "logo" && k !== "remover_logo")) as MudancaEmpresa;
  const campos = await saveCompany(ctx, mudanca);
  if (logo || dados.remover_logo) {
    await saveLogo(ctx, logo);
    campos.push("logo");
  }
  return { ok: true as const, ids: [ctx.empresa.id], resumo: c.resumo(campos.map((k) => c.camposRotulos[k] ?? k)) };
}
