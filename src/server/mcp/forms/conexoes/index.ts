// Formulário "Conexões e chaves de API" (8.2; 6.3, 11.15, 11.16; seção 5). Qualquer membro revoga as
// próprias conexões (escopo leitura basta: desconectar não muda dado da empresa); o administrador,
// com conexão de escrita, vê todas, cria chaves (com no máximo os escopos da conexão) e revoga.
// Sem fallback: a chave só pode aparecer no formulário.
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { CREDENCIAL_NOME_MAX, ESCOPOS } from "@/lib/limits";
import { listCredentials } from "@/server/credentials/manage";
import type { DefinicaoFormulario } from "../registrar";
import { gravarConexoes, propria } from "./save";

const c = copy.mcp.form.conexoes;
const OPERACOES = ["revogar", "criar_chave"] as const;
export const schemaConexoes = z.object({
  operacao: z.enum(OPERACOES),
  credencial: z.uuid().optional(),
  nome: z.string().trim().max(CREDENCIAL_NOME_MAX).optional(),
  escopos: z.array(z.enum(ESCOPOS)).optional(),
});

export const formularioConexoes: DefinicaoFormulario<typeof schemaConexoes> = {
  acao: "conexoes",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "leitura",
  papel: "avaliador",
  entrada: z.object({ operacao: z.enum(OPERACOES).optional().describe("revogar ou criar_chave") }),
  async montar(args, ctx) {
    const admin = ctx.membro.papel === "administrador" && ctx.escopos.includes("escrita");
    const ops = admin ? OPERACOES : (["revogar"] as const);
    return {
      campos: [
        { tipo: "radio", nome: "operacao", rotulo: c.operacao, obrigatorio: true, opcoes: ops.map((o) => ({ valor: o, rotulo: o === "revogar" ? c.revogar : c.criarChave })) },
        { tipo: "select", nome: "credencial", rotulo: c.credencial, opcoes: "credenciais", obrigatorio: true, mostrarSe: [{ campo: "operacao", igual: "revogar" }] },
        { tipo: "texto", nome: "nome", rotulo: c.nome, obrigatorio: true, max: CREDENCIAL_NOME_MAX, mostrarSe: [{ campo: "operacao", igual: "criar_chave" }] },
        { tipo: "multipla", nome: "escopos", rotulo: c.escopos, opcoes: ESCOPOS.filter((e) => ctx.escopos.includes(e)).map((e) => ({ valor: e, rotulo: copy.oauth.escopo[e] })), mostrarSe: [{ campo: "operacao", igual: "criar_chave" }] },
      ],
      valores: { operacao: admin && args.operacao === "criar_chave" ? "criar_chave" : "revogar", credencial: "", nome: "", escopos: ["leitura"] },
      botao: c.botao,
    };
  },
  async opcoes(ctx) {
    const escrita = ctx.escopos.includes("escrita");
    const lista = (await listCredentials(ctx)).filter((k) => escrita || propria(k, ctx));
    return {
      credenciais: lista.map((k) => ({ valor: k.id, rotulo: k.tipo === "api" ? c.chave(k.nome, k.prefixo) : c.conexao(k.nome, k.membro?.nome ?? "") })),
    };
  },
  schema: schemaConexoes,
  gravar: gravarConexoes,
  fallback: false,
};
