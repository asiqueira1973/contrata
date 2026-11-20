// [Público] Documentação da API (seção 10.1). No 8.2: aponta o documento OpenAPI e a regra de
// autenticação; o guia completo (com /docs/mcp) entra no 8.12.
import type { Metadata } from "next";
import { NOME_PRODUTO } from "@/lib/copy";
import ui from "@/components/ui/ui.module.css";

export const metadata: Metadata = { title: `API — ${NOME_PRODUTO}`, robots: { index: true, follow: true } };

export default function DocsApiPage() {
  return (
    <main className={ui.narrow}>
      <h1 className={ui.narrowTitle}>API v1</h1>
      <div className={ui.card}>
        <p className={ui.rowMeta}>
          <a href="/api/v1/openapi.json">/api/v1/openapi.json</a>
        </p>
      </div>
    </main>
  );
}
