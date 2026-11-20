// [Membro] Empresas — seção 10 e critério 8.1: com uma empresa só, vai direto para ela; com várias,
// mostra a escolha. "Criar empresa" só para quem está em CRIACAO_EMPRESA_EMAILS (11.33); os
// outros veem a copy "Sem permissão para criar empresa" da 15.2.
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ERROS, copy } from "@/lib/copy";
import ui from "@/components/ui/ui.module.css";
import { canCreateCompany } from "@/server/auth/allowlist";
import { getCurrentUser } from "@/server/auth/require-usuario";
import { listCompaniesForUser } from "@/server/org/companies";

export const instant = false;

async function Body() {
  const usuario = await getCurrentUser();
  if (!usuario) redirect("/entrar");
  const empresas = await listCompaniesForUser(usuario.id);
  if (empresas.length === 1) redirect(`/painel/${empresas[0].slug}`);
  const podeCriar = canCreateCompany(usuario.email);
  return (
    <div className={ui.stack}>
      {empresas.length ? (
        <ul className={ui.list}>
          {empresas.map((e) => (
            <li key={e.slug}>
              <Link className={ui.row} href={`/painel/${e.slug}`} style={{ color: "inherit" }}>
                <div className={ui.rowMain}>
                  <p className={ui.rowTitle}>{e.nome}</p>
                  <p className={ui.rowMeta}>{copy.empresas.papel(e.papel)}</p>
                </div>
                <ChevronRight size={18} aria-hidden="true" color="var(--text-secondary)" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={ui.card}>
          <p className={ui.rowTitle}>{copy.empresas.nenhuma}</p>
          {!podeCriar ? <p className={ui.rowMeta}>{ERROS.sem_permissao_criar_empresa}</p> : null}
        </div>
      )}
      {podeCriar ? (
        <div>
          <Link className={ui.primary} href="/painel/nova">{copy.empresas.criar}</Link>
        </div>
      ) : null}
      <form action="/sair" method="post">
        <button className={ui.textButton} type="submit">{copy.nav.sair}</button>
      </form>
    </div>
  );
}

export default function EmpresasPage() {
  return (
    <main className={ui.narrow}>
      <h1 className={ui.narrowTitle}>{copy.empresas.titulo}</h1>
      <Suspense fallback={<div className={ui.skeleton} />}>
        <Body />
      </Suspense>
    </main>
  );
}
