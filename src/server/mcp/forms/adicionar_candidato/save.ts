// salvar_adicionar_candidato / registrar_adicionar_candidato (8.4; 11.2): confere a vaga no alcance
// (getJob) e inclui a pessoa pelo domínio (addCandidateManually), com o currículo, se veio. O ator
// é quem clicou (formulário) ou o agente (fallback).
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { CURRICULO_CHAT_MAX_BYTES } from "@/lib/limits";
import { CamposInvalidos, DomainError } from "@/server/http";
import { addCandidateManually, empresaParaCandidatura } from "@/server/recruiting/applications";
import { getJob } from "@/server/recruiting/jobs";
import type { ContextoFormulario } from "../registrar";
import { BASE64_MAX, type schemaCandidatoManual } from "./index";

export async function gravarCandidatoManual(dados: z.infer<typeof schemaCandidatoManual>, ctx: ContextoFormulario) {
  const vaga = await getJob(ctx, dados.vaga);
  const empresa = await empresaParaCandidatura({ id: ctx.empresa.id });
  if (!empresa) throw new DomainError("nao_encontrado", 404);
  let curriculo: { nome: string; bytes: Uint8Array } | null = null;
  if (dados.curriculo) {
    // Teto do chat (3 MB) antes de decodificar: o corpo do /mcp na Vercel vai até 4,5 MB.
    if (dados.curriculo.base64.length > BASE64_MAX) throw new CamposInvalidos([{ campo: "curriculo", codigo: "curriculo_grande_chat" }]);
    const bytes = new Uint8Array(Buffer.from(dados.curriculo.base64, "base64"));
    if (bytes.length > CURRICULO_CHAT_MAX_BYTES) throw new CamposInvalidos([{ campo: "curriculo", codigo: "curriculo_grande_chat" }]);
    if (!bytes.length) throw new CamposInvalidos([{ campo: "curriculo", codigo: "curriculo_invalido" }]);
    curriculo = { nome: dados.curriculo.nome, bytes };
  }
  const { id } = await addCandidateManually({
    empresa, vagaId: vaga.id, curriculo, ator: ctx.ator,
    dados: { nome: dados.nome, email: dados.email, telefone: dados.telefone ?? null, linkedin_url: dados.linkedin_url ?? null, cidade: null },
  });
  return { ok: true as const, ids: [id], resumo: copy.mcp.form.adicionar_candidato.resumo(dados.nome.trim(), vaga.titulo) };
}
