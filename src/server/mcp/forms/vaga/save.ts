// salvar_vaga / registrar_vaga (8.3): cria a vaga em rascunho ou grava a edição, pelo domínio
// (src/server/recruiting/jobs.ts). Converte os campos do formulário para a entrada da 11.1 e valida
// com o vagaSchema, o mesmo da API v1. Perguntas de vaga já publicada não são regravadas (11.1).
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { CamposInvalidos } from "@/server/http";
import { createJob, getJob, saveJob, validarVaga } from "@/server/recruiting/jobs";
import type { ContextoFormulario } from "../registrar";
import type { schemaVaga } from "./index";

// Nome do campo do formulário para cada caminho do domínio (o resto é igual: etapas.2.nome…).
const CAMPO: Record<string, string> = { area_id: "area", dono_pessoa_id: "dono", "equipe.responsavel": "responsavel" };
function campoDoFormulario(caminho: string): string {
  if (caminho.startsWith("equipe.avaliadores")) return "avaliadores";
  return CAMPO[caminho] ?? caminho;
}

// "2800", "2800.5", "2.800,50" ou número → número; vazio → null; resto → NaN (o schema recusa).
function numero(v: string | number | undefined): number | null {
  if (typeof v === "number") return v;
  const t = (v ?? "").trim();
  if (!t) return null;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}

export async function gravarVaga(dados: z.infer<typeof schemaVaga>, ctx: ContextoFormulario) {
  const r = copy.mcp.form.vaga;
  const entrada = {
    titulo: dados.titulo,
    ...(dados.vaga && dados.slug ? { slug: dados.slug } : {}),
    descricao: dados.descricao ?? "",
    requisitos: dados.requisitos ?? null,
    area_id: dados.area || null,
    dono_pessoa_id: dados.dono || null,
    modelo_trabalho: dados.modelo_trabalho,
    cidade: dados.modelo_trabalho === "remoto" ? null : dados.cidade || null,
    uf: dados.modelo_trabalho === "remoto" ? null : dados.uf || null,
    regime: dados.regime,
    salario_min: numero(dados.salario_min),
    salario_max: numero(dados.salario_max),
    salario_periodo: dados.salario_periodo || null,
    mostrar_salario: dados.mostrar_salario ?? false,
    curriculo_obrigatorio: dados.curriculo_obrigatorio ?? true,
    encerra_em: dados.encerra_em || null,
    etapas: dados.etapas.map((e) => ({ ...(e.id ? { id: e.id } : {}), nome: e.nome, tipo: e.tipo })),
    perguntas: (dados.perguntas ?? []).map((p) => ({
      texto: p.texto,
      tipo: p.tipo,
      opcoes: p.tipo === "escolha_unica" ? p.opcoes ?? [] : [],
      obrigatoria: p.obrigatoria ?? true,
      resposta_esperada: p.resposta_esperada || null,
    })),
    equipe: { responsavel: dados.responsavel || null, avaliadores: dados.avaliadores ?? [] },
  };
  let valida;
  try {
    valida = validarVaga(entrada);
  } catch (e) {
    if (e instanceof CamposInvalidos) throw new CamposInvalidos(e.campos.map((x) => ({ ...x, campo: campoDoFormulario(x.campo) })));
    throw e;
  }
  if (dados.vaga) {
    const atual = await getJob(ctx, dados.vaga);
    await saveJob(ctx, dados.vaga, valida, { etapas: true, perguntas: !atual.publicada_em, equipe: true });
    return { ok: true as const, ids: [dados.vaga], resumo: r.resumoEditada(valida.titulo) };
  }
  const { id } = await createJob(ctx, valida);
  return { ok: true as const, ids: [id], resumo: r.resumoCriada(valida.titulo) };
}
