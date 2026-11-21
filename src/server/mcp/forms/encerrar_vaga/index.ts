// Formulário "Encerrar vaga" (8.3; 12.1, matriz da seção 5): rascunho, publicada ou pausada →
// encerrada, com motivo, quando não há candidatura em andamento. Encerrada não muda mais.
// Recrutador+, escopo decisao. Sem fallback: é irreversível, e sem formulário o próprio modelo
// confirmaria (mesmo motivo da 13.5 para decisões). Com candidaturas em andamento, o domínio
// recusa: é decisão, com devolutiva (11.5, 11.7; formulário de decisões, 8.6).
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { MOTIVOS_ENCERRAMENTO } from "@/lib/limits";
import { listJobs } from "@/server/recruiting/jobs";
import { acharVaga } from "../../vagas";
import type { DefinicaoFormulario } from "../registrar";
import { gravarEncerramento } from "./save";

const c = copy.mcp.form.encerrar_vaga;
export const schemaEncerrar = z.object({ vaga: z.uuid(), motivo: z.enum(MOTIVOS_ENCERRAMENTO), confirmar: z.boolean().optional() });

export const formularioEncerrarVaga: DefinicaoFormulario<typeof schemaEncerrar> = {
  acao: "encerrar_vaga",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "decisao",
  papel: "recrutador",
  entrada: z.object({
    vaga: z.string().optional().describe("título ou id da vaga"),
    motivo: z.enum(MOTIVOS_ENCERRAMENTO).optional().describe("preenchida, cancelada ou outro"),
  }),
  async montar(args, ctx) {
    const achada = await acharVaga(ctx, args.vaga);
    return {
      campos: [
        { tipo: "select", nome: "vaga", rotulo: c.vaga, opcoes: "vagas", obrigatorio: true },
        { tipo: "radio", nome: "motivo", rotulo: c.motivo, obrigatorio: true, opcoes: MOTIVOS_ENCERRAMENTO.map((m) => ({ valor: m, rotulo: c.motivos[m] })) },
        { tipo: "confirmar", nome: "confirmar", rotulo: c.confirmar, frase: c.confirmar, obrigatorio: true },
      ],
      valores: { vaga: achada && achada.status !== "encerrada" ? achada.id : "", motivo: typeof args.motivo === "string" ? args.motivo : "", confirmar: false },
      botao: c.botao,
    };
  },
  async opcoes(ctx) {
    const { itens } = await listJobs(ctx, {}, { inicio: 0, limite: 200 });
    return { vagas: itens.filter((v) => v.status !== "encerrada").map((v) => ({ valor: v.id, rotulo: v.titulo })) };
  },
  schema: schemaEncerrar,
  gravar: gravarEncerramento,
  fallback: false,
};
