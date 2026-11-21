// Schema zod da candidatura — regra 11.2 num lugar só: a página, a API pública, a API v1 e o
// formulário do chat validam com ele (princípio 1). As respostas dependem das perguntas da vaga,
// então são conferidas por validarRespostas. O banco confere de novo o que depende dele (11.3,
// vaga aberta, perguntas da vaga, obrigatórias).
import { z } from "zod";
import {
  CANDIDATO_CIDADE_MAX, CANDIDATO_NOME_MAX, CANDIDATO_NOME_MIN, CURRICULO_MAX_BYTES, CURRICULO_TIPOS, EMAIL_MAX, NOME_ARQUIVO_MAX,
  PERGUNTAS_MAX, RESPOSTA_CURTA_MAX, RESPOSTA_LONGA_MAX, RESPOSTA_NUMERO_MAX,
} from "@/lib/limits";

const vazioParaNulo = (v: unknown) => (typeof v === "string" && !v.trim() ? null : v);

// Telefone: só dígitos, 10 a 13 (com DDD; com 55 na frente também serve).
const telefone = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/\D/g, "") || null : v),
  z.string().regex(/^[0-9]{10,13}$/, "telefone_invalido").nullish().transform((v) => v ?? null),
);

// LinkedIn: perfil linkedin.com/in/…; aceita sem https:// e normaliza.
const linkedin = z.preprocess(
  (v) => {
    if (typeof v !== "string" || !v.trim()) return null;
    const t = v.trim();
    return /^https?:\/\//i.test(t) ? t.replace(/^http:/i, "https:") : `https://${t}`;
  },
  z.string().max(300).regex(/^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%.]+\/?$/, "linkedin_invalido").nullish().transform((v) => v ?? null),
);

export const curriculoDeclaradoSchema = z.object({
  nome: z.string().trim().min(1).max(NOME_ARQUIVO_MAX),
  tipo: z.enum([CURRICULO_TIPOS.pdf, CURRICULO_TIPOS.docx], "curriculo_invalido"),
  bytes: z.number().int().positive().max(CURRICULO_MAX_BYTES, "curriculo_invalido"),
});

export const dadosDoCandidatoSchema = z.object({
  nome: z.string().trim().min(CANDIDATO_NOME_MIN).max(CANDIDATO_NOME_MAX),
  email: z.string().trim().toLowerCase().max(EMAIL_MAX).pipe(z.email()),
  telefone,
  linkedin_url: linkedin,
  cidade: z.preprocess(vazioParaNulo, z.string().trim().max(CANDIDATO_CIDADE_MAX).nullish().transform((v) => v ?? null)),
});

export const candidaturaSchema = dadosDoCandidatoSchema.extend({
  respostas: z.array(z.object({ pergunta_id: z.uuid(), valor: z.union([z.string(), z.number(), z.boolean()]).nullish() })).max(PERGUNTAS_MAX).default([]),
  aceite_privacidade: z.literal(true, "aceite_obrigatorio"),
  talentos: z.boolean().default(false),
  curriculo: curriculoDeclaradoSchema.nullish().transform((v) => v ?? null),
  // Campo-armadilha (11.14): pessoas não veem; robôs preenchem.
  website: z.string().max(500).optional(),
});
export type EntradaCandidatura = z.infer<typeof candidaturaSchema>;

export type PerguntaDaVaga = { id: string; texto: string; tipo: string; opcoes: string[]; obrigatoria: boolean };

// Confere as respostas pelas perguntas da vaga (11.2). Devolve as respostas como texto (o formato
// de rs_respostas) e os problemas por campo (respostas.{pergunta_id}).
export function validarRespostas(perguntas: PerguntaDaVaga[], respostas: EntradaCandidatura["respostas"], exigirObrigatorias = true) {
  const porId = new Map(respostas.map((r) => [r.pergunta_id, r.valor]));
  const ok: { pergunta_id: string; valor: string }[] = [];
  const campos: { campo: string; codigo: string }[] = [];
  for (const r of respostas) if (!perguntas.some((p) => p.id === r.pergunta_id)) campos.push({ campo: `respostas.${r.pergunta_id}`, codigo: "pergunta_invalida" });
  for (const p of perguntas) {
    const bruto = porId.get(p.id);
    const vazio = bruto === undefined || bruto === null || (typeof bruto === "string" && !bruto.trim());
    if (vazio) {
      if (p.obrigatoria && exigirObrigatorias) campos.push({ campo: `respostas.${p.id}`, codigo: "resposta_obrigatoria" });
      continue;
    }
    let valor: string | null = null;
    if (p.tipo === "sim_nao") {
      const t = typeof bruto === "boolean" ? (bruto ? "sim" : "nao") : String(bruto).trim().toLowerCase().replace("não", "nao");
      valor = t === "sim" || t === "nao" ? t : null;
    } else if (p.tipo === "escolha_unica") {
      valor = p.opcoes.includes(String(bruto)) ? String(bruto) : null;
    } else if (p.tipo === "numero") {
      const n = typeof bruto === "number" ? bruto : Number(String(bruto).replace(",", "."));
      valor = Number.isFinite(n) && Math.abs(n) <= RESPOSTA_NUMERO_MAX ? String(n) : null;
    } else {
      const t = String(bruto).trim();
      const max = p.tipo === "texto_longo" ? RESPOSTA_LONGA_MAX : RESPOSTA_CURTA_MAX;
      valor = t.length <= max ? t : null;
    }
    if (valor === null) campos.push({ campo: `respostas.${p.id}`, codigo: "resposta_invalida" });
    else ok.push({ pergunta_id: p.id, valor });
  }
  return { respostas: ok, campos };
}

// Camada de leitura das issues: código próprio quando a mensagem é um código (ex.: telefone_invalido).
export function camposDaCandidatura(e: z.ZodError): { campo: string; codigo: string }[] {
  return e.issues.map((i) => ({ campo: i.path.map(String).join("."), codigo: /^[a-z_]+$/.test(i.message) ? i.message : "campo_invalido" }));
}
