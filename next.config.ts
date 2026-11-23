import type { NextConfig } from "next";

// Configuração do Next 16 (seção 4): Cache Components ligado, como no Assina.
// Cabeçalhos de segurança da seção 17, com a CSP "sem nonce" do Assina: com nonce, toda página
// precisaria de renderização dinâmica, inclusive as públicas. Os scripts têm 'unsafe-inline'
// (os scripts embutidos do Next), mas nunca 'unsafe-eval' em produção.
// O armazenamento (S3/R2, 8.4) entra em connect-src (o navegador faz o PUT do currículo direto) e em
// img-src/frame-src (logo e visualização, 8.9). Sem S3_ENDPOINT (dev), o upload vai para o próprio site.
// form-action: o consentimento do OAuth do MCP (8.2) volta para o redirect_uri do cliente.
const isDev = process.env.NODE_ENV === "development";
const armazenamento = (() => {
  try {
    return process.env.S3_ENDPOINT ? ` ${new URL(process.env.S3_ENDPOINT).origin}` : "";
  } catch {
    return "";
  }
})();
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://lh3.googleusercontent.com${armazenamento}`,
  "font-src 'self' data:",
  `connect-src 'self'${armazenamento}${isDev ? " ws:" : ""}`,
  `frame-src 'self'${armazenamento}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https: http://localhost:* http://127.0.0.1:*",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // O passo a passo de hospedagem fica só no README do GitHub (23/11/2026): o endereço antigo
  // da página leva para lá.
  async redirects() {
    return [{ source: "/docs/auto-hospedagem", destination: "https://github.com/asiqueira1973/contrata#hospedar-a-sua-inst%C3%A2ncia-passo-a-passo", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // Painel, convite e OAuth não se indexam (seção 17).
      // Link do candidato (seção 17): o token não vaza pelo Referer.
      { source: "/c/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/api/c/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      ...["/painel/:path*", "/convite/:path*", "/entrar", "/c", "/:empresa/vagas/:slug/candidatar", "/:empresa/links"].map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
};

export default nextConfig;
