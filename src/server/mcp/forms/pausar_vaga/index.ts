// Formulário "Pausar vaga" (8.3; 12.1): publicada → pausada. Sai da página pública e para de
// receber candidaturas; o processo continua. Recrutador+, escrita.
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { listJobs } from "@/server/recruiting/jobs";
import { acharVaga } from "../../vagas";
import type { DefinicaoFormulario } from "../registrar";
import { gravarPausa } from "./save";

const c = copy.mcp.form.pausar_vaga;
export const schemaPausar = z.object({ vaga: z.uuid() });

export const formularioPausarVaga: DefinicaoFormulario<typeof schemaPausar> = {
  acao: "pausar_vaga",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "escrita",
  papel: "recrutador",
  entrada: z.object({ vaga: z.string().optional().describe("título ou id da vaga") }),
  async montar(args, ctx) {
    const achada = await acharVaga(ctx, args.vaga);
    return {
      campos: [{ tipo: "select", nome: "vaga", rotulo: c.vaga, opcoes: "vagas", obrigatorio: true }],
      valores: { vaga: achada?.status === "publicada" ? achada.id : "" },
      botao: c.botao,
    };
  },
  async opcoes(ctx) {
    const { itens } = await listJobs(ctx, { status: "publicada" }, { inicio: 0, limite: 200 });
    return { vagas: itens.map((v) => ({ valor: v.id, rotulo: v.titulo })) };
  },
  schema: schemaPausar,
  gravar: gravarPausa,
  fallback: true,
};
