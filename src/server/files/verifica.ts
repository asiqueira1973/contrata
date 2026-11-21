// Confere o currículo pelo conteúdo (11.2, 20.3): o tipo real vem dos bytes iniciais, não da
// extensão nem do content-type que o navegador mandou. PDF começa com "%PDF-"; DOCX é um zip
// (PK\x03\x04) com "word/document.xml" dentro. Até 5 MB. Também calcula o sha256 (7.3).
import "server-only";
import { createHash } from "node:crypto";
import { CURRICULO_MAX_BYTES } from "@/lib/limits";

export type TipoCurriculo = "pdf" | "docx";

const ascii = (bytes: Uint8Array, inicio: number, fim: number) => Buffer.from(bytes.subarray(inicio, fim)).toString("latin1");

// Diz o tipo real do arquivo, ou null se não é PDF nem DOCX.
export function tipoPelosBytes(bytes: Uint8Array): TipoCurriculo | null {
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === "%PDF-") return "pdf";
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    // O nome das entradas do zip aparece em claro nos cabeçalhos locais e no diretório central.
    if (Buffer.from(bytes).includes("word/document.xml", 0, "latin1")) return "docx";
  }
  return null;
}

// Confere o arquivo que chegou. Devolve {tipo, sha256} ou o código do problema.
export function confereCurriculo(bytes: Uint8Array): { tipo: TipoCurriculo; sha256: string; bytes: number } | "curriculo_invalido" {
  if (!bytes.length || bytes.length > CURRICULO_MAX_BYTES) return "curriculo_invalido";
  const tipo = tipoPelosBytes(bytes);
  if (!tipo) return "curriculo_invalido";
  return { tipo, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length };
}
