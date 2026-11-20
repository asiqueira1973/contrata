// Host de formulários SÓ PARA DESENVOLVIMENTO (plano 8.2, verificação): faz o papel do Claude ou
// do ChatGPT. Chama abrir_formulario_* no /mcp com a capacidade MCP Apps, lê o HTML do recurso
// ui://, monta o formulário num iframe isolado e repassa ao /mcp as chamadas que o formulário faz
// (opções e salvar_*), pelo AppBridge do ext-apps. Nunca é servido em produção.
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";

const CAPS = { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } } };
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const log = (m: string) => ($("log").textContent = `${m}\n${$("log").textContent ?? ""}`.slice(0, 4000));
let id = 0;

async function rpc(method: string, params: Record<string, unknown>) {
  const res = await fetch("/mcp", {
    method: "POST",
    headers: { authorization: `Bearer ${$<HTMLInputElement>("token").value}`, "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params: { ...params, _meta: { "io.modelcontextprotocol/clientCapabilities": CAPS } } }),
  });
  const text = await res.text();
  const data = text.includes("data:") ? text.split("\n").find((l) => l.startsWith("data:"))!.slice(5) : text;
  const body = JSON.parse(data);
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

async function listar() {
  const r = await rpc("tools/list", {});
  const sel = $<HTMLSelectElement>("ferramenta");
  sel.replaceChildren(...r.tools.filter((t: { name: string }) => t.name.startsWith("abrir_formulario_")).map((t: { name: string }) => new Option(t.name, t.name)));
}

async function abrir() {
  const nome = $<HTMLSelectElement>("ferramenta").value;
  const args = JSON.parse($<HTMLInputElement>("args").value || "{}");
  const escuro = $<HTMLInputElement>("escuro").checked;
  document.body.classList.toggle("escuro", escuro);
  const ferramenta = (await rpc("tools/list", {})).tools.find((t: { name: string }) => t.name === nome);
  const uri = ferramenta._meta.ui.resourceUri as string;
  const html = (await rpc("resources/read", { uri })).contents[0].text as string;
  const resultado = await rpc("tools/call", { name: nome, arguments: args });
  log(`abriu ${nome}: ${resultado.content?.[0]?.text ?? ""}`);
  // A ponte liga ANTES de carregar o HTML: o formulário manda o initialize assim que carrega.
  const antigo = $<HTMLIFrameElement>("app");
  const iframe = antigo.cloneNode() as HTMLIFrameElement;
  antigo.replaceWith(iframe);
  // Os hosts reais (Claude, ChatGPT) mandam as variáveis de cor do tema; o de teste imita os dois.
  const variables = escuro
    ? { "--color-background-primary": "#262624", "--color-background-secondary": "#30302e", "--color-text-primary": "#f5f4ef", "--color-text-secondary": "#b7b5a9", "--color-border-primary": "#4a4945" }
    : { "--color-background-primary": "#ffffff", "--color-background-secondary": "#f5f4ef", "--color-text-primary": "#1a1a19", "--color-text-secondary": "#5e5d59", "--color-border-primary": "#d6d5d0" };
  const hostContext = { theme: escuro ? "dark" : "light", styles: { variables } } as unknown as ConstructorParameters<typeof AppBridge>[3] extends infer O ? O extends { hostContext?: infer H } ? H : never : never;
  const bridge = new AppBridge(null, { name: "dev-host", version: "1.0.0" }, { serverTools: {}, openLinks: {}, logging: {} }, { hostContext });
  bridge.oncalltool = async (params) => {
    const r = await rpc("tools/call", { name: params.name, arguments: params.arguments ?? {} });
    log(`formulário chamou ${params.name}: ${r.content?.[0]?.text ?? ""}`);
    return r;
  };
  bridge.oninitialized = () => {
    void bridge.sendToolInput({ arguments: args });
    void bridge.sendToolResult(resultado);
  };
  await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
  iframe.srcdoc = html;
}

$("token").addEventListener("change", () => void listar().catch((e) => log(String(e))));
$("abrir").addEventListener("click", () => void abrir().catch((e) => log(String(e))));
