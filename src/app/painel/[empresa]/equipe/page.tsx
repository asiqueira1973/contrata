// [Admin] Equipe — seção 10 e critério 8.1: membros (papel, áreas, último acesso) e convites
// pendentes; convidar, reenviar, cancelar, mudar papel e áreas, remover. Lido no servidor; as
// escritas passam pelas rotas /api/painel/{e}/convites e /membros.
import { Suspense } from "react";
import { copy } from "@/lib/copy";
import { PageHeader } from "@/components/ui/page-header";
import ui from "@/components/ui/ui.module.css";
import { TeamPanel } from "@/features/org/team-panel";
import { memberPage } from "@/server/auth/page-guard";
import { listAreas } from "@/server/org/areas";
import { listTeam } from "@/server/org/members";

export const instant = false;

async function Body({ params }: { params: PageProps<"/painel/[empresa]/equipe">["params"] }) {
  const ctx = await memberPage((await params).empresa, "administrador");
  const [membros, areas] = await Promise.all([listTeam(ctx.empresa.id), listAreas(ctx.empresa.id)]);
  return (
    <TeamPanel
      base={`/api/painel/${ctx.empresa.slug}`}
      membros={membros.map((m) => ({ ...m, eu: m.id === ctx.membro.id }))}
      areas={areas.map((a) => ({ id: a.id, nome: a.nome }))}
    />
  );
}

function Skeleton() {
  return (
    <div className={ui.stack} aria-busy="true">
      {[0, 1, 2].map((i) => <div key={i} className={ui.skeleton} />)}
    </div>
  );
}

export default function EquipePage({ params }: PageProps<"/painel/[empresa]/equipe">) {
  return (
    <>
      <PageHeader title={copy.equipe.titulo} />
      <Suspense fallback={<Skeleton />}>
        <Body params={params} />
      </Suspense>
    </>
  );
}
