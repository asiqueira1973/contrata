// Formulário "Adicionar candidato" (8.4; 10.2, 11.2, 13.3): inclui uma pessoa numa vaga publicada
// do alcance, por indicação (origem manual). Currículo opcional, lido no formulário (campo
// `arquivo`, base64). Recrutador+, escopo escrita. O fallback (registrar_adicionar_candidato) vai
// sem currículo (13.3): com arquivo, é só pelo formulário.
import "server-only";
import { z } from "zod";
import { ERROS, copy } from "@/lib/copy";
import { CANDIDATO_NOME_MAX, CURRICULO_CHAT_MAX_BYTES, CURRICULO_TIPOS, EMAIL_MAX, NOME_ARQUIVO_MAX } from "@/lib/limits";
import { listJobs } from "@/server/recruiting/jobs";
import { acharVaga } from "../../vagas";
import type { DefinicaoFormulario } from "../registrar";
import { gravarCandidatoManual } from "./save";

const c = copy.mcp.form.adicionar_candidato;
// base64 do teto do chat (3 MB): 4/3 do tamanho, com folga. Acima disso, o save dá o erro do campo.
export const BASE64_MAX = Math.ceil((CURRICULO_CHAT_MAX_BYTES * 4) / 3) + 16;

export const schemaCandidatoManual = z.object({
  vaga: z.uuid(),
  nome: z.string().trim().max(CANDIDATO_NOME_MAX),
  email: z.string().trim().max(EMAIL_MAX),
  telefone: z.string().trim().max(20).optional(),
  linkedin_url: z.string().trim().max(300).optional(),
  curriculo: z.union([
    z.object({ nome: z.string().max(NOME_ARQUIVO_MAX), tipo: z.string().max(120), base64: z.string() }),
    z.literal(""),
  ]).optional(),
});

export const formularioAdicionarCandidato: DefinicaoFormulario<typeof schemaCandidatoManual> = {
  acao: "adicionar_candidato",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "escrita",
  papel: "recrutador",
  entrada: z.object({
    vaga: z.string().optional().describe("título ou id da vaga publicada"),
    nome: z.string().optional(),
    email: z.string().optional(),
    telefone: z.string().optional(),
    linkedin_url: z.string().optional().describe("endereço do perfil no LinkedIn"),
  }),
  async montar(args, ctx) {
    const achada = await acharVaga(ctx, args.vaga);
    const str = (k: string) => (typeof args[k] === "string" ? (args[k] as string) : "");
    return {
      campos: [
        { tipo: "select", nome: "vaga", rotulo: c.vaga, opcoes: "vagas", obrigatorio: true },
        { tipo: "texto", nome: "nome", rotulo: c.nome, obrigatorio: true, max: CANDIDATO_NOME_MAX },
        { tipo: "email", nome: "email", rotulo: c.email, obrigatorio: true, max: EMAIL_MAX },
        { tipo: "texto", nome: "telefone", rotulo: c.telefone, max: 20 },
        { tipo: "texto", nome: "linkedin_url", rotulo: c.linkedin, max: 300 },
        {
          tipo: "arquivo", nome: "curriculo", rotulo: c.curriculo, aceita: ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          tipos: [CURRICULO_TIPOS.pdf, CURRICULO_TIPOS.docx], maxBytes: CURRICULO_CHAT_MAX_BYTES, erroTipo: ERROS.curriculo_grande_chat, remover: c.removerArquivo,
        },
      ],
      valores: { vaga: achada?.status === "publicada" ? achada.id : "", nome: str("nome"), email: str("email"), telefone: str("telefone"), linkedin_url: str("linkedin_url"), curriculo: "" },
      botao: c.botao,
      avisos: [c.aviso],
    };
  },
  async opcoes(ctx) {
    const { itens } = await listJobs(ctx, { status: "publicada" }, { inicio: 0, limite: 200 });
    return { vagas: itens.map((v) => ({ valor: v.id, rotulo: v.titulo })) };
  },
  schema: schemaCandidatoManual,
  gravar: gravarCandidatoManual,
  fallback: true,
  // Sem formulário, sem currículo (13.3): o modelo não manda arquivo.
  soNoFormulario: (d) => !!d.curriculo,
};
