// Formulário "Vaga" (8.3; 10.2, 13.3; regras 11.1, 11.22, 11.31 e 11.32): criar em rascunho ou
// editar, com etapas, perguntas, dono e equipe, num formulário só. Recrutador ou administrador,
// escopo escrita. A área se limita ao alcance; perguntas de vaga já publicada vêm só para leitura.
// O schema daqui é o do formulário (campos planos, sem refine, para o fallback estender); a regra
// 11.1 é o vagaSchema, aplicado no save.ts (o mesmo da API v1).
import "server-only";
import { z } from "zod";
import { copy } from "@/lib/copy";
import type { Campo, ItemLista, Opcao } from "@/lib/formularios";
import {
  AVALIADORES_POR_VAGA_MAX, ETAPA_NOME_MAX, ETAPAS_MAX, MODELOS_TRABALHO, PERGUNTA_TEXTO_MAX, PERGUNTAS_MAX, PERIODOS_SALARIO,
  REGIMES, TIPOS_ETAPA, TIPOS_PERGUNTA, UFS, VAGA_CIDADE_MAX, VAGA_DESCRICAO_MAX, VAGA_REQUISITOS_MAX, VAGA_SLUG_MAX, VAGA_TITULO_MAX,
} from "@/lib/limits";
import { listAreas } from "@/server/org/areas";
import { listTeam } from "@/server/org/members";
import { listPeople } from "@/server/org/people";
import { etapasPadrao, getJob, type VagaDetalhe } from "@/server/recruiting/jobs";
import { acharVaga } from "../../vagas";
import { acharPorNome } from "../comum";
import type { ContextoFormulario, DefinicaoFormulario } from "../registrar";
import { gravarVaga } from "./save";

const c = copy.mcp.form.vaga;
const textoOuVazio = (max: number) => z.string().trim().max(max).optional();
const idOuVazio = z.union([z.uuid(), z.literal("")]).optional();

export const schemaVaga = z.object({
  vaga: idOuVazio,
  titulo: z.string().trim().max(VAGA_TITULO_MAX),
  slug: textoOuVazio(VAGA_SLUG_MAX),
  area: idOuVazio,
  dono: idOuVazio,
  modelo_trabalho: z.enum(MODELOS_TRABALHO),
  cidade: textoOuVazio(VAGA_CIDADE_MAX),
  uf: z.union([z.enum(UFS), z.literal("")]).optional(),
  regime: z.enum(REGIMES),
  salario_min: z.union([z.string().max(20), z.number()]).optional(),
  salario_max: z.union([z.string().max(20), z.number()]).optional(),
  salario_periodo: z.union([z.enum(PERIODOS_SALARIO), z.literal("")]).optional(),
  mostrar_salario: z.boolean().optional(),
  curriculo_obrigatorio: z.boolean().optional(),
  encerra_em: textoOuVazio(10),
  descricao: textoOuVazio(VAGA_DESCRICAO_MAX),
  requisitos: textoOuVazio(VAGA_REQUISITOS_MAX),
  etapas: z.array(z.object({ id: z.string().max(36).optional(), nome: z.string().max(ETAPA_NOME_MAX), tipo: z.enum(TIPOS_ETAPA) })).max(ETAPAS_MAX),
  perguntas: z
    .array(z.object({
      texto: z.string().max(PERGUNTA_TEXTO_MAX),
      tipo: z.enum(TIPOS_PERGUNTA),
      opcoes: z.array(z.string().max(PERGUNTA_TEXTO_MAX)).optional(),
      obrigatoria: z.boolean().optional(),
      resposta_esperada: z.string().max(PERGUNTA_TEXTO_MAX).optional(),
    }))
    .max(PERGUNTAS_MAX)
    .optional(),
  responsavel: idOuVazio,
  avaliadores: z.array(z.uuid()).max(AVALIADORES_POR_VAGA_MAX).optional(),
});

const opcoesFixas = (lista: readonly string[], rotulos: Record<string, string>): Opcao[] => lista.map((v) => ({ valor: v, rotulo: rotulos[v] ?? v }));
const numeroTexto = (n: unknown) => (typeof n === "number" ? String(n) : typeof n === "string" ? n : "");

