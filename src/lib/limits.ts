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

// Vagas (7.3, 11.1, 11.14, 11.22): título 3–120; descrição até 20.000 (50+ para publicar);
// requisitos até 5.000; 1–15 etapas de 2–40 caracteres; 0–10 perguntas de 3–300, com 2–10 opções
// na escolha única; até 50 vagas publicadas ao mesmo tempo por empresa. O banco confere de novo.
export const VAGA_TITULO_MIN = 3;
export const VAGA_TITULO_MAX = 120;
export const VAGA_DESCRICAO_MAX = 20_000;
export const VAGA_DESCRICAO_PUBLICAR_MIN = 50;
export const VAGA_REQUISITOS_MAX = 5_000;
export const VAGA_SLUG_MAX = 140;
export const VAGA_CIDADE_MAX = 120;
export const VAGA_SALARIO_MAX = 9_999_999_999.99; // numeric(12, 2)
export const ETAPAS_MIN = 1;
export const ETAPAS_MAX = 15;
export const ETAPA_NOME_MIN = 2;
export const ETAPA_NOME_MAX = 40;
export const PERGUNTAS_MAX = 10;
export const PERGUNTA_TEXTO_MIN = 3;
export const PERGUNTA_TEXTO_MAX = 300;
export const PERGUNTA_OPCOES_MIN = 2;
export const PERGUNTA_OPCOES_MAX = 10;
export const PERGUNTA_OPCAO_MAX = 100;
export const VAGAS_PUBLICADAS_MAX = 50;
export const AVALIADORES_POR_VAGA_MAX = 50;

// Enums do banco (7.2), na ordem em que aparecem nos formulários.
export const STATUS_VAGA = ["rascunho", "publicada", "pausada", "encerrada"] as const;
export const MODELOS_TRABALHO = ["presencial", "hibrido", "remoto"] as const;
export const REGIMES = ["clt", "pj", "estagio", "temporario", "aprendiz", "trainee", "freelancer", "outro"] as const;
export const TIPOS_ETAPA = ["triagem", "entrevista", "avaliacao", "proposta"] as const;
export const TIPOS_PERGUNTA = ["texto_curto", "texto_longo", "sim_nao", "escolha_unica", "numero"] as const;
export const MOTIVOS_ENCERRAMENTO = ["preenchida", "cancelada", "outro"] as const;
export const PERIODOS_SALARIO = ["mes", "hora"] as const;
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

// Etapas padrão de toda vaga nova (7.3): constante, não tabela.
export const ETAPAS_PADRAO: { nome: string; tipo: (typeof TIPOS_ETAPA)[number] }[] = [
  { nome: "Triagem", tipo: "triagem" },
  { nome: "Entrevista com RH", tipo: "entrevista" },
  { nome: "Entrevista com a gestão", tipo: "entrevista" },
  { nome: "Proposta", tipo: "proposta" },
];

// Listas da API e do MCP (13.2, 13.3): cursor, 50 por página, até 200.
export const LISTA_PADRAO = 50;
export const LISTA_MAX = 200;
// Candidatura parada (11.11): 14 dias sem mudar de etapa.
export const CANDIDATURA_PARADA_DIAS = 14;
// Filtro "paradas" do funil (8.5): 7 dias sem mudar de etapa, ajustável na consulta.
export const FILTRO_PARADAS_DIAS = 7;
// Mover em lote (11.30) e exportar (14.1): até 100 por chamada; CSV com até 10.000 linhas.
export const MOVER_LOTE_MAX = 100;
export const EXPORTACAO_MAX = 10_000;
// Nota interna (11.34): até 10.000 caracteres, como o check de rs_notas.
export const NOTA_MAX = 10_000;
// Busca (11.28): até 50 resultados por página.
export const BUSCA_POR_PAGINA = 50;
// Decisões (11.7): até 50 por confirmação; encerrar vaga com mais de 1.000 ativas é recusado.
export const DECISOES_LOTE_MAX = 50;
export const ENCERRAR_VAGA_ATIVAS_MAX = 1000;
// Devolutiva (11.5): de 20 a 3.000 caracteres.
export const DEVOLUTIVA_MIN = 20;
export const DEVOLUTIVA_MAX = 3000;
// Mensagens diretas pela API (11.8): até 200 por empresa por dia.
export const MENSAGENS_API_POR_DIA = 200;
// Pedido de revisão (11.13): texto opcional de até 1.000.
export const REVISAO_TEXTO_MAX = 1000;
// Faxina (8.10, 11.11): lotes de 200.
export const FAXINA_LOTE = 200;
// Pré-visualização da página de carreiras não publicada (8.3): link assinado de 10 min.
export const PREVIA_PAGINA_SEGUNDOS = 600;
// Página de carreiras e de vaga (seção 17): cache de 60 s, revalidado ao editar.
export const PAGINA_PUBLICA_CACHE_S = 60;
// Idempotency-Key (13.2): 1 a 100 caracteres.
export const IDEMPOTENCIA_MAX = 100;
// Fuso de "hoje" (11.19).
export const FUSO = "America/Sao_Paulo";

