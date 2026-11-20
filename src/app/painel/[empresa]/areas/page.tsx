// [Admin] Áreas — seção 10 e critério 8.1: áreas com responsável, vagas abertas e recrutadores;
// criar, editar, arquivar (recusas da 7.4).
import { Suspense } from "react";
import { copy } from "@/lib/copy";
import { PageHeader } from "@/components/ui/page-header";
import ui from "@/components/ui/ui.module.css";
import { AreasPanel } from "@/features/org/areas-panel";
import { memberPage } from "@/server/auth/page-guard";
import { listAreas } from "@/server/org/areas";
import { listPeople } from "@/server/org/people";

export const instant = false;

async function Body({ params }: { params: PageProps<"/painel/[empresa]/areas">["params"] }) {
  const ctx = await memberPage((await params).empresa, "administrador");
  const [areas, pessoas] = await Promise.all([listAreas(ctx.empresa.id), listPeople(ctx.empresa.id)]);
  return <AreasPanel base={`/api/painel/${ctx.empresa.slug}`} areas={areas} pessoas={pessoas.map((p) => ({ id: p.id, nome: p.nome }))} />;
}

export default function AreasPage({ params }: PageProps<"/painel/[empresa]/areas">) {
  return (
    <>
      <PageHeader title={copy.areas.titulo} />
      <Suspense fallback={<div className={ui.stack} aria-busy="true">{[0, 1].map((i) => <div key={i} className={ui.skeleton} />)}</div>}>
        <Body params={params} />
      </Suspense>
    </>
  );
}
