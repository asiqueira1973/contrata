// Schemas zod das vagas — regra 11.1 num lugar só (critério do 8.3): o mesmo schema valida o
// formulário (salvar_vaga), o fallback (registrar_vaga) e a API v1 (POST/PATCH /vagas). O banco
// confere de novo o que depende dele (alcance, congelamento, 12.1). Limites em limits.ts.
// Erros com código próprio (ex.: cidade_obrigatoria) saem na `message` da issue; o resto vira
// campo_invalido. O caminho da issue (ex.: etapas.2.nome) diz o campo ao formulário.
import { z } from "zod";
import {
  AVALIADORES_POR_VAGA_MAX, ETAPA_NOME_MAX, ETAPA_NOME_MIN, ETAPAS_MAX, ETAPAS_MIN, FUSO, MODELOS_TRABALHO,
  PERGUNTA_OPCAO_MAX, PERGUNTA_OPCOES_MAX, PERGUNTA_OPCOES_MIN, PERGUNTA_TEXTO_MAX, PERGUNTA_TEXTO_MIN, PERGUNTAS_MAX,
  PERIODOS_SALARIO, REGIMES, SLUG_FORMATO, TIPOS_ETAPA, TIPOS_PERGUNTA, UFS, VAGA_CIDADE_MAX, VAGA_DESCRICAO_MAX,
  VAGA_DESCRICAO_PUBLICAR_MIN, VAGA_REQUISITOS_MAX, VAGA_SALARIO_MAX, VAGA_SLUG_MAX, VAGA_TITULO_MAX, VAGA_TITULO_MIN,
} from "@/lib/limits";

const nulo = <T extends z.ZodType>(s: T) => s.nullish().transform((v) => v ?? null);
const textoOpcional = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));

