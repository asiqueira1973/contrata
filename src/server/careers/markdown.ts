// Markdown da vaga para HTML seguro (seções 4 e 20.3): `marked` converte e `sanitize-html` deixa
// só uma lista fechada de tags, sem script, iframe, style nem atributos on*. Links abrem fora,
// com rel="nofollow noopener". Usado na página da vaga, no feed e no JSON-LD (11.20).
import "server-only";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const TAGS = ["p", "br", "strong", "em", "b", "i", "ul", "ol", "li", "h3", "h4", "a", "blockquote"];

// Converte Markdown em HTML limpo. Recebe: texto (pode ser vazio). Devolve: HTML.
export function markdownSeguro(texto: string | null): string {
  if (!texto) return "";
  const bruto = marked.parse(texto, { async: false, gfm: true, breaks: true });
  return sanitizeHtml(bruto, {
    allowedTags: TAGS,
    allowedAttributes: { a: ["href", "rel", "target"] },
    allowedSchemes: ["https", "http", "mailto"],
    // Títulos grandes do Markdown viram h3/h4: a página já tem o h1 (título da vaga) e o h2.
    transformTags: {
      h1: "h3",
      h2: "h3",
      h5: "h4",
      h6: "h4",
      a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener", target: "_blank" }),
    },
  });
}

// Texto puro (sem marcação) para o feed e resumos. Recebe: Markdown. Devolve: texto.
export function textoPuro(texto: string | null): string {
  return sanitizeHtml(markdownSeguro(texto), { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}
