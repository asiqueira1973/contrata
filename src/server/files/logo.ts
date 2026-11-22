// Logo da empresa (8.9; seção 20: uploads conferidos pelos bytes, SVG sanitizado). PNG e JPG pela
// assinatura; SVG pelo texto, passado por uma lista fechada de elementos e atributos de desenho
// (sem script, foreignObject, eventos, estilos externos nem links para fora). Se não sobrar um
// <svg>, é recusado. Recebe os bytes; devolve o tipo e os bytes a guardar, ou o código do erro.
import "server-only";
import { createHash } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { LOGO_MAX_BYTES } from "@/lib/limits";
import { siteOrigin } from "@/server/oauth/server";

export type Logo = { ext: "png" | "jpg" | "svg"; mime: string; bytes: Uint8Array; sha256: string };

// SVG é XML: os nomes têm caixa (viewBox, linearGradient) e são comparados como escritos.
const ELEMENTOS = ["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan", "defs",
  "linearGradient", "radialGradient", "stop", "title", "desc", "clipPath", "mask", "symbol", "use"];
const ATRIBUTOS = ["id", "class", "viewBox", "width", "height", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "fx", "fy", "d", "points",
  "fill", "fill-opacity", "fill-rule", "clip-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin",
  "stroke-miterlimit", "stroke-dasharray", "opacity", "transform", "offset", "stop-color", "stop-opacity", "gradientUnits",
  "gradientTransform", "spreadMethod", "clipPathUnits", "maskUnits", "maskContentUnits", "font-family", "font-size", "font-weight",
  "text-anchor", "dominant-baseline", "letter-spacing", "clip-path", "mask", "preserveAspectRatio", "xmlns", "version", "href",
  "xlink:href", "xmlns:xlink"];

const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

// Limpa um SVG. Devolve o texto seguro ou null.
export function sanitizaSvg(texto: string): string | null {
  const limpo = sanitizeHtml(texto, {
    allowedTags: ELEMENTOS,
    allowedAttributes: { "*": ATRIBUTOS },
    transformTags: {
      "*": (tag, attribs) => {
        const a = { ...attribs };
        for (const k of ["href", "xlink:href"]) if (a[k] !== undefined && !/^#[\w-]+$/.test(a[k])) delete a[k];
        for (const [k, v] of Object.entries(a)) if (/url\(\s*['"]?\s*(?!#)/i.test(v)) delete a[k];
        return { tagName: tag, attribs: a };
      },
    },
    allowedSchemes: [],
    parser: { xmlMode: true, lowerCaseTags: false, lowerCaseAttributeNames: false },
  }).trim();
  // Precisa sobrar um <svg> com algo desenhado (um SVG que só tinha script vira vazio).
  return /^<svg[\s>][\s\S]*<\/svg>$/.test(limpo) && /<(path|rect|circle|ellipse|line|polyline|polygon|text|use)[\s>/]/.test(limpo) ? limpo : null;
}

// Confere o arquivo do logo. Recebe os bytes. Devolve o logo ou o código do erro.
export function confereLogo(bytes: Uint8Array): Logo | "logo_invalido" | "logo_grande" {
  if (bytes.length > LOGO_MAX_BYTES) return "logo_grande";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ext: "png", mime: "image/png", bytes, sha256: hash(bytes) };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg", bytes, sha256: hash(bytes) };
  }
  const texto = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^﻿/, "");
  if (!/<svg[\s>]/i.test(texto)) return "logo_invalido";
  const limpo = sanitizaSvg(texto.replace(/<\?xml[\s\S]*?\?>/, "").replace(/<!DOCTYPE[\s\S]*?>/i, ""));
  if (!limpo) return "logo_invalido";
  const out = new TextEncoder().encode(limpo);
  return { ext: "svg", mime: "image/svg+xml", bytes: out, sha256: hash(out) };
}

// Endereço público do logo (página, e-mail, JSON-LD). O caminho leva o hash, então a URL muda quando
// o logo muda (cache longo sem servir o antigo). Recebe: slug e logo_path. Devolve a URL ou null.
export function urlDoLogo(slug: string, logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;
  const v = /logo-([0-9a-f]{8})\./.exec(logoPath)?.[1] ?? "1";
  return `${siteOrigin()}/api/publico/${slug}/logo?v=${v}`;
}
