// Modelos de e-mail — seção 15.4 (texto em copy.ts) e 16 (HTML simples, fundo branco, título
// grande, botão em pílula, rodapé discreto). Todo valor variável passa por escapeHtml.
import "server-only";
import { NOME_PRODUTO, copy } from "@/lib/copy";
import type { Papel } from "@/lib/limits";

// Escapa texto para HTML. Recebe: texto livre. Devolve: texto seguro dentro de tags.
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Moldura comum: título, parágrafos, botão e rodapé. Cor do botão: a da empresa ou o azul (16).
function layout(titulo: string, paragrafos: string[], botao: { texto: string; url: string }, cor = "#0071e3"): string {
  const ps = paragrafos.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#1d1d1f">${escapeHtml(p)}</p>`).join("");
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:32px 16px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif">
<div style="max-width:520px;margin:0 auto">
<h1 style="margin:0 0 20px;font-size:26px;letter-spacing:-0.02em;color:#1d1d1f">${escapeHtml(titulo)}</h1>
${ps}
<p style="margin:24px 0"><a href="${escapeHtml(botao.url)}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:${cor};color:#ffffff;font-weight:600;text-decoration:none">${escapeHtml(botao.texto)}</a></p>
<p style="margin:32px 0 0;font-size:12px;color:#6e6e73">${escapeHtml(NOME_PRODUTO)}</p>
</div></body></html>`;
}

// convite_membro (15.4). Recebe: empresa, quem convidou, papel, e-mail convidado e o link.
export function conviteMembro(p: { empresa: string; quemConvidou: string; papel: Papel; email: string; url: string }) {
  const c = copy.emailConviteMembro;
  const assunto = c.assunto(p.empresa);
  const corpo = c.corpo(p.quemConvidou, p.papel, p.email);
  return {
    assunto,
    html: layout(assunto, [corpo, c.validade], { texto: c.botao, url: p.url }),
    texto: `${corpo}\n\n${c.botao}: ${p.url}\n\n${c.validade}`,
  };
}
