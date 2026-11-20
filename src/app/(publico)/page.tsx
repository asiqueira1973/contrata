// [Público] Página inicial provisória (seção 10.1; a definitiva é o épico 8.12): o que é e o
// endereço do conector. Não há painel: quem recruta usa o Contrata pelo Claude ou pelo ChatGPT.
import type { Metadata } from "next";
import { NOME_PRODUTO, copy } from "@/lib/copy";
import ui from "@/components/ui/ui.module.css";
import { mcpResource } from "@/server/oauth/server";

export const metadata: Metadata = { title: NOME_PRODUTO, robots: { index: true, follow: true } };

export default function InicioPage() {
  return (
    <main className={ui.narrow}>
      <h1 className={ui.narrowTitle}>{copy.inicioPublico.titulo}</h1>
      <div className={`${ui.card} ${ui.stack}`}>
        <p className={ui.rowMeta}>{copy.inicioPublico.texto}</p>
        <p className={ui.rowTitle}>{mcpResource()}</p>
        <p className={ui.rowMeta}>{copy.conviteAceito.passos}</p>
      </div>
    </main>
  );
}
