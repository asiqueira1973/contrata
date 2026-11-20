// Números do produto, cada um com a regra que o define (seção 18: números só aqui).

// Sessão do painel (6.1): 30 dias, renovada depois de 7.
export const SESSAO_DIAS = 30;
export const SESSAO_RENOVAR_DEPOIS_DIAS = 7;
// Cookie curto do login com Google (6.1).
export const OAUTH_GOOGLE_MINUTOS = 10;

// Convite de membro (11.24): vale 7 dias; até 50 pendentes por empresa.
export const CONVITE_DIAS = 7;
export const CONVITES_PENDENTES_MAX = 50;

// Tokens do sistema (6.2, 11.4): 32 bytes aleatórios, só o hash no banco.
export const TOKEN_BYTES = 32;

// Empresa (7.3, 11.20).
export const EMPRESA_NOME_MIN = 2;
export const EMPRESA_NOME_MAX = 80;
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;
export const SLUG_FORMATO = /^[a-z0-9](-?[a-z0-9])*$/;
// Regra 11.20 (endereços públicos) e, além dela, as rotas fixas de /painel/{slug} que colidiriam
// com uma empresa de mesmo nome (nova, conta, boas-vindas): divergência registrada no plano 8.1.
export const SLUGS_RESERVADOS = [
  "painel", "entrar", "sair", "api", "mcp", "oauth", "docs", "c", "privacidade", "termos", ".well-known", "admin",
  "sitemap.xml", "robots.txt", "convite", "nova", "conta", "boas-vindas",
] as const;

// Áreas e pessoas (7.3).
export const AREA_NOME_MIN = 2;
export const AREA_NOME_MAX = 60;
export const PESSOA_NOME_MIN = 2;
export const PESSOA_NOME_MAX = 120;
export const CARGO_MAX = 120;
export const EMAIL_MAX = 254;

// Papéis em ordem de poder (seção 5): o guardião compara pelo índice.
export const PAPEIS = ["avaliador", "recrutador", "administrador"] as const;
export type Papel = (typeof PAPEIS)[number];

// Envio de e-mail (seção 4): o Resend responde em menos que isso.
export const EMAIL_TIMEOUT_MS = 10_000;
