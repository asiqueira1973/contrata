// Formulário "Convidar para a equipe" (8.2; seções 10.2 e 13.3; regras 11.24 e 11.32).
// Só administrador, escopo escrita. O modelo preenche e-mail, papel e áreas ditos na conversa.
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { PAPEIS } from "@/lib/limits";
import { listAreas } from "@/server/org/areas";
import { acharPorNome, camposDeAcesso, schemaDeAcesso } from "../comum";
import type { DefinicaoFormulario } from "../registrar";
import { gravarConvite } from "./save";

const c = copy.mcp.form.convite;
export const schemaConvite = z.object({ email: z.string().trim().max(254), ...schemaDeAcesso });

export const formularioConvite: DefinicaoFormulario<typeof schemaConvite> = {
  acao: "convite",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "escrita",
  papel: "administrador",
  entrada: z.object({
    email: z.string().optional().describe("e-mail da pessoa convidada"),
    papel: z.enum(PAPEIS).optional().describe("administrador, recrutador ou avaliador"),
    areas: z.array(z.string()).optional().describe("nomes das áreas, só para recrutador limitado a algumas áreas"),
  }),
  async montar(args, ctx) {
    const areas = await listAreas(ctx.empresa.id);
    const nomes = Array.isArray(args.areas) ? args.areas : [];
    const ids = nomes.map((n) => acharPorNome(areas, n)?.id).filter((x): x is string => !!x);
    return {
      campos: [{ tipo: "email", nome: "email", rotulo: c.email, obrigatorio: true }, ...camposDeAcesso()],
      valores: { email: typeof args.email === "string" ? args.email : "", papel: typeof args.papel === "string" ? args.papel : "recrutador", todas: ids.length ? "escolher" : "todas", areas: ids },
      botao: c.botao,
    };
  },
  async opcoes(ctx) {
    return { areas: (await listAreas(ctx.empresa.id)).map((a) => ({ valor: a.id, rotulo: a.nome })) };
  },
  schema: schemaConvite,
  gravar: gravarConvite,
  fallback: true,
};
