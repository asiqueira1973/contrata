// [Membro] Minha conta — seção 10. No 8.1: nome e e-mail (vêm do Google), empresas e "Sair".
// O link de agenda por empresa e "Excluir minha conta" (7.4) entram nos épicos 8.6 e 8.9.
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { copy } from "@/lib/copy";
import ui from "@/components/ui/ui.module.css";
import { getCurrentUser } from "@/server/auth/require-usuario";

export const instant = false;

async function Body() {
  const usuario = await getCurrentUser();
  if (!usuario) redirect("/entrar");
  return (
    <div className={ui.stack}>
      <div className={ui.card}>
        <p className={ui.rowTitle}>{usuario.nome}</p>
        <p className={ui.rowMeta}>{usuario.email}</p>
      </div>
      <div className={ui.formActions}>
        <Link className={ui.secondary} href="/painel">{copy.empresas.titulo}</Link>
        <form action="/sair" method="post">
          <button className={ui.secondary} type="submit">{copy.conta.sair}</button>
        </form>
      </div>
    </div>
  );
}

export default function ContaPage() {
  return (
    <main className={ui.narrow}>
      <h1 className={ui.narrowTitle}>{copy.conta.titulo}</h1>
      <Suspense fallback={<div className={ui.skeleton} />}>
        <Body />
      </Suspense>
    </main>
  );
}
