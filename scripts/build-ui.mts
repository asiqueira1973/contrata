// Monta o formulário genérico (seção 4): ui/formulario/index.html vira um HTML único e é embutido
// em src/server/mcp/ui/generated.ts (fora do git). Falha acima de 300 KB (seção 17).
// Roda antes de dev, build, typecheck e dos testes (package.json).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { build } from "vite";
import { FORMULARIO_HTML_MAX_BYTES } from "../src/lib/limits";

// O build do Vite troca NODE_ENV para production: lê antes.
const DESENVOLVIMENTO = process.env.NODE_ENV !== "production";
process.env.UI_ENTRADA = "formulario";
await build({ configFile: "vite.config.mts", logLevel: "warn" });
const html = readFileSync("ui/dist/formulario/index.html", "utf8");
const bytes = Buffer.byteLength(html);
if (bytes > FORMULARIO_HTML_MAX_BYTES) {
  console.error(`ui/formulario: ${bytes} bytes, acima do limite de ${FORMULARIO_HTML_MAX_BYTES} (seção 17).`);
  process.exit(1);
}
console.log(`ui/formulario: ${(bytes / 1024).toFixed(1)} KB`);
mkdirSync("src/server/mcp/ui", { recursive: true });
writeFileSync(
  "src/server/mcp/ui/generated.ts",
  `// GERADO por scripts/build-ui.mts a partir de ui/formulario. Não edite.\nexport const FORMULARIO_HTML: string = ${JSON.stringify(html)};\n`,
);

// Host de formulários só para desenvolvimento (ui/dev-host): vai para ui/dist/dev-host, nunca
// para o servidor. A rota /dev/formularios lê esse arquivo só com NODE_ENV=development.
if (DESENVOLVIMENTO) {
  process.env.UI_ENTRADA = "dev-host";
  await build({ configFile: "vite.config.mts", logLevel: "warn" });
}
