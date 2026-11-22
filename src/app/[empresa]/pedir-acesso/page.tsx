// [Público] /{empresa}/pedir-acesso?t=… — "Pedir acesso" do resumo semanal ao dono de vaga sem
// acesso (8.10; 11.31). A página só mostra o botão; o pedido sai com o clique. noindex.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { copy } from "@/lib/copy";
import s from "@/features/candidate/candidate.module.css";
import { RequestAccess } from "@/features/candidate/request-access";
import { LogoDaEmpresa } from "@/features/careers/logo";
import { empresaEmCache } from "../dados";

export const instant = false;
export const metadata: Metadata = { title: copy.pedirAcesso.titulo, robots: { index: false, follow: false } };

export async function generateStaticParams() {
  return [{ empresa: "padaria-exemplo" }];
}

export default async function PedirAcessoPage({ params }: { params: Promise<{ empresa: string }> }) {
  const empresa = await empresaEmCache((await params).empresa);
  if (!empresa) notFound();
  const estilo = empresa.cor_destaque ? ({ "--destaque": empresa.cor_destaque } as CSSProperties) : undefined;
  return (
    <main className={s.page} style={estilo}>
      <LogoDaEmpresa url={empresa.logo_url} />
      <p className={s.empresa}>{empresa.nome}</p>
      <h1 className={s.title}>{copy.pedirAcesso.titulo}</h1>
      <p className={s.lead}>{copy.pedirAcesso.texto(empresa.nome)}</p>
      <Suspense fallback={null}>
        <RequestAccess empresaSlug={empresa.slug} />
      </Suspense>
    </main>
  );
}