// Candidatura (11.2, 11.4, 11.13, 11.14; 8.4).
export const CURRICULO_MAX_BYTES = 5 * 1024 * 1024;
// Currículo pelo chat (adicionar_candidato): vai em base64 no corpo do /mcp, e a Vercel recusa corpo
// acima de 4,5 MB; 3 MB viram ~4 MB em base64 (divergência da 11.2 registrada na v0.4.4).
export const CURRICULO_CHAT_MAX_BYTES = 3 * 1024 * 1024;
export const CURRICULO_TIPOS = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;
export const CANDIDATO_NOME_MIN = 2;
export const CANDIDATO_NOME_MAX = 120;
export const CANDIDATO_CIDADE_MAX = 120;
export const RESPOSTA_CURTA_MAX = 200;
export const RESPOSTA_LONGA_MAX = 3000;
export const RESPOSTA_NUMERO_MAX = 1e9;
export const NOME_ARQUIVO_MAX = 200;
// Upload direto: URL de 1 h; download do currículo e do JSON de dados: 5 min (14.2).
export const UPLOAD_URL_SEGUNDOS = 3600;
export const DOWNLOAD_URL_SEGUNDOS = 300;
// Concluir a candidatura: o token de conclusão vale 1 h (o mesmo prazo do upload).
export const CONCLUIR_TOKEN_SEGUNDOS = 3600;
// Extração do texto do currículo em segundo plano (seção 17: < 10 s para 5 MB; folga até 15 s).
export const EXTRACAO_TIMEOUT_MS = 15_000;
export const TEXTO_EXTRAIDO_MAX = 100_000;
// Anti-abuso (11.14): 10 candidaturas por IP por hora; 10.000 por vaga; 5 GB por empresa.
// "Perdi o link": 5 pedidos por IP e 3 por e-mail por hora (o spec não diz; mesma ordem de grandeza).
export const CANDIDATURAS_POR_IP_HORA = 10;
export const CANDIDATURAS_POR_VAGA_MAX = 10_000;
export const USO_EMPRESA_MAX_BYTES = 5 * 1024 ** 3;
// Alerta de banco (23.1): ao ADMIN_EMAIL acima de 70% do plano. O plano vem de ALERTA_BANCO_LIMITE_MB;
// sem ela, 500 MB (o plano gratuito do Supabase).
export const ALERTA_BANCO_LIMITE_MB_PADRAO = 500;
export const ALERTA_BANCO_FRACAO = 0.7;
export const LINKS_POR_IP_HORA = 5;
export const LINKS_POR_EMAIL_HORA = 3;
// Código de exclusão (11.13): 6 dígitos, 10 min, 5 tentativas; 1 por minuto e 5 por hora.
export const CODIGO_DIGITOS = 6;
export const CODIGO_VALIDADE_S = 600;
export const CODIGO_INTERVALO_S = 60;
export const CODIGOS_POR_HORA = 5;
export const CODIGO_TENTATIVAS = 5;
// Versão do aviso de privacidade padrão (15.5).
export const AVISO_PRIVACIDADE_VERSAO = "2026-11-20";

