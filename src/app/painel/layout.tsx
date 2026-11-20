// Layout do painel — seção 6.1: o proxy já barrou quem não tem cookie; aqui a sessão é conferida
// no banco (usuário suspenso conta como sem sessão) e, sem aceite dos Termos, só as boas-vindas
// aparecem. Com Cache Components, a leitura fica dentro de <Suspense>.
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { WelcomeForm } from "@/features/account/welcome-form";
import welcome from "@/features/account/welcome.module.css";
import { getCurrentUser } from "@/server/auth/require-usuario";
import styles from "./painel.module.css";

// O painel inteiro depende da sessão (cookie lido a cada requisição), então não entra na casca
// estática da navegação instantânea do Next 16.4 (pegadinha herdada do Assina).
export const instant = false;

async function Gate({ children }: { children: React.ReactNode }) {
  const usuario = await getCurrentUser();
  if (!usuario) redirect("/entrar");
  if (!usuario.termos_aceitos_em) {
    return (
      <main className={welcome.page}>
        <WelcomeForm />
      </main>
    );
  }
  return <>{children}</>;
}

export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <div className={styles.shell}>
      <Suspense fallback={<main aria-busy="true" />}>
        <Gate>{children}</Gate>
      </Suspense>
    </div>
  );
}
