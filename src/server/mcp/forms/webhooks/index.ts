// Formulário "Webhooks" (8.8; 11.17, 13.3, 13.4): só administrador, escopo escrita. Criar, editar
// (endereço, eventos, ligado), remover, gerar novo segredo e enviar teste. Tem fallback com prévia,
// mas criar, trocar o endereço e gerar segredo ficam só no formulário: o endereço é para onde os
// dados da empresa vão, e um modelo enganado por texto malicioso não escolhe esse destino (13.5).
import "server-only";
import { z } from "zod";
import { EVENTOS_WEBHOOK, copy } from "@/lib/copy";
import { WEBHOOK_URL_MAX } from "@/lib/limits";
import { listWebhooks } from "@/server/webhooks/settings";
import type { DefinicaoFormulario } from "../registrar";
import { gravarWebhooks, hostDe } from "./save";

const c = copy.mcp.form.webhooks;
const OPERACOES = ["criar", "editar", "remover", "gerar_segredo", "enviar_teste"] as const;
export const schemaWebhooks = z.object({
  operacao: z.enum(OPERACOES),
  webhook: z.uuid().optional(),
  url: z.string().trim().max(WEBHOOK_URL_MAX).optional(),
  eventos: z.array(z.enum(EVENTOS_WEBHOOK)).optional(),
  ativo: z.boolean().optional(),
});

export const formularioWebhooks: DefinicaoFormulario<typeof schemaWebhooks> = {
  acao: "webhooks",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "escrita",
  papel: "administrador",
  entrada: z.object({
    operacao: z.enum(OPERACOES).optional().describe("criar, editar, remover, gerar_segredo ou enviar_teste"),
    url: z.string().optional().describe("endereço https do webhook (para criar, ou o existente, para escolher qual)"),
    eventos: z.array(z.string()).optional().describe("tipos do catálogo, ex.: candidatura.contratada"),
  }),
  async montar(args, ctx) {
    const lista = await listWebhooks(ctx);
    const url = typeof args.url === "string" ? args.url.trim() : "";
    const achado = lista.find((w) => w.url === url) ?? (lista.length === 1 ? lista[0] : undefined);
    const op = typeof args.operacao === "string" ? args.operacao : achado && !url ? "editar" : "criar";
    const eventos = Array.isArray(args.eventos) ? args.eventos.filter((e): e is string => (EVENTOS_WEBHOOK as readonly string[]).includes(e as string)) : null;
    const existente = [{ campo: "operacao", igual: ["editar", "remover", "gerar_segredo", "enviar_teste"] }];
    const escreve = [{ campo: "operacao", igual: ["criar", "editar"] }];
    const usaAchado = op !== "criar" && achado;
    return {
      campos: [
        { tipo: "radio", nome: "operacao", rotulo: c.operacao, obrigatorio: true, opcoes: OPERACOES.map((o) => ({ valor: o, rotulo: c[o] })) },
        { tipo: "select", nome: "webhook", rotulo: c.webhook, opcoes: "webhooks", obrigatorio: true, mostrarSe: existente },
        { tipo: "texto", nome: "url", rotulo: c.url, dica: c.urlDica, max: WEBHOOK_URL_MAX, mostrarSe: escreve },
        { tipo: "multipla", nome: "eventos", rotulo: c.eventos, opcoes: EVENTOS_WEBHOOK.map((e) => ({ valor: e, rotulo: c.eventosRotulos[e], dica: e })), mostrarSe: escreve },
        { tipo: "marcar", nome: "ativo", rotulo: c.ativo, mostrarSe: escreve },
      ],
      valores: {
        operacao: op,
        webhook: usaAchado ? achado.id : "",
        // O endereço salvo não volta ao modelo (o caminho pode ter um segredo do serviço): vazio
        // mantém o atual; ao escolher outro webhook no formulário, as opções (só do app) preenchem.
        url: usaAchado ? "" : url,
        eventos: eventos ?? (usaAchado ? achado.eventos : []),
        ativo: usaAchado ? achado.ativo : true,
      },
      botao: c.botao,
    };
  },
  async opcoes(ctx) {
    const lista = await listWebhooks(ctx);
    return {
      webhooks: lista.map((w) => ({ valor: w.id, rotulo: c.rotulo(hostDe(w.url), w.ativo), dica: w.eventos.length + " eventos", preencher: { url: w.url, eventos: w.eventos, ativo: w.ativo } })),
    };
  },
  schema: schemaWebhooks,
  gravar: gravarWebhooks,
  fallback: true,
  // Criar, gerar segredo e trocar o endereço: só com o clique no formulário (decisão do 8.8).
  soNoFormulario: (d) => d.operacao === "criar" || d.operacao === "gerar_segredo" || (d.operacao === "editar" && !!d.url),
};
