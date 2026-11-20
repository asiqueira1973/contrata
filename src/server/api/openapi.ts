// Documento OpenAPI 3.1 da API v1 (seção 13.2, critério 8.2), montado dos schemas zod de resposta
// (z.toJSONSchema), para o documento não divergir do que as rotas devolvem. Cresce a cada épico.
import "server-only";
import { z } from "zod";
import { NOME_PRODUTO } from "@/lib/copy";
import { siteOrigin } from "@/server/oauth/server";
import { AreaV1, EmpresaV1, Erro, ListaAreas, ListaPessoas, PessoaV1 } from "./v1";

const schemas = { Erro, Empresa: EmpresaV1, Area: AreaV1, Pessoa: PessoaV1, ListaAreas, ListaPessoas };

function componentes() {
  const out: Record<string, unknown> = {};
  for (const [nome, s] of Object.entries(schemas)) {
    const json = z.toJSONSchema(s, { target: "draft-2020-12", unrepresentable: "any", reused: "inline" }) as Record<string, unknown>;
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
    },
  };
}
