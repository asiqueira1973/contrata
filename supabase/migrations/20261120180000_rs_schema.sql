-- Contrata — schema (spec.md v0.3, seções 7.1 a 7.3 e 6.5).
-- Banco em português, snake_case, prefixo rs_ (projeto compartilhado; nunca db push).
-- Todas as tabelas: RLS ligada, nenhuma política, REVOKE ALL de anon e authenticated (6.5).
-- O acesso é só pelo servidor, com a service role, que filtra por empresa_id e alcance.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------- enums (7.2)
create type public.rs_papel_membro as enum ('administrador', 'recrutador', 'avaliador');
create type public.rs_tipo_credencial as enum ('api', 'mcp');
create type public.rs_escopo as enum ('leitura', 'escrita', 'decisao');
create type public.rs_status_vaga as enum ('rascunho', 'publicada', 'pausada', 'encerrada');
create type public.rs_motivo_encerramento_vaga as enum ('preenchida', 'cancelada', 'outro');
create type public.rs_modelo_trabalho as enum ('presencial', 'hibrido', 'remoto');
create type public.rs_regime as enum ('clt', 'pj', 'estagio', 'temporario', 'aprendiz', 'trainee', 'freelancer', 'outro');
create type public.rs_tipo_etapa as enum ('triagem', 'entrevista', 'avaliacao', 'proposta');
create type public.rs_papel_na_vaga as enum ('responsavel', 'avaliador');
create type public.rs_tipo_pergunta as enum ('texto_curto', 'texto_longo', 'sim_nao', 'escolha_unica', 'numero');
create type public.rs_situacao_candidatura as enum ('ativa', 'reprovada', 'desistiu', 'contratada', 'encerrada_vaga');
create type public.rs_motivo_reprovacao as enum ('requisitos', 'experiencia', 'perfil', 'pretensao_salarial', 'localizacao', 'outro_candidato', 'sem_retorno', 'outro');
create type public.rs_origem_candidatura as enum ('pagina', 'api_publica', 'integracao', 'manual', 'banco_talentos');
create type public.rs_tipo_arquivo as enum ('curriculo', 'anexo', 'logo');
create type public.rs_status_extracao as enum ('pendente', 'ok', 'sem_texto', 'falhou');
create type public.rs_recomendacao as enum ('forte_sim', 'sim', 'nao', 'forte_nao');
create type public.rs_tipo_decisao as enum ('reprovar', 'contratar', 'encerrar_vaga', 'enviar_mensagem');
create type public.rs_status_decisao as enum ('pendente', 'confirmada', 'descartada', 'expirada');
create type public.rs_tipo_ator as enum ('membro', 'candidato', 'sistema', 'api', 'agente');
create type public.rs_origem_evento as enum ('painel', 'api', 'mcp', 'publico', 'cron');
create type public.rs_tipo_mensagem as enum ('confirmacao', 'devolutiva', 'contato', 'convite_vaga', 'desistencia', 'resposta_revisao');
create type public.rs_mensagens_agente as enum ('confirmar', 'direto');
create type public.rs_tipo_notificacao as enum ('convite_membro', 'candidatura_recebida', 'mensagem_candidato', 'links_reenviados', 'codigo_exclusao', 'resumo_diario', 'decisoes_pendentes', 'revisao_pedida', 'talentos_expirando', 'resumo_dono_vaga');
create type public.rs_status_notificacao as enum ('pendente', 'enviada', 'falhou', 'descartada');
create type public.rs_status_entrega as enum ('pendente', 'entregue', 'falhou', 'desistiu');

-- ---------------------------------------------------------------- pessoas, empresas e acesso
-- Pessoa que entra no painel; login só pelo Google (6.1).
create table public.rs_usuarios (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique,
  nome text not null,
  google_sub text not null unique,
  foto_url text,
  termos_aceitos_em timestamptz,
  suspenso_em timestamptz,
  ultimo_acesso_em timestamptz,
  criado_em timestamptz not null default now()
);

