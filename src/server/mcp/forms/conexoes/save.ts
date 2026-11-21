// salvar_conexoes (8.2): revoga uma conexão ou chave (o membro as próprias conexões; administrador
// todas) ou cria uma chave de API (administrador; 6.3, 11.15). A chave vai só em `segredo`, que o
// formulário mostra uma vez; o resumo (texto que o modelo lê) nunca a leva.
// Escopo efetivo (11.16): revogar a própria conexão basta leitura; criar chave e revogar credencial
// de outro exigem escrita, e a chave nova não pode ter escopo que a conexão não tem.
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { expandScopes } from "@/server/auth/credential";
import { createApiKey, listCredentials, revokeCredential, type CredencialListada } from "@/server/credentials/manage";
import { DomainError } from "@/server/http";
import type { ContextoFormulario } from "../registrar";
import type { schemaConexoes } from "./index";

// A conexão do conector do próprio membro: desconectar não muda dado da empresa.
export function propria(k: CredencialListada, ctx: ContextoFormulario): boolean {
  return k.tipo === "mcp" && k.membro?.id === ctx.membro.id;
}

export async function gravarConexoes(dados: z.infer<typeof schemaConexoes>, ctx: ContextoFormulario) {
  const c = copy.mcp.form.conexoes;
  const escrita = ctx.escopos.includes("escrita");
  if (dados.operacao === "revogar") {
    if (!dados.credencial) throw new DomainError("campo_invalido");
    const alvo = (await listCredentials(ctx)).find((k) => k.id === dados.credencial);
    if (alvo && !propria(alvo, ctx) && !escrita) throw new DomainError("escopo_insuficiente", 403);
    await revokeCredential(ctx, dados.credencial);
    return { ok: true as const, ids: [dados.credencial], resumo: c.resumoRevogada };
  }
  const nome = (dados.nome ?? "").trim();
  const escopos = expandScopes(dados.escopos ?? []);
  if (!nome || !escopos.length) throw new DomainError("campo_invalido");
  // O papel vem antes do escopo: para o recrutador, a razão é o papel (o domínio confere de novo).
  if (ctx.membro.papel !== "administrador") throw new DomainError("papel_insuficiente", 403);
  if (!escrita || escopos.some((e) => !ctx.escopos.includes(e))) throw new DomainError("escopo_insuficiente", 403);
  const k = await createApiKey(ctx, nome, escopos);
  return { ok: true as const, ids: [k.id], resumo: c.resumoCriada(nome), segredo: { rotulo: c.chaveRotulo, valor: k.valor, aviso: c.chaveAviso } };
}
