// Guarda das páginas do painel da empresa (Server Components, dentro de <Suspense>) — seção 5.
// Sem sessão → /entrar; sem vínculo ativo ou papel abaixo do mínimo → 404 (não revela a empresa).
import "server-only";
import { notFound, redirect } from "next/navigation";
import type { Papel } from "@/lib/limits";
import { getMemberContext, papelAtende, type ContextoMembro } from "./require-membro";

export async function memberPage(empresaSlug: string, papelMinimo: Papel): Promise<ContextoMembro> {
  const ctx = await getMemberContext(empresaSlug);
  if (ctx === "sem_sessao") redirect("/entrar");
  if (ctx === "sem_acesso" || !papelAtende(ctx.membro.papel, papelMinimo)) notFound();
  return ctx;
}
