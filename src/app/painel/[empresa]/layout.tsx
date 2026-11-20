// Layout do painel da empresa — seções 10 e 16: menu lateral com a empresa atual e o seletor no
// topo, itens conforme o papel. requireMembro relê o vínculo a cada requisição (20.3); quem não é
// membro recebe 404.
import { Suspense } from "react";
import { Sidebar } from "@/components/nav/sidebar";
import { canCreateCompany } from "@/server/auth/allowlist";
import { memberPage } from "@/server/auth/page-guard";
import { listCompaniesForUser } from "@/server/org/companies";
import styles from "../painel.module.css";

export const instant = false;

async function Shell({ params, children }: { params: LayoutProps<"/painel/[empresa]">["params"]; children: React.ReactNode }) {
  const { empresa } = await params;
  const ctx = await memberPage(empresa, "avaliador");
  const empresas = await listCompaniesForUser(ctx.usuario.id);
  return (
    <>
      <Sidebar
        empresa={{ slug: ctx.empresa.slug, nome: ctx.empresa.nome }}
        empresas={empresas}
        papel={ctx.membro.papel}
        podeCriarEmpresa={canCreateCompany(ctx.usuario.email)}
        nome={ctx.usuario.nome}
        email={ctx.usuario.email}
      />
      <main className={styles.content}>{children}</main>
    </>
  );
}

export default function EmpresaLayout({ params, children }: LayoutProps<"/painel/[empresa]">) {
  return (
    <Suspense fallback={<main className={styles.content} aria-busy="true" />}>
      <Shell params={params}>{children}</Shell>
    </Suspense>
  );
}
