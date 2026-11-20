// Peças comuns aos formulários do 8.2: opções de papel (15.2), busca de nome sem acento e campos
// de papel e áreas (11.32), usados por convite, acesso e "dar acesso".
import "server-only";
import { z } from "zod";
import { PAPEL, copy } from "@/lib/copy";
import type { Campo, Condicao, Opcao } from "@/lib/formularios";
import { PAPEIS, type Papel } from "@/lib/limits";

export const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Acha um item pelo nome dito na conversa: igual (sem acento e caixa) vence; senão, um único que
// contenha. Ambíguo ou ausente: null (o formulário fica vazio e a pessoa escolhe; nunca chuta).
export function acharPorNome<T extends { nome: string }>(itens: T[], nome: unknown): T | null {
  if (typeof nome !== "string" || !nome.trim()) return null;
  const alvo = normalizar(nome);
  const iguais = itens.filter((i) => normalizar(i.nome) === alvo);
  if (iguais.length === 1) return iguais[0];
  const contem = itens.filter((i) => normalizar(i.nome).includes(alvo));
  return contem.length === 1 ? contem[0] : null;
}

export const opcoesDePapel = (): Opcao[] =>
  [...PAPEIS].reverse().map((p) => ({ valor: p, rotulo: PAPEL[p].rotulo, dica: PAPEL[p].explicacao }));

// Campos de papel e áreas; `quando` restringe a uma operação (ex.: só em "mudar").
export function camposDeAcesso(quando: Condicao[] = []): Campo[] {
  const c = copy.mcp.form.convite;
  return [
    { tipo: "radio", nome: "papel", rotulo: c.papel, opcoes: opcoesDePapel(), obrigatorio: true, mostrarSe: quando },
    {
      tipo: "radio",
      nome: "todas",
      rotulo: c.areas,
      opcoes: [{ valor: "todas", rotulo: c.todasAreas }, { valor: "escolher", rotulo: c.escolherAreas }],
      mostrarSe: [...quando, { campo: "papel", igual: "recrutador" }],
    },
    { tipo: "multipla", nome: "areas", rotulo: c.quaisAreas, opcoes: "areas", mostrarSe: [...quando, { campo: "papel", igual: "recrutador" }, { campo: "todas", igual: "escolher" }] },
  ];
}

export const schemaDeAcesso = {
  papel: z.enum(PAPEIS),
  todas: z.enum(["todas", "escolher"]).optional(),
  areas: z.array(z.uuid()).max(100).optional(),
};

// Converte os campos do formulário no corpo do domínio (acessoSchema do 8.1).
export function acessoDoFormulario(v: { papel: Papel; todas?: "todas" | "escolher"; areas?: string[] }) {
  const limitado = v.papel === "recrutador" && v.todas === "escolher";
  return { papel: v.papel, todas_areas: !limitado, areas: limitado ? (v.areas ?? []) : [] };
}
