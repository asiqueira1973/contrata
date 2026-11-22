// Catálogo dos eventos de produto — seção 21 e critério 8.11 (porte do Assina). Cada evento tem a
// sua tela e o seu esquema de propriedades, fechado (`.strict()`): o que não está aqui não sai.
// Nenhuma propriedade carrega nome, e-mail, texto, título de vaga, nome de área ou de empresa —
// só contagens, enums e booleanos (a exceção é `cliente` do MCP, que é o nome do cliente OAuth,
// ex. "Claude", e não de uma pessoa). Os nomes (prefixo contrata_) são série histórica no Visão do
// Produto: não renomeie, nem com a troca do nome público.
import "server-only";
import { z } from "zod";
import { ANALYTICS_CLIENTE_MAX, ANALYTICS_NUMERO_MAX, ANALYTICS_ROTA_MAX } from "@/lib/limits";

const contagem = z.number().int().min(0).max(ANALYTICS_NUMERO_MAX);
const horas = z.number().min(0).max(ANALYTICS_NUMERO_MAX);
// Por onde a ação entrou: formulário do chat, operação do agente (ou fallback), chave de API, as
// páginas web de entrada, o candidato pela página e a faxina.
const origem = z.enum(["chat", "mcp", "api", "web", "pagina", "sistema"]);
const escopos = z.array(z.enum(["leitura", "escrita", "decisao"])).max(3);
const tipoDecisao = z.enum(["reprovar", "contratar", "encerrar_vaga", "enviar_mensagem", "reabrir"]);
const nada = z.object({}).strict();

// Esquema de propriedades de cada evento (seção 21, coluna "Propriedades").
export const EVENT_SCHEMAS = {
  contrata_empresa_criada: nada,
  contrata_membro_convidado: z.object({ papel: z.enum(["administrador", "recrutador", "avaliador"]), limitado_por_area: z.boolean() }).strict(),
  contrata_area_criada: nada,
  contrata_pessoa_cadastrada: z.object({ com_acesso: z.boolean() }).strict(),
  contrata_vaga_criada: z.object({ origem }).strict(),
  contrata_vaga_publicada: z
    .object({
      origem,
      modelo_trabalho: z.enum(["presencial", "hibrido", "remoto"]),
      regime: z.enum(["clt", "pj", "estagio", "temporario", "aprendiz", "trainee", "freelancer", "outro"]),
      perguntas: contagem,
      etapas: contagem,
      mostra_salario: z.boolean(),
      tem_area: z.boolean(),
      dono_sem_acesso: z.boolean(),
    })
    .strict(),
  contrata_candidatura_iniciada: nada,
  contrata_candidatura_enviada: z
    .object({
      origem: z.enum(["pagina", "api_publica", "integracao", "manual", "banco_talentos"]),
      com_curriculo: z.boolean(),
      talentos: z.boolean(),
      segundos_no_formulario: contagem,
    })
    .strict(),
  contrata_etapa_alterada: z.object({ origem, lote: contagem }).strict(),
  contrata_avaliacao_registrada: z.object({ recomendacao: z.enum(["forte_sim", "sim", "nao", "forte_nao"]) }).strict(),
  contrata_decisao_proposta: z.object({ tipo: tipoDecisao, origem }).strict(),
  contrata_decisao_confirmada: z.object({ tipo: tipoDecisao, editada: z.boolean(), horas_ate_confirmar: horas, lote: contagem }).strict(),
  contrata_candidatura_encerrada: z
    .object({ situacao: z.enum(["reprovada", "contratada", "desistiu", "encerrada_vaga"]), origem, dias_ate_encerrar: horas })
    .strict(),
  contrata_revisao_pedida: nada,
  contrata_dados_excluidos: nada,
  contrata_mcp_conectado: z.object({ cliente: z.string().trim().min(1).max(ANALYTICS_CLIENTE_MAX), escopos }).strict(),
  contrata_chave_criada: z.object({ escopos }).strict(),
  contrata_formulario_salvo: z.object({ acao: z.string().regex(/^[a-z_]{1,40}$/), fallback: z.boolean(), editado: z.boolean() }).strict(),
  // rota: o padrão, com {id} no lugar de qualquer identificador (nunca o id em si).
  contrata_api_chamada: z
    .object({ rota: z.string().max(ANALYTICS_ROTA_MAX).regex(/^\/[a-z0-9/{}_.-]*$/), status: z.number().int().min(100).max(599), porta: z.enum(["v1", "mcp"]) })
    .strict(),
} as const;

export type EventName = keyof typeof EVENT_SCHEMAS;

/** União fechada por evento (seção 21): as propriedades que cada evento aceita, e só elas. */
export type PropriedadesDeEvento = { [N in EventName]: z.infer<(typeof EVENT_SCHEMAS)[N]> };
export type Origem = z.infer<typeof origem>;

// Tela de cada evento (seção 21, coluna "Onde").
export const EVENT_SCREENS: Record<EventName, string> = {
  contrata_empresa_criada: "nova",
  contrata_membro_convidado: "equipe",
  contrata_area_criada: "areas",
  contrata_pessoa_cadastrada: "pessoas",
  contrata_vaga_criada: "vagas",
  contrata_vaga_publicada: "vagas",
  contrata_candidatura_iniciada: "candidatar",
  contrata_candidatura_enviada: "candidatar",
  contrata_etapa_alterada: "funil",
  contrata_avaliacao_registrada: "candidatura",
  contrata_decisao_proposta: "api",
  contrata_decisao_confirmada: "formulario_decisoes",
  contrata_candidatura_encerrada: "candidatura",
  contrata_revisao_pedida: "acompanhamento",
  contrata_dados_excluidos: "acompanhamento",
  contrata_mcp_conectado: "autorizar",
  contrata_chave_criada: "integracoes",
  contrata_formulario_salvo: "formulario",
  contrata_api_chamada: "api",
};

// Origem de uma ação a partir do ator da trilha (seção 21: "origem").
export function origemDoAtor(ator: { tipo: string; origem?: string }): Origem {
  if (ator.tipo === "api") return "api";
  if (ator.tipo === "agente") return "mcp";
  if (ator.tipo === "candidato") return "pagina";
  if (ator.tipo === "sistema") return "sistema";
  return ator.origem === "formulario" ? "chat" : "web";
}
