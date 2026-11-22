// Formulário "Empresa" (8.9; 10.2, 11.12, 11.20, 13.3, 15.5): dados, visual, retenção, banco de
// talentos, mensagens das integrações e texto extra do aviso. Só administrador, escopo escrita.
// Tem fallback (registrar_empresa), mas o logo (arquivo) e trocar as mensagens das integrações
// para "direto" (chaves de API escrevendo ao candidato sem confirmação) são só no formulário.
import "server-only";
import { z } from "zod";
import { ERROS, copy } from "@/lib/copy";
import {
  AVISO_EXTRA_MAX, COR_MAX, EMAIL_MAX, EMPRESA_DESCRICAO_MAX, EMPRESA_NOME_MAX, LOGO_MAX_BYTES, NOME_ARQUIVO_MAX, RETENCAO_DIAS_MAX,
  RETENCAO_DIAS_MIN, SITE_URL_MAX, TALENTOS_MESES_MAX, TALENTOS_MESES_MIN,
} from "@/lib/limits";
import { companySettings } from "@/server/org/companies";
import type { DefinicaoFormulario } from "../registrar";
import { gravarEmpresa } from "./save";

const c = copy.mcp.form.empresa;
export const LOGO_BASE64_MAX = Math.ceil((LOGO_MAX_BYTES * 4) / 3) + 16;
const TIPOS_LOGO = ["image/png", "image/jpeg", "image/svg+xml"];
const inteiro = z.union([z.number().int(), z.string().trim().regex(/^\d{1,3}$/)]).transform((v) => Number(v));

export const schemaEmpresa = z.object({
  nome: z.string().trim().max(EMPRESA_NOME_MAX).optional(),
  descricao: z.string().trim().max(EMPRESA_DESCRICAO_MAX).optional(),
  site_url: z.string().trim().max(SITE_URL_MAX).optional(),
  email_contato: z.string().trim().max(EMAIL_MAX).optional(),
  cor_destaque: z.string().trim().max(COR_MAX).optional(),
  pagina_publicada: z.boolean().optional(),
  logo: z.union([z.object({ nome: z.string().max(NOME_ARQUIVO_MAX), tipo: z.string().max(120), base64: z.string() }), z.literal("")]).optional(),
  remover_logo: z.boolean().optional(),
  retencao_dias: inteiro.optional(),
  talentos_meses: inteiro.optional(),
  mensagens_agente: z.enum(["confirmar", "direto"]).optional(),
  aviso_privacidade_extra: z.string().max(AVISO_EXTRA_MAX).optional(),
});

export const formularioEmpresa: DefinicaoFormulario<typeof schemaEmpresa> = {
  acao: "empresa",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "escrita",
  papel: "administrador",
  entrada: z.object({
    nome: z.string().optional(),
    descricao: z.string().optional(),
    site_url: z.string().optional(),
    email_contato: z.string().optional(),
    cor_destaque: z.string().optional().describe("#rrggbb"),
    retencao_dias: z.number().optional(),
    talentos_meses: z.number().optional(),
    aviso_privacidade_extra: z.string().optional(),
  }),
  async montar(args, ctx) {
    const e = await companySettings(ctx.empresa.id);
    const texto = (k: string, atual: string | null) => (typeof args[k] === "string" ? (args[k] as string) : atual ?? "");
    const numero = (k: string, atual: number) => (typeof args[k] === "number" ? String(args[k]) : String(atual));
    return {
      campos: [
        { tipo: "texto", nome: "nome", rotulo: c.nome, obrigatorio: true, max: EMPRESA_NOME_MAX },
        { tipo: "textarea", nome: "descricao", rotulo: c.descricaoCampo, max: EMPRESA_DESCRICAO_MAX },
        { tipo: "texto", nome: "site_url", rotulo: c.site, max: SITE_URL_MAX },
        { tipo: "email", nome: "email_contato", rotulo: c.email, obrigatorio: true, max: EMAIL_MAX },
        { tipo: "cor", nome: "cor_destaque", rotulo: c.cor, dica: c.corDica },
        {
          tipo: "arquivo", nome: "logo", rotulo: c.logo, dica: e.logo_url ? c.logoAtual : undefined, aceita: ".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml",
          tipos: TIPOS_LOGO, maxBytes: LOGO_MAX_BYTES, erroTipo: ERROS.logo_invalido, remover: c.removerArquivo,
        },
        ...(e.logo_url ? [{ tipo: "marcar" as const, nome: "remover_logo", rotulo: c.removerLogo }] : []),
        { tipo: "marcar", nome: "pagina_publicada", rotulo: c.publicada },
        { tipo: "numero", nome: "retencao_dias", rotulo: c.retencao, dica: c.retencaoDica, obrigatorio: true, min: RETENCAO_DIAS_MIN, max: RETENCAO_DIAS_MAX, passo: 1 },
        { tipo: "numero", nome: "talentos_meses", rotulo: c.talentos, dica: c.talentosDica, obrigatorio: true, min: TALENTOS_MESES_MIN, max: TALENTOS_MESES_MAX, passo: 1 },
        { tipo: "radio", nome: "mensagens_agente", rotulo: c.mensagens, opcoes: [{ valor: "confirmar", rotulo: c.mensagensConfirmar }, { valor: "direto", rotulo: c.mensagensDireto }] },
        { tipo: "textarea", nome: "aviso_privacidade_extra", rotulo: c.avisoExtra, dica: c.avisoExtraDica, max: AVISO_EXTRA_MAX },
      ],
      valores: {
        nome: texto("nome", e.nome), descricao: texto("descricao", e.descricao), site_url: texto("site_url", e.site_url),
        email_contato: texto("email_contato", e.email_contato), cor_destaque: texto("cor_destaque", e.cor_destaque),
        logo: "", remover_logo: false, pagina_publicada: e.pagina_publicada,
        retencao_dias: numero("retencao_dias", e.retencao_dias), talentos_meses: numero("talentos_meses", e.talentos_meses),
        mensagens_agente: e.mensagens_agente, aviso_privacidade_extra: texto("aviso_privacidade_extra", e.aviso_privacidade_extra),
      },
      botao: c.botao,
    };
  },
  async opcoes() {
    return {};
  },
  schema: schemaEmpresa,
  gravar: gravarEmpresa,
  fallback: true,
  // Logo e "direto": só com o clique (decisão 1 do 8.9).
  soNoFormulario: (d) => !!d.logo || !!d.remover_logo || d.mensagens_agente === "direto",
};