-- O inquilino: todo dado de recrutamento pertence a uma empresa.
create table public.rs_empresas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    constraint rs_empresas_slug_formato check (slug ~ '^[a-z0-9](-?[a-z0-9])*$' and char_length(slug) between 3 and 40),
  nome text not null constraint rs_empresas_nome_tamanho check (char_length(nome) between 2 and 80),
  descricao text constraint rs_empresas_descricao_tamanho check (char_length(descricao) <= 2000),
  site_url text constraint rs_empresas_site_https check (site_url ~ '^https://'),
  logo_path text,
  cor_destaque text constraint rs_empresas_cor_formato check (cor_destaque ~ '^#[0-9a-f]{6}$'),
  email_contato extensions.citext not null,
  pagina_publicada boolean not null default false,
  retencao_dias smallint not null default 180 constraint rs_empresas_retencao check (retencao_dias between 90 and 365),
  talentos_meses smallint not null default 12 constraint rs_empresas_talentos check (talentos_meses between 6 and 24),
  mensagens_agente public.rs_mensagens_agente not null default 'confirmar',
  aviso_privacidade_extra text constraint rs_empresas_aviso_tamanho check (char_length(aviso_privacidade_extra) <= 1000),
  criada_por_usuario_id uuid not null references public.rs_usuarios (id),
  suspensa_em timestamptz,
  excluida_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Vínculo pessoa × empresa, incluindo convites pendentes (usuario_id nulo até aceitar).
create table public.rs_membros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  usuario_id uuid references public.rs_usuarios (id),
  email extensions.citext not null,
  papel public.rs_papel_membro not null,
  todas_areas boolean not null default true,
  link_agenda text constraint rs_membros_agenda_https check (link_agenda ~ '^https://'),
  convite_token_hash text unique,
  convite_expira_em timestamptz,
  convidado_por_membro_id uuid references public.rs_membros (id),
  aceito_em timestamptz,
  removido_em timestamptz,
  criado_em timestamptz not null default now(),
  -- Convite pendente tem token e prazo; aceito não tem nenhum dos dois (11.24).
  constraint rs_membros_convite_coerente check (
    (usuario_id is null and aceito_em is null)
    or (usuario_id is not null and aceito_em is not null and convite_token_hash is null and convite_expira_em is null)
  ),
  -- Administrador sempre vê tudo; avaliador sempre só a equipe (11.32): só recrutador limita.
  constraint rs_membros_todas_areas check (todas_areas or papel = 'recrutador')
);
create unique index rs_membros_email_ativo on public.rs_membros (empresa_id, email) where removido_em is null;
create unique index rs_membros_usuario_ativo on public.rs_membros (empresa_id, usuario_id) where removido_em is null and usuario_id is not null;
create index rs_membros_usuario on public.rs_membros (usuario_id) where removido_em is null;
create index rs_membros_convidado_por on public.rs_membros (convidado_por_membro_id);

-- Departamentos da empresa, um nível (24.3). A FK do responsável entra depois de rs_pessoas.
create table public.rs_areas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  nome text not null constraint rs_areas_nome_tamanho check (char_length(nome) between 2 and 60),
  responsavel_pessoa_id uuid,
  arquivada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index rs_areas_nome_ativa on public.rs_areas (empresa_id, lower(nome)) where arquivada_em is null;

-- Recrutador limitado a áreas (11.32): só tem linhas quando todas_areas = false.
create table public.rs_membro_areas (
  membro_id uuid not null references public.rs_membros (id) on delete cascade,
  area_id uuid not null references public.rs_areas (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (membro_id, area_id)
);
create index rs_membro_areas_area on public.rs_membro_areas (area_id);

-- Gente da empresa que participa do recrutamento, com ou sem acesso (11.31).
create table public.rs_pessoas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  nome text not null constraint rs_pessoas_nome_tamanho check (char_length(nome) between 2 and 120),
  email extensions.citext not null,
  cargo text constraint rs_pessoas_cargo_tamanho check (char_length(cargo) <= 120),
  area_id uuid references public.rs_areas (id),
  membro_id uuid unique references public.rs_membros (id),
  recebe_resumo boolean not null default true,
  arquivada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index rs_pessoas_email_ativa on public.rs_pessoas (empresa_id, email) where arquivada_em is null;
create index rs_pessoas_area on public.rs_pessoas (area_id);

alter table public.rs_areas
  add constraint rs_areas_responsavel_fk foreign key (responsavel_pessoa_id) references public.rs_pessoas (id);
create index rs_areas_responsavel on public.rs_areas (responsavel_pessoa_id);

-- Clientes do OAuth do MCP (DCR, 6.4). O id é o client_id.
create table public.rs_oauth_clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null default 'Cliente MCP' constraint rs_oauth_clientes_nome check (char_length(nome) <= 100),
  redirect_uris text[] not null constraint rs_oauth_clientes_uris check (cardinality(redirect_uris) between 1 and 5),
  criado_em timestamptz not null default now()
);

