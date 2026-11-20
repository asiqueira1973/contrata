// Chamada às rotas do painel a partir do cliente. Devolve ok ou o código e a mensagem de erro da
// rota (13.2: {codigo, mensagem}); falha de rede vira a mensagem genérica. Nunca mostra sucesso
// quando a escrita falhou: quem chama só dá router.refresh() depois de ok.
import { mensagemDeErro } from "@/lib/copy";

export type Resultado<T = unknown> = { ok: true; data: T } | { ok: false; codigo: string; mensagem: string };

export async function request<T = unknown>(method: string, url: string, body?: unknown): Promise<Resultado<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = res.status === 204 ? null : await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: json as T };
    const codigo = (json as { codigo?: string } | null)?.codigo ?? "generico";
    return { ok: false, codigo, mensagem: mensagemDeErro(codigo) };
  } catch {
    return { ok: false, codigo: "generico", mensagem: mensagemDeErro("generico") };
  }
}
