// Tela de um item do menu cujo épico ainda não chegou (seção 8): título e o aviso, sem botões
// que não funcionam. Some à medida que cada épico implementa a sua tela.
import { Suspense } from "react";
import { copy } from "@/lib/copy";
import type { Papel } from "@/lib/limits";
import { memberPage } from "@/server/auth/page-guard";
import ui from "./ui.module.css";
import { PageHeader } from "./page-header";

async function Guard({ params, papel }: { params: Promise<{ empresa: string }>; papel: Papel }) {
  await memberPage((await params).empresa, papel);
  return (
    <div className={ui.card}>
      <p className={ui.rowMeta}>{copy.emConstrucao}</p>
    </div>
  );
}

export function UnderConstruction({ title, params, papel }: { title: string; params: Promise<{ empresa: string }>; papel: Papel }) {
  return (
    <>
      <PageHeader title={title} />
      <Suspense fallback={<div className={ui.skeleton} />}>
        <Guard params={params} papel={papel} />
      </Suspense>
    </>
  );
}
