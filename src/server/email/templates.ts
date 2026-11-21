// Modelos de e-mail — seção 15.4 (texto em copy.ts) e 16 (HTML simples, fundo branco, título
// grande, botão em pílula, rodapé discreto). Todo valor variável passa por escapeHtml.
import "server-only";
import { NOME_PRODUTO, copy } from "@/lib/copy";
import type { Papel } from "@/lib/limits";

// Escapa texto para HTML. Recebe: texto livre. Devolve: texto seguro dentro de tags.
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Moldura comum: título, parágrafos, botão (opcional) e rodapé. Cor do botão: a da empresa ou o
// azul (16). `depois`: parágrafos depois do botão; `rodape`: o texto do rodapé (a candidato, 15.4);
// `htmlExtra`: HTML já escapado que entra depois dos parágrafos (a lista de links).
function layout(titulo: string, paragrafos: string[], botao: { texto: string; url: string } | null, cor = "#0071e3", depois: string[] = [], rodape = NOME_PRODUTO, htmlExtra = ""): string {
  const p = (t: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#1d1d1f">${escapeHtml(t)}</p>`;
  const ps = paragrafos.map(p).join("");
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:32px 16px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif">
<div style="max-width:520px;margin:0 auto">
<h1 style="margin:0 0 20px;font-size:26px;letter-spacing:-0.02em;color:#1d1d1f">${escapeHtml(titulo)}</h1>
${ps}${htmlExtra}
${botao ? `<p style="margin:24px 0"><a href="${escapeHtml(botao.url)}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:${cor};color:#ffffff;font-weight:600;text-decoration:none">${escapeHtml(botao.texto)}</a></p>` : ""}
${depois.map(p).join("")}
<p style="margin:32px 0 0;font-size:12px;color:#6e6e73">${escapeHtml(rodape)}</p>
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

// Cor do botão: a de destaque da empresa (já validada no banco, #rrggbb) ou o azul.
const corDe = (cor: string | null | undefined) => (cor && /^#[0-9a-f]{6}$/.test(cor) ? cor : "#0071e3");

// candidatura_recebida (15.4), na versão da página e na manual (11.2). Recebe: empresa, vaga,
// nome, link /c/{token} e se foi incluída pela empresa.
export function candidaturaRecebida(p: { empresa: string; cor?: string | null; vaga: string; nome: string; url: string; manual: boolean }) {
  const c = p.manual ? copy.emailCandidato.manual : copy.emailCandidato.recebida;
  const assunto = p.manual ? copy.emailCandidato.manual.assunto(p.empresa, p.vaga) : copy.emailCandidato.recebida.assunto(p.vaga);
  const corpo = p.manual ? copy.emailCandidato.manual.corpo(p.nome, p.empresa, p.vaga) : copy.emailCandidato.recebida.corpo(p.nome, p.empresa);
  const rodape = copy.emailCandidato.rodape(p.empresa);
  return {
    assunto,
    html: layout(assunto, [corpo], { texto: c.botao, url: p.url }, corDe(p.cor), [c.depois], rodape),
    texto: `${corpo}\n\n${c.botao}: ${p.url}\n\n${c.depois}\n\n${rodape}`,
    // Versão guardada em rs_mensagens: sem o link (20.3); a variável fica no lugar dele (11.29).
    corpoGuardado: `${corpo} {{link_acompanhamento}}\n\n${c.depois}`,
  };
}

// Desistência (mensagem_candidato, tipo desistencia). Recebe: empresa, vaga, nome e o link.
export function candidaturaRetirada(p: { empresa: string; cor?: string | null; vaga: string; nome: string; url: string }) {
  const c = copy.emailCandidato.retirada;
  const assunto = c.assunto(p.vaga);
  const corpo = c.corpo(p.nome, p.empresa, p.vaga);
  const rodape = copy.emailCandidato.rodape(p.empresa);
  return {
    assunto,
    html: layout(assunto, [corpo], { texto: c.botao, url: p.url }, corDe(p.cor), [], rodape),
    texto: `${corpo}\n\n${c.botao}: ${p.url}\n\n${rodape}`,
    corpoGuardado: corpo,
  };
}

// links_reenviados ("Perdi o link", 6.2). Recebe: empresa e a lista {vaga, url}.
export function linksReenviados(p: { empresa: string; cor?: string | null; links: { vaga: string; url: string }[] }) {
  const c = copy.emailCandidato.links;
  const assunto = c.assunto(p.empresa);
  const rodape = copy.emailCandidato.rodape(p.empresa);
  const itens = p.links.map((l) => `<li style="margin:0 0 10px"><a href="${escapeHtml(l.url)}" style="color:${corDe(p.cor)}">${escapeHtml(l.vaga)}</a></li>`).join("");
  const html = layout(assunto, [c.corpo(p.empresa)], null, corDe(p.cor), [c.depois], rodape, `<ul style="padding-left:20px;font-size:16px">${itens}</ul>`);
  return {
    assunto,
    html,
    texto: `${c.corpo(p.empresa)}\n\n${p.links.map((l) => `${l.vaga}: ${l.url}`).join("\n")}\n\n${c.depois}\n\n${rodape}`,
  };
}

// codigo_exclusao (11.13). Recebe: empresa e o código.
export function codigoExclusao(p: { empresa: string; codigo: string }) {
  const c = copy.emailCandidato.codigo;
  // O assunto fica na fila depois do envio (só html e texto são apagados): o código vai só no corpo (20.3).
  const assunto = c.assunto(p.empresa);
  const rodape = copy.emailCandidato.rodape(p.empresa);
  return {
    assunto,
    html: layout(assunto, [c.corpo(p.empresa, p.codigo)], null, "#0071e3", [], rodape),
    texto: `${c.corpo(p.empresa, p.codigo)}\n\n${rodape}`,
  };
}
