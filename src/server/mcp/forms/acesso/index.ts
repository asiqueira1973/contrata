// Formulário "Acesso de um membro" (8.2; 10.2 e 13.3; regras 11.24, 11.26 e 11.32): mudar papel e
// áreas, remover, reenviar ou cancelar convite. Só administrador, escopo escrita.
import "server-only";
import { z } from "zod";
import { PAPEL, copy } from "@/lib/copy";
import { PAPEIS } from "@/lib/limits";
import { listAreas } from "@/server/org/areas";
import { listTeam } from "@/server/org/members";
import { acharPorNome, camposDeAcesso, normalizar, schemaDeAcesso } from "../comum";
import type { DefinicaoFormulario } from "../registrar";
import { gravarAcesso } from "./save";

const c = copy.mcp.form.acesso;
const OPERACOES = ["mudar", "remover", "reenviar", "cancelar"] as const;
// Papel só é exigido em "mudar" (o save confere); sem refine, para o fallback poder estender o schema.
export const schemaAcesso = z.object({ membro: z.uuid(), operacao: z.enum(OPERACOES), ...schemaDeAcesso, papel: z.enum(PAPEIS).optional() });

export const formularioAcesso: DefinicaoFormulario<typeof schemaAcesso> = {
  acao: "acesso",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "escrita",
  papel: "administrador",
  entrada: z.object({
    pessoa: z.string().optional().describe("nome ou e-mail do membro ou do convite"),
    operacao: z.enum(OPERACOES).optional().describe("mudar, remover, reenviar ou cancelar"),
    papel: z.enum(PAPEIS).optional().describe("papel novo, para mudar"),
  }),
  async montar(args, ctx) {
    const equipe = await listTeam(ctx.empresa.id);
    const alvo = typeof args.pessoa === "string"
      ? equipe.find((m) => normalizar(m.email) === normalizar(args.pessoa as string)) ?? acharPorNome(equipe.map((m) => ({ ...m, nome: m.nome ?? m.email })), args.pessoa)
      : null;
    const op = typeof args.operacao === "string" ? args.operacao : alvo?.pendente ? "reenviar" : "mudar";
    const quando = [{ campo: "operacao", igual: "mudar" }];
    return {
      campos: [
        { tipo: "select", nome: "membro", rotulo: c.membro, opcoes: "membros", obrigatorio: true },
        { tipo: "radio", nome: "operacao", rotulo: c.operacao, obrigatorio: true, opcoes: OPERACOES.map((o) => ({ valor: o, rotulo: c[o] })) },
        ...camposDeAcesso(quando),
      ],
      valores: {
        membro: alvo?.id ?? "",
        operacao: op,
        papel: typeof args.papel === "string" ? args.papel : alvo?.papel ?? "recrutador",
        todas: alvo && !alvo.todas_areas ? "escolher" : "todas",
        areas: alvo?.areas.map((a) => a.id) ?? [],
      },
      botao: c.botao,
      avisos: [c.aviso],
    };
  },
  async opcoes(ctx) {
    const [equipe, areas] = await Promise.all([listTeam(ctx.empresa.id), listAreas(ctx.empresa.id)]);
    return {
      membros: equipe.map((m) => ({
        valor: m.id,
        rotulo: m.pendente ? `${m.email} (${c.pendente})` : `${m.nome ?? m.email} · ${PAPEL[m.papel].rotulo}`,
        preencher: { papel: m.papel, todas: m.todas_areas ? "todas" : "escolher", areas: m.areas.map((a) => a.id), operacao: m.pendente ? "reenviar" : "mudar" },
      })),
      areas: areas.map((a) => ({ valor: a.id, rotulo: a.nome })),
    };
  },
  schema: schemaAcesso,
  gravar: gravarAcesso,
  fallback: true,
};
