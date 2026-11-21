// [Público] robots.txt (seção 17): bloqueia /c/, /api/, /oauth/, /mcp, /entrar, /sair e /convite/;
// aponta o sitemap.
import type { MetadataRoute } from "next";
import { siteOrigin } from "@/server/oauth/server";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/c/", "/api/", "/oauth/", "/mcp", "/entrar", "/sair", "/convite/", "/dev/"] },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
