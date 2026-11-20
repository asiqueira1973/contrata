// GET /dev/formularios — host de formulários SÓ PARA DESENVOLVIMENTO (plano 8.2, verificação):
// devolve ui/dist/dev-host/index.html, que faz o papel do Claude para ver os formulários de verdade.
// Em produção responde 404 sem ler nada do disco.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function GET() {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  const html = await readFile(join(process.cwd(), "ui", "dist", "dev-host", "index.html"), "utf8").catch(() => null);
  return html ? new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }) : new Response(null, { status: 404 });
}
