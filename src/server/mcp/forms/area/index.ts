// Formulário "Áreas" (8.2; 10.2 e 13.3; 7.4 e 11.32): criar, renomear e trocar responsável,
// arquivar. Só administrador, escopo escrita.
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { AREA_NOME_MAX } from "@/lib/limits";
import { listAreas } from "@/server/org/areas";
import { listPeople } from "@/server/org/people";
import { acharPorNome } from "../comum";
import type { DefinicaoFormulario } from "../registrar";
import { gravarArea } from "./save";

const c = copy.mcp.form.area;
const OPERACOES = ["criar", "editar", "arquivar"] as const;
export const schemaArea = z.object({
  operacao: z.enum(OPERACOES),
  area: z.uuid().optional(),
  nome: z.string().trim().max(AREA_NOME_MAX).optional(),
  responsavel: z.union([z.uuid(), z.literal("")]).optional(),
});

export const formularioArea: DefinicaoFormulario<typeof schemaArea> = {
  acao: "area",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "escrita",
  papel: "administrador",
  entrada: z.object({
    operacao: z.enum(OPERACOES).optional().describe("criar, editar ou arquivar"),
    area: z.string().optional().describe("nome da área existente, para editar ou arquivar"),
    nome: z.string().optional().describe("nome da área (novo nome, ao editar)"),
    responsavel: z.string().optional().describe("nome da pessoa responsável pela área"),
  }),
  async montar(args, ctx) {
    const [areas, pessoas] = await Promise.all([listAreas(ctx.empresa.id), listPeople(ctx.empresa.id)]);
    const area = acharPorNome(areas, args.area);
    const resp = acharPorNome(pessoas, args.responsavel);
    const op = typeof args.operacao === "string" ? args.operacao : area ? "editar" : "criar";
    const edita = [{ campo: "operacao", igual: ["editar", "arquivar"] }];
    const escreve = [{ campo: "operacao", igual: ["criar", "editar"] }];
    return {
      campos: [
        { tipo: "radio", nome: "operacao", rotulo: c.operacao, obrigatorio: true, opcoes: OPERACOES.map((o) => ({ valor: o, rotulo: c[o] })) },
        { tipo: "select", nome: "area", rotulo: c.area, opcoes: "areas", obrigatorio: true, mostrarSe: edita },
        { tipo: "texto", nome: "nome", rotulo: c.nome, obrigatorio: true, max: AREA_NOME_MAX, mostrarSe: escreve },
        { tipo: "select", nome: "responsavel", rotulo: c.responsavel, opcoes: "pessoas", vazio: c.semResponsavel, mostrarSe: escreve },
      ],
      valores: {
        operacao: op,
        area: area?.id ?? "",
        nome: typeof args.nome === "string" ? args.nome : area?.nome ?? "",
        responsavel: resp?.id ?? area?.responsavel?.id ?? "",
      },
      botao: c.botao,
    };
  },
  async opcoes(ctx) {
    const [areas, pessoas] = await Promise.all([listAreas(ctx.empresa.id), listPeople(ctx.empresa.id)]);
    return {
      areas: areas.map((a) => ({ valor: a.id, rotulo: a.nome, preencher: { nome: a.nome, responsavel: a.responsavel?.id ?? "" } })),
      pessoas: pessoas.map((p) => ({ valor: p.id, rotulo: p.nome })),
    };
  },
  schema: schemaArea,
  gravar: gravarArea,
  fallback: true,
};
