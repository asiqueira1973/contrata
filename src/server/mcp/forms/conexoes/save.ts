// salvar_conexoes (8.2): revoga uma conexão ou chave (o membro as próprias conexões; administrador
// todas) ou cria uma chave de API (administrador; 6.3, 11.15). A chave vai só em `segredo`, que o
// formulário mostra uma vez; o resumo (texto que o modelo lê) nunca a leva.
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import type { ContextoMembro } from "@/server/auth/require-membro";
import { expandScopes } from "@/server/auth/credential";
import { createApiKey, revokeCredential } from "@/server/credentials/manage";
import { DomainError } from "@/server/http";
import type { schemaConexoes } from "./index";

export async function gravarConexoes(dados: z.infer<typeof schemaConexoes>, ctx: ContextoMembro) {
  const c = copy.mcp.form.conexoes;
  if (dados.operacao === "revogar") {
    if (!dados.credencial) throw new DomainError("campo_invalido");
    await revokeCredential(ctx, dados.credencial);
    return { ok: true as const, ids: [dados.credencial], resumo: c.resumoRevogada };
  }
  const nome = (dados.nome ?? "").trim();
  const escopos = expandScopes(dados.escopos ?? []);
  if (!nome || !escopos.length) throw new DomainError("campo_invalido");
  const k = await createApiKey(ctx, nome, escopos);
  return { ok: true as const, ids: [k.id], resumo: c.resumoCriada(nome), segredo: { rotulo: c.chaveRotulo, valor: k.valor, aviso: c.chaveAviso } };
}
