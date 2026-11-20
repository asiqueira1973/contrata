// Contexto de um membro numa empresa — seções 5 e 20.3. Desde a v0.4 não há painel: quem monta
// este contexto é o guardião das portas de máquina (credential.ts), a partir do token do conector,
// relendo o vínculo a cada chamada. As funções de domínio de src/server/org/ recebem este contexto.
import "server-only";
import { PAPEIS, type Papel } from "@/lib/limits";
import type { Usuario } from "@/server/db/users";
import type { Ator } from "@/server/org/actor";
import type { Alcance } from "@/server/org/scope";

export type Empresa = { id: string; slug: string; nome: string; email_contato: string };
export type Membro = { id: string; papel: Papel; todas_areas: boolean };
export type ContextoMembro = { usuario: Usuario; membro: Membro; empresa: Empresa; alcance: Alcance; ator: Ator };

// Diz se o papel alcança o mínimo exigido (seção 5).
export function papelAtende(papel: Papel, minimo: Papel): boolean {
  return PAPEIS.indexOf(papel) >= PAPEIS.indexOf(minimo);
}
