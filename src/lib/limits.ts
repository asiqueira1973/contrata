// Números do produto, cada um com a regra que o define (seção 18: números só aqui).

// Sessão web (6.1: entrar, consentir, convite): 30 dias, renovada depois de 7.
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
// Regra 11.20 (endereços públicos), mais convite, nova, conta e boas-vindas (reservados no 8.1,
// quando havia painel; ficam reservados para não liberar endereços já recusados).
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

// Áreas por recrutador limitado num pedido (teto de sanidade do schema; a empresa raramente passa de 20).
export const AREAS_POR_MEMBRO_MAX = 100;

// Papéis em ordem de poder (seção 5): o guardião compara pelo índice.
export const PAPEIS = ["avaliador", "recrutador", "administrador"] as const;
export type Papel = (typeof PAPEIS)[number];

// Envio de e-mail (seção 4): o Resend responde em menos que isso.
export const EMAIL_TIMEOUT_MS = 10_000;

// Credenciais de máquina (6.3, 11.15): prefixos fixos, 32 bytes, prefixo de 8 para exibir,
// até 10 chaves de API ativas por empresa, último uso gravado no máximo uma vez por minuto.
export const PREFIXO_CHAVE_API = "rsk_";
export const PREFIXO_TOKEN_MCP = "rsm_";
export const CREDENCIAL_PREFIXO_TAMANHO = 8;
export const CHAVES_API_ATIVAS_MAX = 10;
export const CREDENCIAL_NOME_MAX = 100;
export const ULTIMO_USO_INTERVALO_S = 60;

// OAuth do MCP (6.4), como no Assina: código vale 10 min; até 5 redirect_uris de até 500
// caracteres; nome do cliente até 100; code_verifier de 43 a 128 caracteres (RFC 7636).
export const OAUTH_CODIGO_SEGUNDOS = 600;
export const OAUTH_REDIRECT_URIS_MAX = 5;
export const OAUTH_REDIRECT_URI_MAX = 500;
export const OAUTH_CLIENTE_NOME_MAX = 100;
export const PKCE_VERIFIER_MIN = 43;
export const PKCE_VERIFIER_MAX = 128;

// Escopos (6.3): escrita implica leitura; decisao implica as duas.
export const ESCOPOS = ["leitura", "escrita", "decisao"] as const;
export type Escopo = (typeof ESCOPOS)[number];

// Fallback com prévia (13.5): o token da prévia vale 10 min.
export const PREVIA_SEGUNDOS = 600;
// Formulários MCP Apps (seção 17): cada HTML até 300 KB.
export const FORMULARIO_HTML_MAX_BYTES = 300 * 1024;
