// Extração do texto do currículo (8.4; seção 17: fora da requisição do candidato, com
// tempo-limite). PDF por unpdf, DOCX por mammoth. PDF sem texto (escaneado) vira `sem_texto`;
// arquivo que não abre ou passa do tempo vira `falhou`. Nunca lança e nunca aparece para o
// candidato. O texto vai até 100.000 caracteres (7.3) e alimenta a busca (11.28).
import "server-only";
import { EXTRACAO_TIMEOUT_MS, TEXTO_EXTRAIDO_MAX } from "@/lib/limits";
import type { TipoCurriculo } from "./verifica";

export type Extracao = { status: "ok" | "sem_texto" | "falhou"; texto: string | null };

async function extrairBruto(bytes: Uint8Array, tipo: TipoCurriculo): Promise<string> {
  if (tipo === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  const mammoth = await import("mammoth");
  const r = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return r.value;
}

// Extrai com tempo-limite. Recebe: bytes e tipo já conferidos. Devolve: status e texto.
export async function extrairTexto(bytes: Uint8Array, tipo: TipoCurriculo, limiteMs = EXTRACAO_TIMEOUT_MS): Promise<Extracao> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tempo = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error("tempo_esgotado")), limiteMs);
  });
  try {
    const bruto = await Promise.race([extrairBruto(bytes, tipo), tempo]);
    const texto = bruto.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (!texto) return { status: "sem_texto", texto: null };
    return { status: "ok", texto: texto.slice(0, TEXTO_EXTRAIDO_MAX) };
  } catch {
    return { status: "falhou", texto: null };
  } finally {
    clearTimeout(timer);
  }
}
