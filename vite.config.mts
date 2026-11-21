// Build do formulário genérico do chat (seção 4, padrão do Agenda Psi): HTML, CSS e JS num arquivo
// só (vite-plugin-singlefile), que o servidor embute como string. Saída em ui/dist/formulario/;
// scripts/build-ui.mts gera src/server/mcp/ui/generated.ts a partir dela. O alias "@" deixa o
// formulário ler a copy de src/lib/copy.ts (copy num lugar só, seção 18).
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Qual página montar: o formulário (padrão, embutido no servidor) ou o host de desenvolvimento.
const ENTRADA = process.env.UI_ENTRADA ?? "formulario";

export default defineConfig({
  root: `ui/${ENTRADA}`,
  plugins: [viteSingleFile()],
  resolve: { alias: { "@": resolve(import.meta.dirname, "src") } },
  // copy.ts lê o nome do produto do ambiente; no formulário (navegador) ele vem fixo do build.
  define: { "process.env.NEXT_PUBLIC_NOME_PRODUTO": JSON.stringify(process.env.NEXT_PUBLIC_NOME_PRODUTO ?? "Vaga Aberta") },
  build: {
    outDir: `../dist/${ENTRADA}`,
    emptyOutDir: true,
    rollupOptions: { input: resolve(import.meta.dirname, "ui", ENTRADA, "index.html") },
  },
  logLevel: "warn",
});
