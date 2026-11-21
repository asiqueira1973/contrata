// Documento OpenAPI 3.1 da API v1 (seção 13.2, critério 8.2), montado dos schemas zod de resposta
// (z.toJSONSchema), para o documento não divergir do que as rotas devolvem. Cresce a cada épico.
import "server-only";
import { z } from "zod";
import { NOME_PRODUTO } from "@/lib/copy";
import { siteOrigin } from "@/server/oauth/server";
import { candidaturaSchema } from "@/lib/schemas/applications";
import { vagaSchema } from "@/lib/schemas/jobs";
import { AreaV1, EmpresaV1, Erro, ErroCampos, ListaAreas, ListaPessoas, ListaVagas, PessoaV1, ResumoVagaV1, VagaV1 } from "./v1";

// Entrada de vaga: o mesmo schema da 11.1 do formulário (as checagens cruzadas, como cidade fora
// do remoto e salário máximo ≥ mínimo, não aparecem no JSON Schema, mas valem: voltam em campos).
const VagaEntrada = vagaSchema;
// Entrada de candidatura: o schema da 11.2 (o mesmo da página e da API pública) mais a vaga.
const CandidaturaEntrada = candidaturaSchema.extend({ vaga_id: z.uuid() });
const CandidaturaCriada = z.object({
  id: z.uuid(),
  upload_url: z.string().nullable().optional().describe("PUT do currículo, válida por 1 h; null quando não há currículo"),
  concluir_token: z.string().optional().describe("vai no corpo de /candidaturas/{id}/concluir"),
  duplicada: z.boolean().optional().describe("true quando a pessoa já se candidatou: o link de acompanhamento é reenviado a ela"),
});
const schemas = { CandidaturaEntrada, CandidaturaCriada, Erro, ErroCampos, Empresa: EmpresaV1, Area: AreaV1, Pessoa: PessoaV1, ListaAreas, ListaPessoas, Vaga: VagaV1, ListaVagas, ResumoVaga: ResumoVagaV1, VagaEntrada };

function componentes() {
  const out: Record<string, unknown> = {};
  for (const [nome, s] of Object.entries(schemas)) {
    const json = z.toJSONSchema(s, { target: "draft-2020-12", unrepresentable: "any", reused: "inline", io: nome.endsWith("Entrada") ? "input" : "output" }) as Record<string, unknown>;
    delete json.$schema;
    delete json.id;
    out[nome] = json;
  }
  return out;
}

const ref = (nome: string) => ({ $ref: `#/components/schemas/${nome}` });
const erros = {
  "401": { description: "Credencial inválida ou revogada", content: { "application/json": { schema: ref("Erro") } } },
  "403": { description: "Escopo insuficiente", content: { "application/json": { schema: ref("Erro") } } },
};
const paginacao = [
  { name: "cursor", in: "query", required: false, schema: { type: "string" } },
  { name: "limite", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
];

const json = (nome: string) => ({ description: "ok", content: { "application/json": { schema: ref(nome) } } });
const invalido = { description: "Dados inválidos (campos)", content: { "application/json": { schema: ref("ErroCampos") } } };
const naoEncontrado = { description: "Não encontrada", content: { "application/json": { schema: ref("Erro") } } };
const conflito = { description: "Conflito com o estado da vaga", content: { "application/json": { schema: ref("Erro") } } };
const idParam = { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } };
const corpoObjeto = { required: true, content: { "application/json": { schema: { type: "object" } } } };