// "Hoje" no fuso de São Paulo, AAAA-MM-DD (11.19).
export function hojeEmSaoPaulo(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

export const etapaSchema = z.object({
  id: z.uuid().optional(),
  nome: z.string().trim().min(ETAPA_NOME_MIN).max(ETAPA_NOME_MAX),
  tipo: z.enum(TIPOS_ETAPA),
});

export const perguntaSchema = z
  .object({
    texto: z.string().trim().min(PERGUNTA_TEXTO_MIN).max(PERGUNTA_TEXTO_MAX),
    tipo: z.enum(TIPOS_PERGUNTA),
    opcoes: z.array(z.string().trim().min(1).max(PERGUNTA_OPCAO_MAX)).max(PERGUNTA_OPCOES_MAX).default([]),
    obrigatoria: z.boolean().default(true),
    resposta_esperada: textoOpcional(PERGUNTA_OPCAO_MAX),
  })
  .superRefine((p, ctx) => {
    // Opções só na escolha única, de 2 a 10 (7.3); requisito declarado só em sim/não e escolha
    // única, e precisa ser uma resposta possível (11.10).
    if (p.tipo === "escolha_unica" && (p.opcoes.length < PERGUNTA_OPCOES_MIN || new Set(p.opcoes).size !== p.opcoes.length)) {
      ctx.addIssue({ code: "custom", path: ["opcoes"], message: "opcoes_invalidas" });
    }
    if (p.tipo !== "escolha_unica" && p.opcoes.length) ctx.addIssue({ code: "custom", path: ["opcoes"], message: "opcoes_invalidas" });
    if (p.resposta_esperada) {
      const possiveis = p.tipo === "sim_nao" ? ["sim", "nao"] : p.tipo === "escolha_unica" ? p.opcoes : [];
      if (!possiveis.includes(p.resposta_esperada)) {
        ctx.addIssue({ code: "custom", path: ["resposta_esperada"], message: "resposta_esperada_invalida" });
      }
    }
  });

export const equipeSchema = z.object({
  responsavel: nulo(z.uuid()),
  avaliadores: z.array(z.uuid()).max(AVALIADORES_POR_VAGA_MAX).default([]),
});

// Dados da vaga válidos para um rascunho (11.1 menos a descrição mínima, que é só para publicar).
export const vagaSchema = z
  .object({
    titulo: z.string().trim().min(VAGA_TITULO_MIN).max(VAGA_TITULO_MAX),
    slug: z.string().trim().toLowerCase().max(VAGA_SLUG_MAX).regex(SLUG_FORMATO).optional(),
    descricao: z.string().trim().max(VAGA_DESCRICAO_MAX).default(""),
    requisitos: textoOpcional(VAGA_REQUISITOS_MAX),
    area_id: nulo(z.uuid()),
    dono_pessoa_id: nulo(z.uuid()),
    modelo_trabalho: z.enum(MODELOS_TRABALHO).default("presencial"),
    cidade: textoOpcional(VAGA_CIDADE_MAX),
    uf: nulo(z.enum(UFS)),
    regime: z.enum(REGIMES).default("clt"),
    salario_min: nulo(z.number().positive().max(VAGA_SALARIO_MAX)),
    salario_max: nulo(z.number().positive().max(VAGA_SALARIO_MAX)),
    salario_periodo: nulo(z.enum(PERIODOS_SALARIO)),
    mostrar_salario: z.boolean().default(false),
    curriculo_obrigatorio: z.boolean().default(true),
    encerra_em: nulo(z.iso.date()),
    etapas: z.array(etapaSchema).min(ETAPAS_MIN).max(ETAPAS_MAX),
    perguntas: z.array(perguntaSchema).max(PERGUNTAS_MAX).default([]),
    equipe: equipeSchema.default({ responsavel: null, avaliadores: [] }),
  })
  .superRefine((v, ctx) => {
    // Cidade e UF fora do remoto (7.3); salário com max ≥ min > 0 e período (11.1).
    if (v.modelo_trabalho !== "remoto" && !v.cidade) ctx.addIssue({ code: "custom", path: ["cidade"], message: "cidade_obrigatoria" });
    if (v.modelo_trabalho !== "remoto" && !v.uf) ctx.addIssue({ code: "custom", path: ["uf"], message: "uf_obrigatoria" });
    if (v.salario_min !== null && v.salario_max !== null && v.salario_max < v.salario_min) {
      ctx.addIssue({ code: "custom", path: ["salario_max"], message: "salario_invertido" });
    }
    if ((v.salario_min !== null || v.salario_max !== null) && !v.salario_periodo) {
      ctx.addIssue({ code: "custom", path: ["salario_periodo"], message: "salario_sem_periodo" });
    }
    if (v.mostrar_salario && v.salario_min === null && v.salario_max === null) {
      ctx.addIssue({ code: "custom", path: ["mostrar_salario"], message: "salario_ausente" });
    }
  });
export type VagaEntrada = z.infer<typeof vagaSchema>;

// O que falta para publicar (11.1), além do schema do rascunho: descrição de 50+ e data-limite
// (se houver) de hoje em diante. Devolve a lista de {campo, codigo}; vazia = pode publicar.
export function faltasParaPublicar(v: { descricao: string; encerra_em: string | null }, hoje = hojeEmSaoPaulo()) {
  const faltas: { campo: string; codigo: string }[] = [];
  if (v.descricao.trim().length < VAGA_DESCRICAO_PUBLICAR_MIN) faltas.push({ campo: "descricao", codigo: "descricao_curta" });
  if (v.encerra_em && v.encerra_em < hoje) faltas.push({ campo: "encerra_em", codigo: "encerra_em_passada" });
  return faltas;
}

// Lista de problemas por campo de um parse que falhou (caminho com pontos, ex.: etapas.2.nome).
export function camposDoErro(e: z.ZodError): { campo: string; codigo: string }[] {
  return e.issues.map((i) => ({
    campo: i.path.map(String).join("."),
    codigo: i.code === "custom" && /^[a-z_]+$/.test(i.message) ? i.message : "campo_invalido",
  }));
}
