// salvar_acesso / registrar_acesso (8.2): muda papel e áreas, remove, reenvia ou cancela convite,
// pelo domínio do 8.1 (11.26: o banco recusa o último administrador; 6.3: revoga os conectores).
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { acessoSchema } from "@/lib/schemas/org";
import type { ContextoMembro } from "@/server/auth/require-membro";
import { DomainError } from "@/server/http";
import { cancelInvite, changeAccess, removeMember, resendInvite } from "@/server/org/members";
import { acessoDoFormulario } from "../comum";
import type { schemaAcesso } from "./index";

export async function gravarAcesso(dados: z.infer<typeof schemaAcesso>, ctx: ContextoMembro) {
  if (dados.operacao === "mudar" && !dados.papel) throw new DomainError("campo_invalido");
  if (dados.operacao === "mudar") await changeAccess(ctx, dados.membro, acessoSchema.parse(acessoDoFormulario({ papel: dados.papel!, todas: dados.todas, areas: dados.areas })));
  else if (dados.operacao === "remover") await removeMember(ctx, dados.membro);
  else if (dados.operacao === "reenviar") await resendInvite(ctx, dados.membro);
  else await cancelInvite(ctx, dados.membro);
  return { ok: true as const, ids: [dados.membro], resumo: copy.mcp.form.acesso.resumo[dados.operacao] };
}
