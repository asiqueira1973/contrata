// salvar_decisoes (8.6; 11.7): o clique do membro confirma cada item (o ator é o membro, origem
// formulario). Cada item é independente; o banco confere de novo a devolutiva de 20+ (11.5), o
// alvo e quem age. Itens que falham voltam com o motivo, sem desfazer os que deram certo.
import "server-only";
import type { z } from "zod";
import { ERROS, copy } from "@/lib/copy";
import { CamposInvalidos } from "@/server/http";
import { decideNow, type ItemDecisao } from "@/server/recruiting/decisions";
import type { ContextoFormulario } from "../registrar";
import type { schemaDecisoes } from "./index";

export async function gravarDecisoes(dados: z.infer<typeof schemaDecisoes>, ctx: ContextoFormulario) {
  // Monta os itens; falta de campo obrigatório volta marcada no item ("itens.<i>.<campo>").
  const faltas: { campo: string; codigo: string }[] = [];
  const itens = dados.itens.map((i, n): Exclude<ItemDecisao, { tipo: "enviar_mensagem" }> => {
    const texto = { assunto: (i.assunto ?? "").trim() || copy.modelos.devolutiva_padrao.assunto, corpo: (i.texto ?? "").trim() };
    if (i.tipo === "reprovar") {
      if (!i.motivo) faltas.push({ campo: `itens.${n}.motivo`, codigo: "campo_obrigatorio" });
      if (texto.corpo.length < 20) faltas.push({ campo: `itens.${n}.texto`, codigo: "devolutiva_obrigatoria" });
      return { tipo: "reprovar", candidatura: i.candidatura!, motivo: (i.motivo || "outro") as never, texto };
    }
    if (i.tipo === "encerrar_vaga") {
      if (texto.corpo.length < 20) faltas.push({ campo: `itens.${n}.texto`, codigo: "devolutiva_obrigatoria" });
      return { tipo: "encerrar_vaga", vaga: i.vaga!, motivo_encerramento: (i.motivo_encerramento || "outro") as never, texto };
    }
    if (i.tipo === "contratar") return { tipo: "contratar", candidatura: i.candidatura!, texto: texto.corpo ? texto : null };
    return { tipo: "reabrir", candidatura: i.candidatura! };
  });
  if (faltas.length) throw new CamposInvalidos(faltas);
  const r = await decideNow(ctx, itens);
  const ok = r.filter((x) => x.ok).length;
  const falhas = r.flatMap((x, n) => (x.ok ? [] : [`${n + 1}: ${ERROS[x.codigo] ?? ERROS.generico}`]));
  if (!ok) throw new CamposInvalidos(r.map((x, n) => (x.ok ? null : { campo: `itens.${n}.texto`, codigo: x.codigo })).filter((x): x is { campo: string; codigo: string } => !!x));
  return { ok: true as const, ids: [], resumo: copy.mcp.form.decisoes.resumo(ok, falhas) };
}
