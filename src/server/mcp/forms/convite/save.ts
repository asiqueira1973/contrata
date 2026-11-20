// salvar_convite / registrar_convite (8.2): convida um membro (11.24) pelo domínio do 8.1.
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { conviteSchema } from "@/lib/schemas/org";
import type { ContextoMembro } from "@/server/auth/require-membro";
import { inviteMember } from "@/server/org/members";
import { acessoDoFormulario } from "../comum";
import type { schemaConvite } from "./index";

export async function gravarConvite(dados: z.infer<typeof schemaConvite>, ctx: ContextoMembro) {
  const corpo = conviteSchema.parse({ email: dados.email, ...acessoDoFormulario(dados) });
  const id = await inviteMember(ctx, corpo);
  return { ok: true as const, ids: [id], resumo: copy.mcp.form.convite.resumo(corpo.email) };
}