-- Chaves de API e tokens MCP; só o hash (6.3).
create table public.rs_credenciais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  tipo public.rs_tipo_credencial not null,
  nome text not null constraint rs_credenciais_nome check (char_length(nome) between 1 and 100),
  prefixo text not null,
  valor_hash text not null unique,
  escopos public.rs_escopo[] not null constraint rs_credenciais_escopos check (cardinality(escopos) > 0),
  membro_id uuid references public.rs_membros (id),
  oauth_cliente_id uuid references public.rs_oauth_clientes (id) on delete set null,
  criada_por_membro_id uuid not null references public.rs_membros (id),
  ultimo_uso_em timestamptz,
  revogada_em timestamptz,
  criado_em timestamptz not null default now(),
  -- Token MCP pertence a um membro; chave de API é da empresa (6.3).
  constraint rs_credenciais_membro check ((tipo = 'mcp') = (membro_id is not null)),
  constraint rs_credenciais_cliente check (tipo = 'mcp' or oauth_cliente_id is null)
);
create index rs_credenciais_empresa on public.rs_credenciais (empresa_id) where revogada_em is null;
create index rs_credenciais_membro on public.rs_credenciais (membro_id) where revogada_em is null;
create index rs_credenciais_criada_por on public.rs_credenciais (criada_por_membro_id);
create index rs_credenciais_cliente on public.rs_credenciais (oauth_cliente_id);

-- Códigos de autorização do OAuth, com empresa, membro e escopos escolhidos (6.4).
create table public.rs_oauth_codigos (
  codigo_hash text primary key,
  cliente_id uuid not null references public.rs_oauth_clientes (id) on delete cascade,
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  membro_id uuid not null references public.rs_membros (id) on delete cascade,
  escopos public.rs_escopo[] not null constraint rs_oauth_codigos_escopos check (cardinality(escopos) > 0),
  redirect_uri text not null,
  code_challenge text not null,
  expira_em timestamptz not null default now() + interval '10 minutes',
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index rs_oauth_codigos_cliente on public.rs_oauth_codigos (cliente_id);
create index rs_oauth_codigos_empresa on public.rs_oauth_codigos (empresa_id);
create index rs_oauth_codigos_membro on public.rs_oauth_codigos (membro_id);

-- ---------------------------------------------------------------- vagas
create table public.rs_vagas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  slug text not null constraint rs_vagas_slug_formato check (slug ~ '^[a-z0-9](-?[a-z0-9])*$' and char_length(slug) <= 140),
  titulo text not null constraint rs_vagas_titulo_tamanho check (char_length(titulo) between 3 and 120),
  descricao text not null default '' constraint rs_vagas_descricao_tamanho check (char_length(descricao) <= 20000),
  requisitos text constraint rs_vagas_requisitos_tamanho check (char_length(requisitos) <= 5000),
  area_id uuid references public.rs_areas (id),
  dono_pessoa_id uuid references public.rs_pessoas (id),
  modelo_trabalho public.rs_modelo_trabalho not null default 'presencial',
  cidade text,
  uf char(2) constraint rs_vagas_uf_formato check (uf ~ '^[A-Z]{2}$'),
  regime public.rs_regime not null default 'clt',
  salario_min numeric(12, 2),
  salario_max numeric(12, 2),
  salario_periodo text constraint rs_vagas_salario_periodo check (salario_periodo in ('mes', 'hora')),
  mostrar_salario boolean not null default false,
  curriculo_obrigatorio boolean not null default true,
  status public.rs_status_vaga not null default 'rascunho',
  encerra_em date,
  publicada_em timestamptz,
  encerrada_em timestamptz,
  motivo_encerramento public.rs_motivo_encerramento_vaga,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint rs_vagas_slug_unico unique (empresa_id, slug),
  -- Cidade e UF obrigatórias fora do remoto (7.3).
  constraint rs_vagas_local check (modelo_trabalho = 'remoto' or (cidade is not null and uf is not null)),
  -- Salário: max ≥ min > 0, e período quando houver salário (11.1).
  constraint rs_vagas_salario check (
    (salario_min is null or salario_min > 0)
    and (salario_max is null or salario_max > 0)
    and (salario_min is null or salario_max is null or salario_max >= salario_min)
    and ((salario_min is null and salario_max is null) or salario_periodo is not null)
  ),
  -- Encerrada tem motivo e data (12.1).
  constraint rs_vagas_encerrada check (status <> 'encerrada' or (motivo_encerramento is not null and encerrada_em is not null))
);
create index rs_vagas_empresa_status on public.rs_vagas (empresa_id, status);
create index rs_vagas_area on public.rs_vagas (area_id);
create index rs_vagas_dono on public.rs_vagas (dono_pessoa_id);

