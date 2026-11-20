// Schemas zod da administração da empresa (princípio 1: o mesmo schema no painel e, quando houver
// porta, na API e no MCP). Limites da seção 7.3 e regras 11.20, 11.24, 11.32 e 11.33.
import { z } from "zod";
import {
  AREA_NOME_MAX, AREA_NOME_MIN, AREAS_POR_MEMBRO_MAX, CARGO_MAX, EMAIL_MAX, EMPRESA_NOME_MAX, EMPRESA_NOME_MIN, PAPEIS,
  PESSOA_NOME_MAX, PESSOA_NOME_MIN, SLUG_FORMATO, SLUG_MAX, SLUG_MIN, SLUGS_RESERVADOS,
} from "@/lib/limits";

const email = z.string().trim().toLowerCase().max(EMAIL_MAX).pipe(z.email());
const texto = (min: number, max: number) => z.string().trim().min(min).max(max);
const opcional = (max: number) =>
  z.string().trim().max(max).nullish().transform((v) => (v ? v : null));

// Diz o que há de errado com um slug (11.20), para a tela mostrar ao vivo e o servidor recusar.
// Devolve: null se o formato serve, "slug_invalido" ou "slug_em_uso" (reservado usa a mesma copy
// de "em uso", critério 8.1). Se o slug está livre no banco, só o servidor sabe.
export function slugProblem(slug: string): "slug_invalido" | "slug_em_uso" | null {
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX || !SLUG_FORMATO.test(slug)) return "slug_invalido";
  if ((SLUGS_RESERVADOS as readonly string[]).includes(slug)) return "slug_em_uso";
  return null;
}

// Sugere um slug a partir do nome: minúsculas, sem acento, hífens no lugar do resto.
export function slugFromName(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

export const criarEmpresaSchema = z.object({
  nome: texto(EMPRESA_NOME_MIN, EMPRESA_NOME_MAX),
  slug: z.string().trim().toLowerCase(),
  email_contato: email,
});

const papel = z.enum(PAPEIS);
const areas = z.array(z.uuid()).max(AREAS_POR_MEMBRO_MAX).default([]);

// Papel e áreas (11.32): áreas só valem para recrutador limitado; o banco confere de novo.
export const acessoSchema = z.object({ papel, todas_areas: z.boolean().default(true), areas });
export const conviteSchema = acessoSchema.extend({ email });

export const areaSchema = z.object({
  nome: texto(AREA_NOME_MIN, AREA_NOME_MAX),
  responsavel_pessoa_id: z.uuid().nullish().transform((v) => v ?? null),
});

export const pessoaSchema = z.object({
  nome: texto(PESSOA_NOME_MIN, PESSOA_NOME_MAX),
  email,
  cargo: opcional(CARGO_MAX),
  area_id: z.uuid().nullish().transform((v) => v ?? null),
  recebe_resumo: z.boolean().default(true),
});