export function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: { title: `${NOME_PRODUTO} API v1`, version: "1.0.0", description: "API REST para integrações (chave de API rsk_… no cabeçalho Authorization). Decisões sobre candidatos nunca acontecem por aqui: viram proposta." },
    servers: [{ url: `${siteOrigin()}/api/v1` }],
    security: [{ chave: [] }],
    components: { securitySchemes: { chave: { type: "http", scheme: "bearer" } }, schemas: componentes() },
    paths: {
      "/empresa": { get: { summary: "Empresa e escopos da chave", operationId: "verEmpresa", responses: { "200": { description: "ok", content: { "application/json": { schema: ref("Empresa") } } }, ...erros } } },
      "/areas": { get: { summary: "Áreas ativas", operationId: "listarAreas", parameters: paginacao, responses: { "200": { description: "ok", content: { "application/json": { schema: ref("ListaAreas") } } }, ...erros } } },
      "/pessoas": { get: { summary: "Pessoas da empresa", operationId: "listarPessoas", parameters: paginacao, responses: { "200": { description: "ok", content: { "application/json": { schema: ref("ListaPessoas") } } }, ...erros } } },
      "/vagas": {
        get: {
          summary: "Vagas", operationId: "listarVagas",
          parameters: [
            ...paginacao,
            { name: "status", in: "query", required: false, schema: { type: "string", enum: ["rascunho", "publicada", "pausada", "encerrada"] } },
            { name: "area_id", in: "query", required: false, schema: { type: "string", format: "uuid" } },
            { name: "dono_pessoa_id", in: "query", required: false, schema: { type: "string", format: "uuid" } },
            { name: "atualizada_desde", in: "query", required: false, schema: { type: "string", format: "date-time" } },
          ],
          responses: { "200": json("ListaVagas"), ...erros, "400": invalido },
        },
        post: {
          summary: "Criar vaga em rascunho (escopo escrita). Sem etapas, as etapas padrão.", operationId: "criarVaga",
          parameters: [{ name: "Idempotency-Key", in: "header", required: false, schema: { type: "string", minLength: 1, maxLength: 100 } }],
          requestBody: { required: true, content: { "application/json": { schema: ref("VagaEntrada") } } },
          responses: { "201": json("Vaga"), "200": { ...json("Vaga"), description: "Idempotency-Key repetida: a mesma vaga" }, ...erros, "400": invalido },
        },
      },
      "/vagas/{id}": {
        parameters: [idParam],
        get: { summary: "Ver vaga", operationId: "verVaga", responses: { "200": json("Vaga"), ...erros, "404": naoEncontrado } },
        patch: {
          summary: "Editar campos da vaga (escopo escrita)", operationId: "editarVaga",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: { "200": json("Vaga"), ...erros, "400": invalido, "404": naoEncontrado, "409": conflito },
        },
      },
      "/vagas/{id}/etapas": { parameters: [idParam], put: { summary: "Substituir etapas (1–15)", operationId: "trocarEtapas", requestBody: corpoObjeto, responses: { "200": json("Vaga"), ...erros, "400": invalido, "409": conflito } } },
      "/vagas/{id}/perguntas": { parameters: [idParam], put: { summary: "Substituir perguntas (só antes da 1ª publicação)", operationId: "trocarPerguntas", requestBody: corpoObjeto, responses: { "200": json("Vaga"), ...erros, "400": invalido, "409": conflito } } },
      "/vagas/{id}/equipe": { parameters: [idParam], put: { summary: "Substituir equipe {responsavel, avaliadores}", operationId: "trocarEquipe", requestBody: corpoObjeto, responses: { "200": json("Vaga"), ...erros, "400": invalido } } },
      "/vagas/{id}/publicar": { parameters: [idParam], post: { summary: "Publicar (escopo escrita)", operationId: "publicarVaga", responses: { "200": json("Vaga"), ...erros, "400": invalido, "409": conflito } } },
      "/vagas/{id}/pausar": { parameters: [idParam], post: { summary: "Pausar (escopo escrita)", operationId: "pausarVaga", responses: { "200": json("Vaga"), ...erros, "409": conflito } } },
      "/vagas/{id}/encerrar": { parameters: [idParam], post: { summary: "Encerrar sem candidaturas em andamento (escopo decisao); com candidaturas em andamento, 409 até as propostas", operationId: "encerrarVaga", requestBody: corpoObjeto, responses: { "200": json("Vaga"), ...erros, "400": invalido, "409": conflito } } },
      "/candidaturas": {
        post: {
          summary: "Criar candidatura numa vaga publicada (escopo escrita; origem integracao). Com currículo, suba o arquivo por PUT na upload_url e chame /concluir; o candidato recebe o link de acompanhamento por e-mail.",
          operationId: "criarCandidatura",
          requestBody: { required: true, content: { "application/json": { schema: ref("CandidaturaEntrada") } } },
          responses: { "201": json("CandidaturaCriada"), "200": { ...json("CandidaturaCriada"), description: "Candidatura repetida (mesmo e-mail na vaga)" }, ...erros, "400": invalido, "404": naoEncontrado, "409": conflito },
        },
      },
      "/candidaturas/{id}/concluir": {
        parameters: [idParam],
        post: {
          summary: "Concluir a candidatura depois do upload (escopo escrita). Idempotente.", operationId: "concluirCandidatura",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["concluir_token"], properties: { concluir_token: { type: "string" } } } } } },
          responses: { "200": { description: "ok", content: { "application/json": { schema: { type: "object", properties: { id: { type: "string" }, recebida: { type: "boolean" } } } } } }, ...erros, "400": invalido },
        },
      },
      "/vagas/{id}/resumo": { parameters: [idParam], get: { summary: "Resumo do funil (contagens)", operationId: "resumoDaVaga", responses: { "200": json("ResumoVaga"), ...erros, "404": naoEncontrado } } },
    },
  };
}
