// salvar_vaga / registrar_vaga (8.3): cria a vaga em rascunho ou grava a edição, pelo domínio
// (src/server/recruiting/jobs.ts). Converte os campos do formulário para a entrada da 11.1 e valida
// com o vagaSchema, o mesmo da API v1. Perguntas de vaga já publicada não são regravadas (11.1).
import "server-only";
import type { z } from "zod";
import { copy } from "@/lib/copy";
import { CamposInvalidos } from "@/server/http";
import { createJob, entradaDaVaga, etapasPadrao, getJob, saveJob, validarVaga } from "@/server/recruiting/jobs";
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
  // Só o que veio. O formulário manda todos os campos visíveis; o fallback, só o que muda: na
  // edição, o que não veio fica como está (achado do verifier do 8.3).
  const veio = <T>(v: T | undefined, f: (x: T) => unknown) => (v === undefined ? undefined : f(v));
  const modelo = dados.modelo_trabalho;
  const informado: Record<string, unknown> = {
    titulo: dados.titulo,
    slug: dados.vaga ? veio(dados.slug, (x) => x || undefined) : undefined,
    descricao: veio(dados.descricao, (x) => x),
    requisitos: veio(dados.requisitos, (x) => x || null),
    area_id: veio(dados.area, (x) => x || null),
    dono_pessoa_id: veio(dados.dono, (x) => x || null),
    modelo_trabalho: modelo,
    cidade: modelo === "remoto" ? null : veio(dados.cidade, (x) => x || null),
    uf: modelo === "remoto" ? null : veio(dados.uf, (x) => x || null),
    regime: dados.regime,
    salario_min: veio(dados.salario_min, numero),
    salario_max: veio(dados.salario_max, numero),
    salario_periodo: veio(dados.salario_periodo, (x) => x || null),
    mostrar_salario: dados.mostrar_salario,
    curriculo_obrigatorio: dados.curriculo_obrigatorio,
    encerra_em: veio(dados.encerra_em, (x) => x || null),
    etapas: veio(dados.etapas, (l) => l.map((e) => ({ ...(e.id ? { id: e.id } : {}), nome: e.nome, tipo: e.tipo }))),
    perguntas: veio(dados.perguntas, (l) => l.map((p) => ({
      texto: p.texto,
      tipo: p.tipo,
      opcoes: p.tipo === "escolha_unica" ? p.opcoes ?? [] : [],
      obrigatoria: p.obrigatoria ?? true,
      resposta_esperada: p.resposta_esperada || null,
    }))),
  };
  const mudaEquipe = dados.responsavel !== undefined || dados.avaliadores !== undefined;
  if (mudaEquipe) informado.equipe = { responsavel: dados.responsavel || null, avaliadores: dados.avaliadores ?? [] };
  const definido = Object.fromEntries(Object.entries(informado).filter(([, v]) => v !== undefined));
  const atual = dados.vaga ? await getJob(ctx, dados.vaga) : null;
  const entrada = atual ? { ...entradaDaVaga(atual), ...definido } : { etapas: etapasPadrao(), ...definido };
  let valida;
  try {
    valida = validarVaga(entrada);
  } catch (e) {
    if (e instanceof CamposInvalidos) throw new CamposInvalidos(e.campos.map((x) => ({ ...x, campo: campoDoFormulario(x.campo) })));
    throw e;
  }
  if (atual) {
    // Perguntas de vaga já publicada não são regravadas (11.1); listas que não vieram ficam.
    await saveJob(ctx, atual.id, valida, { etapas: "etapas" in definido, perguntas: "perguntas" in definido && !atual.publicada_em, equipe: mudaEquipe });
    return { ok: true as const, ids: [atual.id], resumo: r.resumoEditada(valida.titulo) };
  }
  const { id } = await createJob(ctx, valida);
  return { ok: true as const, ids: [id], resumo: r.resumoCriada(valida.titulo) };
}
