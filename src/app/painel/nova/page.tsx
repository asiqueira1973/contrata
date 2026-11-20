// [Membro] Criar empresa — seção 10, critério 8.1 e regra 11.33: só e-mails de
// CRIACAO_EMPRESA_EMAILS veem o formulário; os outros veem a copy da 15.2.
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ERROS, copy } from "@/lib/copy";
import ui from "@/components/ui/ui.module.css";
import { NewCompanyForm } from "@/features/org/new-company-form";
import { canCreateCompany } from "@/server/auth/allowlist";
import { getCurrentUser } from "@/server/auth/require-usuario";

export const instant = false;

async function Body() {
  const usuario = await getCurrentUser();
  if (!usuario) redirect("/entrar");
  if (!canCreateCompany(usuario.email)) {
    return (
      <div className={ui.card}>
        <p className={ui.rowMeta}>{ERROS.sem_permissao_criar_empresa}</p>
      </div>
    );
  }
  return <NewCompanyForm site={process.env.NEXT_PUBLIC_SITE_URL ?? ""} emailPadrao={usuario.email} />;
}

export default function NovaEmpresaPage() {
  return (
    <main className={ui.narrow}>
      <h1 className={ui.narrowTitle}>{copy.novaEmpresa.titulo}</h1>
      <Suspense fallback={<div className={ui.skeleton} />}>
        <Body />
      </Suspense>
    </main>
  );
}