// Rótulo do dono na lista: nome, cargo e, sem acesso, o selo da 11.31.
function rotuloDono(p: Awaited<ReturnType<typeof listPeople>>[number]): string {
  const acesso = p.acesso && !p.acesso.pendente ? c.comAcesso : p.recebe_resumo ? c.semAcessoResumo : c.semAcesso;
  return [p.nome, p.cargo, acesso].filter(Boolean).join(" · ");
}

function etapasComoItens(etapas: { id?: string; nome: string; tipo: string }[]): ItemLista[] {
  return etapas.map((e) => ({ ...(e.id ? { id: e.id } : {}), nome: e.nome, tipo: e.tipo }));
}

function perguntasComoItens(perguntas: unknown): ItemLista[] {
  if (!Array.isArray(perguntas)) return [];
  return perguntas.map((p: Record<string, unknown>) => ({
    texto: String(p.texto ?? ""),
    tipo: TIPOS_PERGUNTA.includes(p.tipo as never) ? String(p.tipo) : "texto_curto",
    opcoes: Array.isArray(p.opcoes) ? p.opcoes.map(String) : [],
    obrigatoria: p.obrigatoria !== false,
    resposta_esperada: typeof p.resposta_esperada === "string" ? p.resposta_esperada : "",
  }));
}

// Os campos do formulário. `v`: a vaga em edição (null ao criar); `todas`: a pessoa vê todas as
// áreas (pode deixar "Sem área").
function campos(v: VagaDetalhe | null, todas: boolean): Campo[] {
  const local = [{ campo: "modelo_trabalho", igual: ["presencial", "hibrido"] }];
  const lista: Campo[] = [];
  if (v) lista.push({ tipo: "select", nome: "vaga", rotulo: c.vaga, obrigatorio: true, opcoes: [{ valor: v.id, rotulo: v.titulo }] });
  lista.push(
    { tipo: "texto", nome: "titulo", rotulo: c.tituloCampo, obrigatorio: true, max: VAGA_TITULO_MAX },
    ...(v && !v.publicada_em ? [{ tipo: "texto" as const, nome: "slug", rotulo: c.slug, dica: c.slugDica, max: VAGA_SLUG_MAX }] : []),
    { tipo: "select", nome: "area", rotulo: c.area, opcoes: "areas", vazio: todas ? c.semArea : undefined, obrigatorio: !todas },
    { tipo: "select", nome: "dono", rotulo: c.dono, dica: c.donoDica, opcoes: "pessoas", vazio: c.semDono },
    { tipo: "radio", nome: "modelo_trabalho", rotulo: c.modelo, obrigatorio: true, opcoes: opcoesFixas(MODELOS_TRABALHO, copy.carreiras.modelo) },
    { tipo: "texto", nome: "cidade", rotulo: c.cidade, obrigatorio: true, max: VAGA_CIDADE_MAX, mostrarSe: local },
    { tipo: "select", nome: "uf", rotulo: c.uf, obrigatorio: true, opcoes: UFS.map((u) => ({ valor: u, rotulo: u })), mostrarSe: local },
    { tipo: "select", nome: "regime", rotulo: c.regime, obrigatorio: true, opcoes: opcoesFixas(REGIMES, copy.carreiras.regime) },
    { tipo: "numero", nome: "salario_min", rotulo: c.salarioMin, min: 0, passo: 0.01 },
    { tipo: "numero", nome: "salario_max", rotulo: c.salarioMax, min: 0, passo: 0.01 },
    { tipo: "radio", nome: "salario_periodo", rotulo: c.salarioPeriodo, opcoes: [{ valor: "mes", rotulo: c.mes }, { valor: "hora", rotulo: c.hora }] },
    { tipo: "marcar", nome: "mostrar_salario", rotulo: c.mostrarSalario },
    { tipo: "data", nome: "encerra_em", rotulo: c.encerraEm, dica: c.encerraEmDica },
    { tipo: "textarea", nome: "descricao", rotulo: c.descricaoCampo, dica: c.descricaoDica, max: VAGA_DESCRICAO_MAX },
    { tipo: "textarea", nome: "requisitos", rotulo: c.requisitos, max: VAGA_REQUISITOS_MAX },
    {
      tipo: "lista", nome: "etapas", rotulo: c.etapas, rotuloItem: c.etapa, adicionar: c.adicionarEtapa, min: 1, max: ETAPAS_MAX, obrigatorio: true,
      novo: { nome: "", tipo: "entrevista" },
      subcampos: [
        { tipo: "texto", nome: "nome", rotulo: c.etapaNome, obrigatorio: true, max: ETAPA_NOME_MAX },
        { tipo: "select", nome: "tipo", rotulo: c.etapaTipo, obrigatorio: true, opcoes: opcoesFixas(TIPOS_ETAPA, c.tiposEtapa) },
      ],
    },
    {
      tipo: "lista", nome: "perguntas", rotulo: c.perguntas, rotuloItem: c.pergunta, adicionar: c.adicionarPergunta, max: PERGUNTAS_MAX,
      somenteLeitura: !!v?.publicada_em,
      novo: { texto: "", tipo: "sim_nao", opcoes: [], obrigatoria: true, resposta_esperada: "" },
      subcampos: [
        { tipo: "texto", nome: "texto", rotulo: c.perguntaTexto, obrigatorio: true, max: PERGUNTA_TEXTO_MAX },
        { tipo: "select", nome: "tipo", rotulo: c.perguntaTipo, obrigatorio: true, opcoes: opcoesFixas(TIPOS_PERGUNTA, c.tiposPergunta) },
        { tipo: "linhas", nome: "opcoes", rotulo: c.perguntaOpcoes, mostrarSe: [{ campo: "tipo", igual: "escolha_unica" }] },
        { tipo: "marcar", nome: "obrigatoria", rotulo: c.perguntaObrigatoria },
        { tipo: "texto", nome: "resposta_esperada", rotulo: c.respostaEsperada, dica: c.respostaEsperadaDica, mostrarSe: [{ campo: "tipo", igual: ["sim_nao", "escolha_unica"] }] },
      ],
    },
    { tipo: "select", nome: "responsavel", rotulo: c.responsavel, opcoes: "recrutadores", vazio: c.semResponsavel },
    { tipo: "multipla", nome: "avaliadores", rotulo: c.avaliadores, opcoes: "membros" },
    { tipo: "marcar", nome: "curriculo_obrigatorio", rotulo: c.curriculo },
  );
  return lista;
}