create table public.rs_etapas (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid not null references public.rs_vagas (id) on delete cascade,
  nome text not null constraint rs_etapas_nome_tamanho check (char_length(nome) between 2 and 40),
  tipo public.rs_tipo_etapa not null,
  ordem smallint not null,
  constraint rs_etapas_ordem_unica unique (vaga_id, ordem) deferrable initially deferred
);

create table public.rs_perguntas (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid not null references public.rs_vagas (id) on delete cascade,
  ordem smallint not null,
  texto text not null constraint rs_perguntas_texto_tamanho check (char_length(texto) between 3 and 300),
  tipo public.rs_tipo_pergunta not null,
  opcoes text[],
  obrigatoria boolean not null default true,
  resposta_esperada text,
  constraint rs_perguntas_ordem_unica unique (vaga_id, ordem) deferrable initially deferred,
  -- Opções só em escolha única, de 2 a 10 (7.3).
  constraint rs_perguntas_opcoes check (
    (tipo = 'escolha_unica' and opcoes is not null and cardinality(opcoes) between 2 and 10)
    or (tipo <> 'escolha_unica' and opcoes is null)
  ),
  -- Requisito declarado só em sim/não e escolha única (11.10).
  constraint rs_perguntas_resposta_esperada check (resposta_esperada is null or tipo in ('sim_nao', 'escolha_unica'))
);

-- Equipe da vaga: no máximo um responsável (7.3).
create table public.rs_vaga_equipe (
  vaga_id uuid not null references public.rs_vagas (id) on delete cascade,
  membro_id uuid not null references public.rs_membros (id) on delete cascade,
  papel_na_vaga public.rs_papel_na_vaga not null,
  criado_em timestamptz not null default now(),
  primary key (vaga_id, membro_id)
);
create unique index rs_vaga_equipe_um_responsavel on public.rs_vaga_equipe (vaga_id) where papel_na_vaga = 'responsavel';
create index rs_vaga_equipe_membro on public.rs_vaga_equipe (membro_id);

-- ---------------------------------------------------------------- candidatos e candidaturas
-- A pessoa candidata, dentro de uma empresa (11.27: sem ligação entre empresas).
create table public.rs_candidatos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  email extensions.citext,
  nome text not null constraint rs_candidatos_nome_tamanho check (char_length(nome) between 2 and 120),
  telefone text constraint rs_candidatos_telefone check (telefone ~ '^[0-9]{10,13}$'),
  linkedin_url text constraint rs_candidatos_linkedin check (linkedin_url ~ '^https://(www\.)?linkedin\.com/in/'),
  cidade text constraint rs_candidatos_cidade_tamanho check (char_length(cidade) <= 120),
  talentos_consentido_em timestamptz,
  talentos_expira_em timestamptz,
  anonimizado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint rs_candidatos_email_unico unique (empresa_id, email)
);
create index rs_candidatos_talentos on public.rs_candidatos (empresa_id, talentos_expira_em) where talentos_expira_em is not null;

