// Modelos e variáveis das mensagens ao candidato (11.29; 15.4; decisão 6 do 8.6). Os padrões vivem
// em copy.modelos; rs_modelos_mensagem guarda só o que a empresa personalizou. Variável
// desconhecida é recusada ao salvar. O corpo guardado em rs_mensagens mantém
// {{link_acompanhamento}} no lugar do link (20.3); só o e-mail leva o link resolvido.
import "server-only";
import { copy } from "@/lib/copy";
import { db } from "@/server/db/client";
import { CamposInvalidos } from "@/server/http";

export const VARIAVEIS = ["nome", "nome_completo", "vaga", "empresa", "link_acompanhamento", "link_vaga", "recrutador", "link_agenda"] as const;
export type Variavel = (typeof VARIAVEIS)[number];
export type Valores = Partial<Record<Variavel, string>>;
export type Modelo = { chave: string; nome: string; assunto: string; corpo: string; personalizado: boolean };

const RE_VAR = /\{\{\s*([a-z_]+)\s*\}\}/g;

// Variáveis usadas num texto que não existem (11.29). Recebe: texto. Devolve: as desconhecidas.
export function variaveisDesconhecidas(texto: string): string[] {
  return [...new Set([...texto.matchAll(RE_VAR)].map((m) => m[1]).filter((v) => !(VARIAVEIS as readonly string[]).includes(v)))];
}

// Confere assunto e corpo; recusa variável desconhecida no campo em que ela aparece.
export function conferirVariaveis(campos: Record<string, string>): void {
  const erros = Object.entries(campos).filter(([, t]) => variaveisDesconhecidas(t).length).map(([campo]) => ({ campo, codigo: "variavel_desconhecida" }));
  if (erros.length) throw new CamposInvalidos(erros);
}

// Troca as variáveis pelos valores; a que não tem valor fica vazia. `manterLink`: deixa
// {{link_acompanhamento}} no texto (versão guardada, 20.3).
export function renderizar(texto: string, valores: Valores, opts: { manterLink?: boolean } = {}): string {
  return texto.replace(RE_VAR, (inteiro, v: string) => {
    if (opts.manterLink && v === "link_acompanhamento") return "{{link_acompanhamento}}";
    return (valores as Record<string, string | undefined>)[v] ?? "";
  }).replace(/[ \t]+\n/g, "\n").trim();
}

// Primeiro nome de um nome completo (11.29: {{nome}}).
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

// Modelos da empresa: os padrões com o que ela personalizou por cima, mais os modelos novos dela.
export async function listTemplates(empresaId: string): Promise<Modelo[]> {
  const { data, error } = await db().from("rs_modelos_mensagem").select("chave, nome, assunto, corpo").eq("empresa_id", empresaId);
  if (error) throw error;
  const proprios = new Map((data ?? []).map((m) => [m.chave, m]));
  const padroes = Object.entries(copy.modelos).map(([chave, m]) => {
    const p = proprios.get(chave);
    return p ? { chave, nome: p.nome, assunto: p.assunto, corpo: p.corpo, personalizado: true } : { chave, ...m, personalizado: false };
  });
  const novos = (data ?? []).filter((m) => !(m.chave in copy.modelos)).map((m) => ({ ...m, personalizado: true }));
  return [...padroes, ...novos];
}

// Um modelo pela chave (personalizado ou padrão). Devolve null se não existe.
export async function getTemplate(empresaId: string, chave: string): Promise<Modelo | null> {
  return (await listTemplates(empresaId)).find((m) => m.chave === chave) ?? null;
}