// Webhooks (8.8; 6, 11.17, 12.4): até 5 por empresa; POST com 10 s; resposta lida até 64 KB (só o
// status importa); até 8 tentativas em 3 dias; retentativas em 1 min, 10 min, 1 h e depois 1 por dia.
export const WEBHOOKS_POR_EMPRESA = 5;
export const WEBHOOK_URL_MAX = 500;
export const WEBHOOK_TIMEOUT_MS = 10_000;
export const WEBHOOK_RESPOSTA_MAX = 64 * 1024;
export const WEBHOOK_TENTATIVAS = 8;
export const WEBHOOK_DESISTE_DIAS = 3;
export const WEBHOOK_RETENTATIVAS_S = [60, 600, 3600, 86_400];
// Entregas vencidas enviadas de uma vez depois de cada escrita da empresa.
export const WEBHOOK_LOTE = 20;
// Tempo máximo de uma rodada de envios (a função da Vercel tem 60 s; cada POST, até 10 s).
export const WEBHOOK_ORCAMENTO_MS = 40_000;

// Empresa (8.9; 11.12, 11.20): contraste mínimo da cor de destaque com o branco (WCAG AA); logo
// PNG, JPG ou SVG até 1 MB; retenção 90–365 dias; banco de talentos 6–24 meses; exclusão desfeita
// em até 7 dias (7.4). O banco confere as mesmas faixas.
export const COR_CONTRASTE_MIN = 4.5;
export const LOGO_MAX_BYTES = 1024 * 1024;
export const RETENCAO_DIAS_MIN = 90;
export const RETENCAO_DIAS_MAX = 365;
export const TALENTOS_MESES_MIN = 6;
export const TALENTOS_MESES_MAX = 24;
export const EXCLUSAO_EMPRESA_DIAS = 7;
export const EMPRESA_DESCRICAO_MAX = 2000;
export const SITE_URL_MAX = 300;
export const COR_MAX = 7;
export const CONFIRMACAO_SLUG_MAX = 60;
export const AVISO_EXTRA_MAX = 1000;

// Faxina diária (8.10; 7.4, 11.11, 12.4): orçamento de 45 s (a função tem 60 s); e-mail descartado
// na 5ª falha; notificação enviada ou descartada apagada com 30 dias; revisão sem resposta há 15
// dias aparece como atrasada; link de "Pedir acesso" do resumo semanal vale 30 dias.
export const FAXINA_ORCAMENTO_MS = 45_000;
export const NOTIFICACAO_TENTATIVAS = 5;
export const NOTIFICACAO_GUARDA_DIAS = 30;
export const REVISAO_ATRASADA_DIAS = 15;
export const PEDIR_ACESSO_DIAS = 30;
// Empresas expurgadas por rodada (cada uma apaga uma pasta inteira no bucket) e quantas candidatas
// olhar (uma que falha sempre não segura as outras).
export const EMPRESAS_POR_RODADA = 5;
export const EMPRESAS_CANDIDATAS = 20;

// Analytics (8.11; seção 21): POST ao ingest com 4 s; chamada de API amostrada 1 a cada 10 s por
// credencial (lembrança em memória limitada); tetos dos números e textos das propriedades.
export const ANALYTICS_TIMEOUT_MS = 4000;
export const ANALYTICS_AMOSTRA_API_MS = 10_000;
export const ANALYTICS_AMOSTRAS_EM_MEMORIA = 5000;
export const ANALYTICS_NUMERO_MAX = 1_000_000_000;
export const ANALYTICS_CLIENTE_MAX = 60;
export const ANALYTICS_ROTA_MAX = 120;

// Site institucional: o botão "Copiar" mostra "Copiado" por 2 s.
export const COPIADO_MS = 2000;

// Instância aberta (CRIACAO_EMPRESA_EMAILS com "*", v0.4.19): cada conta Google cria 1 empresa;
// quem está nominalmente na lista não tem limite.
export const EMPRESAS_POR_CONTA_ABERTA = 1;
