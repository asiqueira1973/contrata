// Formulário "Publicar vaga" (8.3; 12.1, 11.1): rascunho ou pausada → publicada. Mostra o que falta
// pela 11.1 e avisa quando a página de carreiras ainda não está publicada. Recrutador+, escrita.
import "server-only";
import { z } from "zod";
import { ERROS, copy } from "@/lib/copy";
import { faltasParaPublicar } from "@/lib/schemas/jobs";
import { empresaPorSlug } from "@/server/careers/public";
import { getJob, listJobs } from "@/server/recruiting/jobs";
import { acharVaga } from "../../vagas";
import type { DefinicaoFormulario } from "../registrar";
import { gravarPublicacao } from "./save";

const c = copy.mcp.form.publicar_vaga;
export const schemaPublicar = z.object({ vaga: z.uuid() });

export const formularioPublicarVaga: DefinicaoFormulario<typeof schemaPublicar> = {
  acao: "publicar_vaga",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "escrita",
  papel: "recrutador",
  entrada: z.object({ vaga: z.string().optional().describe("título ou id da vaga") }),
  async montar(args, ctx) {
    const achada = await acharVaga(ctx, args.vaga);
    const avisos: string[] = [];
    if (achada) {
      const faltas = faltasParaPublicar(await getJob(ctx, achada.id));
      if (faltas.length) avisos.push(c.falta(faltas.map((f) => ERROS[f.codigo]).join(" ")));
    }
    if (!(await empresaPorSlug(ctx.empresa.slug))?.pagina_publicada) avisos.push(c.paginaNaoPublicada);
    return {
      campos: [{ tipo: "select", nome: "vaga", rotulo: c.vaga, opcoes: "vagas", obrigatorio: true }],
      valores: { vaga: achada && (achada.status === "rascunho" || achada.status === "pausada") ? achada.id : "" },
      botao: c.botao,
      ...(avisos.length ? { avisos } : {}),
    };
  },
  async opcoes(ctx) {
    const { itens } = await listJobs(ctx, {}, { inicio: 0, limite: 200 });
    return { vagas: itens.filter((v) => v.status === "rascunho" || v.status === "pausada").map((v) => ({ valor: v.id, rotulo: v.titulo })) };
  },
  schema: schemaPublicar,
  gravar: gravarPublicacao,
  fallback: true,
};
