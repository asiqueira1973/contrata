// Feed XML de vagas publicadas (seção 14.3), para agregadores (Indeed e afins):
// <source><job> com title, date, referencenumber, url, company, city, state, country, description,
// jobtype e salary (só se a empresa mostra). Só vagas publicadas (critério do 8.3).
import "server-only";
import { copy } from "@/lib/copy";
import { textoPuro } from "./markdown";
import type { EmpresaPublica, VagaPublica } from "./public";

// Texto dentro de CDATA; "]]>" no conteúdo é partido para não fechar o bloco.
function cdata(texto: string): string {
  return `<![CDATA[${texto.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

// Monta o XML. Recebe: empresa, vagas publicadas e a origem do site. Devolve: o documento.
export function feedXml(empresa: EmpresaPublica, vagas: VagaPublica[], site: string): string {
  const jobs = vagas.map((v) => {
    const campos = [
      `<title>${cdata(v.titulo)}</title>`,
      `<date>${cdata(new Date(v.publicada_em ?? v.atualizado_em).toUTCString())}</date>`,
      `<referencenumber>${cdata(v.id)}</referencenumber>`,
      `<url>${cdata(`${site}/${empresa.slug}/vagas/${v.slug}`)}</url>`,
      `<company>${cdata(empresa.nome)}</company>`,
      `<city>${cdata(v.modelo_trabalho === "remoto" ? copy.carreiras.modelo.remoto : (v.cidade ?? ""))}</city>`,
      `<state>${cdata(v.uf ?? "")}</state>`,
      `<country>${cdata("BR")}</country>`,
      `<description>${cdata([textoPuro(v.descricao), textoPuro(v.requisitos)].filter(Boolean).join("\n\n"))}</description>`,
      `<jobtype>${cdata(copy.carreiras.regime[v.regime])}</jobtype>`,
      ...(v.salario ? [`<salary>${cdata(copy.carreiras.salario(v.salario))}</salary>`] : []),
    ];
    return `<job>${campos.join("")}</job>`;
  });
  return `<?xml version="1.0" encoding="utf-8"?>\n<source><publisher>${cdata(empresa.nome)}</publisher><publisherurl>${cdata(`${site}/${empresa.slug}`)}</publisherurl>${jobs.join("")}</source>\n`;
}
