// [Membro] Convite aceito (6.1, 15.2): "Pronto, você está na equipe da {empresa}" e como conectar o
// conector no Claude ou no ChatGPT. Lê a sessão para dizer de quais empresas a pessoa faz parte.
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { copy } from "@/lib/copy";
import ui from "@/components/ui/ui.module.css";
import { getCurrentUser } from "@/server/auth/require-usuario";
import { listCompaniesForUser } from "@/server/org/companies";
import { mcpResource } from "@/server/oauth/server";

export const instant = false;

async function Body() {
  const usuario = await getCurrentUser();
  if (!usuario) redirect("/");
  const empresas = await listCompaniesForUser(usuario.id);
  return (
    <div className={`${ui.card} ${ui.stack}`}>
      <p className={ui.rowMeta}>{copy.conviteAceito.texto(empresas.map((e) => e.nome).join(", "))}</p>
      <p className={ui.rowTitle}>{mcpResource()}</p>
      <p className={ui.rowMeta}>{copy.conviteAceito.passos}</p>
    </div>
  );
}

export default function ConviteAceitoPage() {
  return (
    <main className={ui.narrow}>
      <h1 className={ui.narrowTitle}>{copy.conviteAceito.titulo}</h1>
      <Suspense fallback={<div className={ui.skeleton} />}>
        <Body />
      </Suspense>
    </main>
  );
}