create table public.rs_candidaturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  vaga_id uuid not null references public.rs_vagas (id) on delete cascade,
  candidato_id uuid not null references public.rs_candidatos (id) on delete cascade,
  etapa_id uuid references public.rs_etapas (id),
  situacao public.rs_situacao_candidatura not null default 'ativa',
  origem public.rs_origem_candidatura not null,
  token_hash text not null unique,
  consentimento_versao text not null,
  consentimento_em timestamptz not null,
  sinalizada boolean not null default false,
  texto_busca tsvector,
  movida_em timestamptz not null default now(),
  motivo_reprovacao public.rs_motivo_reprovacao,
  encerrada_em timestamptz,
  expurgar_em timestamptz,
  revisao_pedida_em timestamptz,
  revisao_respondida_em timestamptz,
  criado_em timestamptz not null default now(),
  constraint rs_candidaturas_uma_por_vaga unique (vaga_id, candidato_id),
  -- Motivo interno só em reprovada (11.5); ativa não tem data de encerramento nem de expurgo (11.12).
  constraint rs_candidaturas_motivo check (motivo_reprovacao is null or situacao = 'reprovada'),
  constraint rs_candidaturas_encerramento check ((situacao = 'ativa') = (encerrada_em is null)),
  constraint rs_candidaturas_expurgo check (situacao <> 'ativa' or expurgar_em is null)
);
create index rs_candidaturas_funil on public.rs_candidaturas (empresa_id, vaga_id, situacao, etapa_id);
create index rs_candidaturas_paradas on public.rs_candidaturas (empresa_id, movida_em) where situacao = 'ativa';
create index rs_candidaturas_expurgo on public.rs_candidaturas (expurgar_em) where expurgar_em is not null;
create index rs_candidaturas_candidato on public.rs_candidaturas (candidato_id);
create index rs_candidaturas_etapa on public.rs_candidaturas (etapa_id);
create index rs_candidaturas_busca on public.rs_candidaturas using gin (texto_busca);

create table public.rs_respostas (
  candidatura_id uuid not null references public.rs_candidaturas (id) on delete cascade,
  pergunta_id uuid not null references public.rs_perguntas (id) on delete cascade,
  valor text not null constraint rs_respostas_valor_tamanho check (char_length(valor) <= 3000),
  criado_em timestamptz not null default now(),
  primary key (candidatura_id, pergunta_id)
);
create index rs_respostas_pergunta on public.rs_respostas (pergunta_id);

create table public.rs_arquivos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  candidatura_id uuid references public.rs_candidaturas (id) on delete cascade,
  tipo public.rs_tipo_arquivo not null,
  path text not null,
  nome_original text not null,
  mime text not null,
  bytes integer not null constraint rs_arquivos_bytes check (bytes > 0),
  sha256 text,
  texto_extraido text constraint rs_arquivos_texto_tamanho check (char_length(texto_extraido) <= 100000),
  extracao_status public.rs_status_extracao not null default 'pendente',
  confirmado_em timestamptz,
  criado_em timestamptz not null default now(),
  -- Só o logo não pertence a uma candidatura (7.3).
  constraint rs_arquivos_dono check ((tipo = 'logo') = (candidatura_id is null))
);
create unique index rs_arquivos_um_curriculo on public.rs_arquivos (candidatura_id) where tipo = 'curriculo';
create index rs_arquivos_empresa on public.rs_arquivos (empresa_id);
create index rs_arquivos_nao_confirmados on public.rs_arquivos (criado_em) where confirmado_em is null;

-- Avaliação por etapa (11.9). Comentário vazio só depois da anonimização (7.4).
create table public.rs_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  candidatura_id uuid not null references public.rs_candidaturas (id) on delete cascade,
  etapa_id uuid not null references public.rs_etapas (id) on delete cascade,
  membro_id uuid not null references public.rs_membros (id),
  recomendacao public.rs_recomendacao not null,
  comentario text not null constraint rs_avaliacoes_comentario check (comentario = '' or char_length(comentario) between 10 and 5000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint rs_avaliacoes_uma_por_membro unique (candidatura_id, etapa_id, membro_id)
);
create index rs_avaliacoes_etapa on public.rs_avaliacoes (etapa_id);
create index rs_avaliacoes_membro on public.rs_avaliacoes (membro_id);

create table public.rs_notas (
  id uuid primary key default gen_random_uuid(),
  candidatura_id uuid not null references public.rs_candidaturas (id) on delete cascade,
  texto text not null constraint rs_notas_texto_tamanho check (char_length(texto) between 1 and 10000),
  ator_tipo public.rs_tipo_ator not null constraint rs_notas_ator check (ator_tipo in ('membro', 'api', 'agente')),
  membro_id uuid references public.rs_membros (id),
  credencial_id uuid references public.rs_credenciais (id),
  criado_em timestamptz not null default now()
);
create index rs_notas_candidatura on public.rs_notas (candidatura_id);
create index rs_notas_membro on public.rs_notas (membro_id);
create index rs_notas_credencial on public.rs_notas (credencial_id);

