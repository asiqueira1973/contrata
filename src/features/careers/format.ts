// Textos de uma vaga na página pública (10.1): onde é e o modelo de trabalho.
import { copy } from "@/lib/copy";

export function localDaVaga(v: { modelo_trabalho: string; cidade: string | null; uf: string | null }): string {
  if (v.modelo_trabalho === "remoto") return copy.carreiras.modelo.remoto;
  return `${v.cidade}/${v.uf} · ${copy.carreiras.modelo[v.modelo_trabalho]}`;
}
