// [Recrutador+] Pessoas — seção 10 e critério 8.1: cadastro com área, cargo e selo de acesso;
// cadastrar e editar (recrutador e administrador), arquivar e dar acesso (administrador, seção 5).
import { Suspense } from "react";
import { copy } from "@/lib/copy";
import { PageHeader } from "@/components/ui/page-header";
import ui from "@/components/ui/ui.module.css";
import { PeoplePanel } from "@/features/org/people-panel";
import { memberPage } from "@/server/auth/page-guard";
import { listAreas } from "@/server/org/areas";
import { listPeople } from "@/server/org/people";

export const instant = false;

async function Body({ params }: { params: PageProps<"/painel/[empresa]/pessoas">["params"] }) {
  const ctx = await memberPage((await params).empresa, "recrutador");
  const [pessoas, areas] = await Promise.all([listPeople(ctx.empresa.id), listAreas(ctx.empresa.id)]);
  return (
    <PeoplePanel
      base={`/api/painel/${ctx.empresa.slug}`}
      pessoas={pessoas}
      areas={areas.map((a) => ({ id: a.id, nome: a.nome }))}
      admin={ctx.membro.papel === "administrador"}
    />
  );
}

export default function PessoasPage({ params }: PageProps<"/painel/[empresa]/pessoas">) {
  return (
    <>
      <PageHeader title={copy.pessoas.titulo} />
      <p className={ui.lead}>{copy.pessoas.explicacao}</p>
      <Suspense fallback={<div className={ui.stack} aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className={ui.skeleton} />)}</div>}>
        <Body params={params} />
      </Suspense>
    </>
  );
}