-- Propostas que esperam confirmação humana (11.7).
create table public.rs_decisoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  tipo public.rs_tipo_decisao not null,
  candidatura_id uuid references public.rs_candidaturas (id) on delete cascade,
  vaga_id uuid references public.rs_vagas (id) on delete cascade,
  payload jsonb not null,
  justificativa text constraint rs_decisoes_justificativa check (char_length(justificativa) <= 2000),
  status public.rs_status_decisao not null default 'pendente',
  proposta_por_tipo public.rs_tipo_ator not null constraint rs_decisoes_proponente check (proposta_por_tipo in ('api', 'agente')),
  proposta_por_membro_id uuid references public.rs_membros (id),
  credencial_id uuid not null references public.rs_credenciais (id),
  decidida_por_membro_id uuid references public.rs_membros (id),
  decidida_em timestamptz,
  expira_em timestamptz not null default now() + interval '7 days',
  criado_em timestamptz not null default now(),
  constraint rs_decisoes_alvo check (
    (tipo = 'encerrar_vaga' and vaga_id is not null and candidatura_id is null)
    or (tipo <> 'encerrar_vaga' and candidatura_id is not null)
  )
);
create unique index rs_decisoes_pendente_candidatura on public.rs_decisoes (tipo, candidatura_id) where status = 'pendente' and candidatura_id is not null;
create unique index rs_decisoes_pendente_vaga on public.rs_decisoes (tipo, vaga_id) where status = 'pendente' and vaga_id is not null;
create index rs_decisoes_empresa_status on public.rs_decisoes (empresa_id, status);
create index rs_decisoes_vaga on public.rs_decisoes (vaga_id);
create index rs_decisoes_proposta_por on public.rs_decisoes (proposta_por_membro_id);
create index rs_decisoes_credencial on public.rs_decisoes (credencial_id);
create index rs_decisoes_decidida_por on public.rs_decisoes (decidida_por_membro_id);

-- Personalização dos modelos de mensagem; sem linha = padrão do código (copy.ts).
create table public.rs_modelos_mensagem (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  chave text not null constraint rs_modelos_chave check (chave ~ '^[a-z0-9_]{2,60}$'),
  nome text not null constraint rs_modelos_nome check (char_length(nome) between 2 and 80),
  assunto text not null constraint rs_modelos_assunto check (char_length(assunto) between 2 and 200),
  corpo text not null constraint rs_modelos_corpo check (char_length(corpo) between 2 and 5000),
  atualizado_em timestamptz not null default now(),
  constraint rs_modelos_chave_unica unique (empresa_id, chave)
);

-- Fila de e-mail idempotente (como no Assina).
create table public.rs_notificacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  candidatura_id uuid references public.rs_candidaturas (id) on delete set null,
  tipo public.rs_tipo_notificacao not null,
  destinatario extensions.citext not null,
  chave_idempotencia text not null unique,
  assunto text not null,
  html text not null,
  texto text not null,
  reply_to extensions.citext,
  status public.rs_status_notificacao not null default 'pendente',
  tentativas smallint not null default 0,
  ultimo_erro text,
  enviar_apos timestamptz not null default now(),
  enviada_em timestamptz,
  resend_id text,
  criado_em timestamptz not null default now()
);
create index rs_notificacoes_fila on public.rs_notificacoes (status, enviar_apos) where status in ('pendente', 'falhou');
create index rs_notificacoes_empresa on public.rs_notificacoes (empresa_id, criado_em);
create index rs_notificacoes_candidatura on public.rs_notificacoes (candidatura_id);

-- Tudo que foi enviado a um candidato.
create table public.rs_mensagens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  candidatura_id uuid not null references public.rs_candidaturas (id) on delete cascade,
  tipo public.rs_tipo_mensagem not null,
  assunto text not null,
  corpo text not null,
  ator_tipo public.rs_tipo_ator not null,
  membro_id uuid references public.rs_membros (id),
  credencial_id uuid references public.rs_credenciais (id),
  decisao_id uuid references public.rs_decisoes (id),
  notificacao_id uuid not null references public.rs_notificacoes (id),
  criado_em timestamptz not null default now()
);
create index rs_mensagens_candidatura on public.rs_mensagens (candidatura_id);
create index rs_mensagens_empresa on public.rs_mensagens (empresa_id);
create index rs_mensagens_membro on public.rs_mensagens (membro_id);
create index rs_mensagens_credencial on public.rs_mensagens (credencial_id);
create index rs_mensagens_decisao on public.rs_mensagens (decisao_id);
create index rs_mensagens_notificacao on public.rs_mensagens (notificacao_id);

