// Formulário "Página de carreiras" (8.3, parte do formulário da empresa do 8.9): publicar ou tirar
// do ar a página da empresa. Enquanto não está publicada, mostra o link de pré-visualização
// assinado de 10 min. Só administrador (seção 5), escopo escrita. Sem fallback.
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import { linkDePrevia } from "@/server/careers/preview";
import { empresaPorSlug } from "@/server/careers/public";
import { siteOrigin } from "@/server/oauth/server";
import type { DefinicaoFormulario } from "../registrar";
import { gravarPagina } from "./save";

const c = copy.mcp.form.pagina_de_carreiras;
const OPERACOES = ["publicar", "despublicar"] as const;
export const schemaPagina = z.object({ operacao: z.enum(OPERACOES) });

export const formularioPaginaDeCarreiras: DefinicaoFormulario<typeof schemaPagina> = {
  acao: "pagina_de_carreiras",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "escrita",
  papel: "administrador",
  entrada: z.object({ operacao: z.enum(OPERACOES).optional().describe("publicar ou despublicar") }),
  async montar(args, ctx) {
    const empresa = await empresaPorSlug(ctx.empresa.slug);
    const site = siteOrigin();
    const publicada = !!empresa?.pagina_publicada;
    return {
      campos: [{ tipo: "radio", nome: "operacao", rotulo: c.operacao, obrigatorio: true, opcoes: OPERACOES.map((o) => ({ valor: o, rotulo: c[o] })) }],
      valores: { operacao: typeof args.operacao === "string" ? args.operacao : publicada ? "despublicar" : "publicar" },
      botao: c.botao,
      avisos: [publicada ? c.estadoPublicada(`${site}/${ctx.empresa.slug}`) : c.estadoNaoPublicada(linkDePrevia(site, ctx.empresa.slug, ctx.empresa.id))],
    };
  },
  async opcoes() {
    return {};
  },
  schema: schemaPagina,
  gravar: gravarPagina,
  fallback: false,
};