export const formularioVaga: DefinicaoFormulario<typeof schemaVaga> = {
  acao: "vaga",
  titulo: c.titulo,
  descricao: c.descricao,
  escopo: "escrita",
  papel: "recrutador",
  entrada: z.object({
    vaga: z.string().optional().describe("título ou id de uma vaga existente, para editar; vazio cria uma vaga nova"),
    titulo: z.string().optional().describe("título da vaga"),
    area: z.string().optional().describe("nome da área"),
    dono: z.string().optional().describe("nome da pessoa dona da vaga (quem pediu)"),
    responsavel: z.string().optional().describe("nome do recrutador que conduz o processo"),
    modelo_trabalho: z.enum(MODELOS_TRABALHO).optional().describe("presencial, hibrido ou remoto"),
    cidade: z.string().optional(),
    uf: z.string().optional().describe("sigla do estado, ex.: SP"),
    regime: z.enum(REGIMES).optional(),
    salario_min: z.number().optional().describe("em reais"),
    salario_max: z.number().optional().describe("em reais"),
    salario_periodo: z.enum(PERIODOS_SALARIO).optional().describe("mes ou hora"),
    mostrar_salario: z.boolean().optional(),
    encerra_em: z.string().optional().describe("data-limite AAAA-MM-DD"),
    descricao: z.string().optional().describe("descrição em Markdown, 50 caracteres ou mais para publicar"),
    requisitos: z.string().optional().describe("requisitos em Markdown"),
    etapas: z.array(z.object({ nome: z.string(), tipo: z.enum(TIPOS_ETAPA) })).optional().describe("etapas do processo; sem isto, as etapas padrão"),
    perguntas: z.array(z.object({
      texto: z.string(), tipo: z.enum(TIPOS_PERGUNTA), opcoes: z.array(z.string()).optional(), resposta_esperada: z.string().optional(),
    })).optional().describe("perguntas da candidatura (até 10)"),
  }),
  async montar(args, ctx) {
    const [areas, pessoas, equipe] = await Promise.all([listAreas(ctx.empresa.id), listPeople(ctx.empresa.id), listTeam(ctx.empresa.id)]);
    const achada = await acharVaga(ctx, args.vaga);
    const v = achada ? await getJob(ctx, achada.id) : null;
    const todas = ctx.alcance.tipo === "todas";
    const area = acharPorNome(areas, args.area);
    const dono = acharPorNome(pessoas, args.dono);
    const resp = acharPorNome(equipe.filter((m) => m.nome).map((m) => ({ ...m, nome: m.nome as string })), args.responsavel);
    const str = (k: string, padrao: string) => (typeof args[k] === "string" ? (args[k] as string) : padrao);
    const areaId = area?.id ?? v?.area?.id ?? (ctx.alcance.tipo === "areas" && ctx.alcance.areaIds.length === 1 ? ctx.alcance.areaIds[0] : "");
    const areaEscolhida = areas.find((a) => a.id === areaId);
    return {
      campos: campos(v, todas),
      valores: {
        ...(v ? { vaga: v.id, slug: v.slug } : {}),
        titulo: str("titulo", v?.titulo ?? ""),
        area: areaId,
        dono: dono?.id ?? v?.dono?.id ?? areaEscolhida?.responsavel?.id ?? "",
        modelo_trabalho: str("modelo_trabalho", v?.modelo_trabalho ?? "presencial"),
        cidade: str("cidade", v?.cidade ?? ""),
        uf: str("uf", v?.uf ?? "").toUpperCase(),
        regime: str("regime", v?.regime ?? "clt"),
        salario_min: numeroTexto(args.salario_min ?? v?.salario_min),
        salario_max: numeroTexto(args.salario_max ?? v?.salario_max),
        salario_periodo: str("salario_periodo", v?.salario_periodo ?? (args.salario_min || args.salario_max ? "mes" : "")),
        mostrar_salario: typeof args.mostrar_salario === "boolean" ? args.mostrar_salario : v?.mostrar_salario ?? false,
        encerra_em: str("encerra_em", v?.encerra_em ?? ""),
        descricao: str("descricao", v?.descricao ?? ""),
        requisitos: str("requisitos", v?.requisitos ?? ""),
        etapas: etapasComoItens(Array.isArray(args.etapas) && !v ? (args.etapas as { nome: string; tipo: string }[]) : v?.etapas ?? etapasPadrao()),
        perguntas: perguntasComoItens(v?.publicada_em ? v.perguntas : Array.isArray(args.perguntas) ? args.perguntas : v?.perguntas ?? []),
        responsavel: resp?.id ?? v?.equipe.find((e) => e.papel_na_vaga === "responsavel")?.membro_id ?? (ctx.membro.papel === "recrutador" && !v ? ctx.membro.id : ""),
        avaliadores: v?.equipe.filter((e) => e.papel_na_vaga === "avaliador").map((e) => e.membro_id) ?? [],
        curriculo_obrigatorio: v?.curriculo_obrigatorio ?? true,
      },
      botao: c.botao,
      ...(v?.publicada_em ? { avisos: [c.perguntasCongeladas] } : {}),
    };
  },
  async opcoes(ctx: ContextoFormulario) {
    const [areas, pessoas, equipe] = await Promise.all([listAreas(ctx.empresa.id), listPeople(ctx.empresa.id), listTeam(ctx.empresa.id)]);
    const noAlcance = ctx.alcance.tipo === "areas" ? areas.filter((a) => (ctx.alcance as { areaIds: string[] }).areaIds.includes(a.id)) : areas;
    const ativos = equipe.filter((m) => !m.pendente);
    return {
      areas: noAlcance.map((a) => ({ valor: a.id, rotulo: a.nome })),
      pessoas: pessoas.map((p) => ({ valor: p.id, rotulo: rotuloDono(p) })),
      recrutadores: ativos.filter((m) => m.papel !== "avaliador").map((m) => ({ valor: m.id, rotulo: m.nome ?? m.email })),
      membros: ativos.map((m) => ({ valor: m.id, rotulo: m.nome ?? m.email })),
    };
  },
  schema: schemaVaga,
  gravar: gravarVaga,
  fallback: true,
};