-- Trilha só de inserção (11.6). Catálogo fechado da seção 15.3; mudar o catálogo é migration nova.
create table public.rs_eventos (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  vaga_id uuid,
  candidatura_id uuid,
  tipo text not null constraint rs_eventos_tipo_catalogo check (tipo in (
    'empresa_criada', 'membro_convidado', 'convite_cancelado', 'membro_entrou', 'membro_acesso_alterado',
    'membro_removido', 'area_criada', 'area_editada', 'area_arquivada', 'pessoa_cadastrada', 'pessoa_editada',
    'pessoa_arquivada', 'acesso_pedido', 'vaga_dono_alterado', 'credencial_criada', 'credencial_revogada',
    'mcp_conectado', 'vaga_criada', 'vaga_editada', 'vaga_publicada', 'vaga_pausada', 'vaga_pausada_prazo',
    'vaga_encerrada', 'candidatura_criada', 'etapa_alterada', 'nota_adicionada', 'avaliacao_registrada',
    'mensagem_enviada', 'candidatura_reprovada', 'candidatura_contratada', 'candidatura_desistiu',
    'candidatura_encerrada_vaga', 'candidatura_reaberta', 'decisao_proposta', 'decisao_confirmada',
    'decisao_descartada', 'decisao_expirada', 'revisao_pedida', 'revisao_respondida', 'dados_exportados',
    'dados_excluidos', 'candidatura_anonimizada', 'talentos_consentido', 'talentos_retirado',
    'talentos_convidado', 'candidaturas_exportadas'
  )),
  ator_tipo public.rs_tipo_ator not null,
  membro_id uuid,
  credencial_id uuid,
  autorizado_por_membro_id uuid,
  origem public.rs_origem_evento not null,
  dados jsonb not null default '{}',
  criado_em timestamptz not null default now()
);
create index rs_eventos_candidatura on public.rs_eventos (empresa_id, candidatura_id, id);
create index rs_eventos_empresa on public.rs_eventos (empresa_id, id);

create table public.rs_webhooks (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  url text not null constraint rs_webhooks_https check (url ~ '^https://'),
  segredo_cifrado text not null,
  eventos text[] not null constraint rs_webhooks_eventos check (cardinality(eventos) > 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index rs_webhooks_empresa on public.rs_webhooks (empresa_id);

create table public.rs_entregas_webhook (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  webhook_id uuid not null references public.rs_webhooks (id) on delete cascade,
  evento_id bigint not null references public.rs_eventos (id) on delete cascade,
  tipo text not null,
  corpo jsonb not null,
  status public.rs_status_entrega not null default 'pendente',
  tentativas smallint not null default 0 constraint rs_entregas_tentativas check (tentativas between 0 and 8),
  ultimo_status_http smallint,
  proxima_tentativa_em timestamptz not null default now(),
  reservada_em timestamptz,
  criado_em timestamptz not null default now(),
  entregue_em timestamptz,
  constraint rs_entregas_unica unique (webhook_id, evento_id)
);
create index rs_entregas_fila on public.rs_entregas_webhook (status, proxima_tentativa_em) where status in ('pendente', 'falhou');
create index rs_entregas_empresa on public.rs_entregas_webhook (empresa_id);
create index rs_entregas_evento on public.rs_entregas_webhook (evento_id);

-- ---------------------------------------------------------------- autorização (6.5)
-- RLS ligada sem política e nenhum privilégio para anon/authenticated em toda rs_*.
do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'rs\_%' loop
    execute format('alter table public.%I enable row level security', t.relname);
    execute format('revoke all on table public.%I from anon, authenticated', t.relname);
  end loop;
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'S' and c.relname like 'rs\_%' loop
    execute format('revoke all on sequence public.%I from anon, authenticated', t.relname);
  end loop;
end $$;
