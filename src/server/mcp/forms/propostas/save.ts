// salvar_propostas (8.6; 11.7, 12.3): o clique do membro confirma ou descarta cada proposta (o
// ator é o membro). A que perdeu o alvo vira expirada com o motivo, sem derrubar as outras.
import "server-only";
import type { z } from "zod";
import { ERROS, copy } from "@/lib/copy";
import { CamposInvalidos } from "@/server/http";
import { confirmProposals } from "@/server/recruiting/decisions";
import type { ContextoFormulario } from "../registrar";
import type { schemaPropostas } from "./index";

export async function gravarPropostas(dados: z.infer<typeof schemaPropostas>, ctx: ContextoFormulario) {
  const r = await confirmProposals(ctx, dados.itens.map((i) => ({
    decisao: i.decisao, acao: i.acao, motivo: i.motivo ?? null,
    // O texto do formulário vai sempre que veio (apagado também: contratar sem mensagem).
    texto: i.acao === "confirmar" && i.texto !== undefined ? { assunto: (i.assunto ?? "").trim() || copy.modelos.devolutiva_padrao.assunto, corpo: i.texto.trim() } : null,
  })));
  const conf = r.filter((x, n) => x.ok && dados.itens[n].acao === "confirmar").length;
  const desc = r.filter((x, n) => x.ok && dados.itens[n].acao === "descartar").length;
  const expiradas = r.flatMap((x, n) => ("motivo" in x && x.codigo === "expirada" ? [`${n + 1}: ${copy.decisoes.motivosExpirada[x.motivo] ?? x.motivo}`] : []));
  const erros = r.flatMap((x, n) => (!x.ok && x.codigo !== "expirada" ? [{ campo: `itens.${n}.texto`, codigo: x.codigo }] : []));
  if (!conf && !desc && !expiradas.length) throw new CamposInvalidos(erros);
  const resumo = copy.mcp.form.propostas.resumo(conf, desc, expiradas) + (erros.length ? ` ${erros.map((e) => ERROS[e.codigo] ?? ERROS.generico).join(" ")}` : "");
  return { ok: true as const, ids: [], resumo };
}
