// Página 404 padrão: sem detalhe (o guardião usa 404 também para não revelar empresas, seção 5).
import Link from "next/link";
import { ERROS, NOME_PRODUTO } from "@/lib/copy";
import ui from "@/components/ui/ui.module.css";

export default function NotFound() {
  return (
    <main className={ui.narrow}>
      <h1 className={ui.narrowTitle}>{ERROS.nao_encontrado}</h1>
      <Link href="/">{NOME_PRODUTO}</Link>
    </main>
  );
}
