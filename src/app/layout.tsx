// Layout raiz: idioma pt-BR, tokens visuais (seção 16) e noindex por padrão (seção 17). As páginas
// indexáveis (/, /docs/*, /privacidade, /termos e as páginas de carreiras) sobrepõem com index.
import type { Metadata } from "next";
import { NOME_PRODUTO } from "@/lib/copy";
import "./globals.css";

export const metadata: Metadata = {
  title: NOME_PRODUTO,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
