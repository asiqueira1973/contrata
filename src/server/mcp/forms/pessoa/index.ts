// Formulário "Pessoas da empresa" (8.2; 10.2 e 13.3; 7.3, 7.4 e 11.31): cadastrar e editar
// (recrutador e administrador), arquivar e dar acesso (administrador). Escopo escrita.
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { CARGO_MAX, PAPEIS, PESSOA_NOME_MAX } from "@/lib/limits";
import { listAreas } from "@/server/org/areas";
import { listPeople } from "@/server/org/people";
import { acharPorNome, camposDeAcesso, normalizar, schemaDeAcesso } from "../comum";
import type { DefinicaoFormulario } from "../registrar";
import { gravarPessoa } from "./save";

const c = copy.mcp.form.pessoa;
const OPERACOES = ["cadastrar", "editar", "arquivar", "dar_acesso"] as const;
export const schemaPessoa = z.object({
  operacao: z.enum(OPERACOES),
  pessoa: z.uuid().optional(),
  nome: z.string().trim().max(PESSOA_NOME_MAX).optional(),
  email: z.string().trim().max(254).optional(),
  cargo: z.string().trim().max(CARGO_MAX).optional(),
  area: z.union([z.uuid(), z.literal("")]).optional(),
  recebe_resumo: z.boolean().optional(),
  ...schemaDeAcesso,
  papel: z.enum(PAPEIS).optional(),
});

const rotulos: Record<(typeof OPERACOES)[number], string> = { cadastrar: c.cadastrar, editar: c.editar, arquivar: c.arquivar, dar_acesso: c.darAcesso };

export const formularioPessoa: DefinicaoFormulario<typeof schemaPessoa> = {
  acao: "pessoa",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "escrita",
  papel: "recrutador",
  entrada: z.object({
    operacao: z.enum(OPERACOES).optional().describe("cadastrar, editar, arquivar ou dar_acesso"),
    pessoa: z.string().optional().describe("nome ou e-mail de uma pessoa já cadastrada"),
    nome: z.string().optional(),
    email: z.string().optional(),
    cargo: z.string().optional(),
    area: z.string().optional().describe("nome da área"),
  }),
  async montar(args, ctx) {
    const [pessoas, areas] = await Promise.all([listPeople(ctx.empresa.id), listAreas(ctx.empresa.id)]);
    const alvo = typeof args.pessoa === "string" ? pessoas.find((p) => normalizar(p.email) === normalizar(args.pessoa as string)) ?? acharPorNome(pessoas, args.pessoa) : null;
    const area = acharPorNome(areas, args.area);
    const admin = ctx.membro.papel === "administrador";
    const ops = OPERACOES.filter((o) => admin || o === "cadastrar" || o === "editar");
    const op = typeof args.operacao === "string" && (ops as readonly string[]).includes(args.operacao) ? args.operacao : alvo ? "editar" : "cadastrar";
    const escolhe = [{ campo: "operacao", igual: ["editar", "arquivar", "dar_acesso"] }];
    const escreve = [{ campo: "operacao", igual: ["cadastrar", "editar"] }];
    return {
      campos: [
        { tipo: "radio", nome: "operacao", rotulo: c.operacao, obrigatorio: true, opcoes: ops.map((o) => ({ valor: o, rotulo: rotulos[o] })) },
        { tipo: "select", nome: "pessoa", rotulo: c.pessoa, opcoes: "pessoas", obrigatorio: true, mostrarSe: escolhe },
        { tipo: "texto", nome: "nome", rotulo: c.nome, obrigatorio: true, max: PESSOA_NOME_MAX, mostrarSe: escreve },
        { tipo: "email", nome: "email", rotulo: c.email, obrigatorio: true, mostrarSe: escreve },
        { tipo: "texto", nome: "cargo", rotulo: c.cargo, max: CARGO_MAX, mostrarSe: escreve },
        { tipo: "select", nome: "area", rotulo: c.area, opcoes: "areas", vazio: c.semArea, mostrarSe: escreve },
        { tipo: "marcar", nome: "recebe_resumo", rotulo: c.recebeResumo, mostrarSe: escreve },
        ...(admin ? camposDeAcesso([{ campo: "operacao", igual: "dar_acesso" }]) : []),
      ],
      valores: {
        operacao: op,
        pessoa: alvo?.id ?? "",
        nome: typeof args.nome === "string" ? args.nome : alvo?.nome ?? "",
        email: typeof args.email === "string" ? args.email : alvo?.email ?? "",
        cargo: typeof args.cargo === "string" ? args.cargo : alvo?.cargo ?? "",
        area: area?.id ?? alvo?.area?.id ?? "",
        recebe_resumo: alvo?.recebe_resumo ?? true,
        papel: "avaliador",
        todas: "todas",
        areas: [],
      },
      botao: c.botao,
    };
  },
  async opcoes(ctx) {
    const [pessoas, areas] = await Promise.all([listPeople(ctx.empresa.id), listAreas(ctx.empresa.id)]);
    return {
      pessoas: pessoas.map((p) => ({ valor: p.id, rotulo: p.cargo ? `${p.nome} · ${p.cargo}` : p.nome, preencher: { nome: p.nome, email: p.email, cargo: p.cargo ?? "", area: p.area?.id ?? "", recebe_resumo: p.recebe_resumo } })),
      areas: areas.map((a) => ({ valor: a.id, rotulo: a.nome })),
    };
  },
  schema: schemaPessoa,
  gravar: gravarPessoa,
  fallback: true,
  // Cadastrar, editar e arquivar têm fallback; dar acesso, não (13.5, decisão de 20/11/2026).
  soNoFormulario: (d) => d.operacao === "dar_acesso",
};
