import type { NextConfig } from "next";

// Configuração do Next 16 (seção 4): Cache Components ligado, como no Assina.
// Cabeçalhos de segurança da seção 17, com a CSP "sem nonce" do Assina: com nonce, toda página
// precisaria de renderização dinâmica, inclusive as públicas. Os scripts têm 'unsafe-inline'
// (os scripts embutidos do Next), mas nunca 'unsafe-eval' em produção.
// O domínio do armazenamento (R2/S3) entra em img-src/connect-src/frame-src no épico 8.4.
// form-action: o consentimento do OAuth do MCP (8.2) volta para o redirect_uri do cliente.
const isDev = process.env.NODE_ENV === "development";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https: http://localhost:* http://127.0.0.1:*",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
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
      ...["/painel/:path*", "/convite/:path*", "/entrar"].map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
};

export default nextConfig;
