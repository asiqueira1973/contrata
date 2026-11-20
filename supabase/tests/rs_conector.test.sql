-- Épico 8.2: OAuth do MCP (6.4), chaves de API (6.3, 11.15) e origem do evento vinda do ator
-- (formulário, 11.34). Códigos e tokens aqui são valores de teste; o banco só vê hashes.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table fx (k text primary key, id uuid);
create function pg_temp.id(p text) returns uuid language sql as $$ select id from fx where k = p $$;
insert into fx values ('ana', (public.rs_fn_entra_usuario('sub-con-ana', 'ana-con@teste.dev', 'Ana', null) ->> 'usuario_id')::uuid);
insert into fx select 'e', public.rs_fn_cria_empresa(pg_temp.id('ana'), 'con-padaria', 'Padaria', 'ana-con@teste.dev');
insert into fx select 'm', id from public.rs_membros where empresa_id = pg_temp.id('e') and usuario_id = pg_temp.id('ana');
with x as (insert into public.rs_oauth_clientes (nome, redirect_uris) values ('Claude', '{https://claude.ai/cb}') returning id)
insert into fx select 'cli', id from x;

create function pg_temp.codigo(p_hash text, p_validade int default 600) returns void language sql as $$
  select public.rs_fn_cria_codigo_oauth(p_hash, pg_temp.id('cli'), pg_temp.id('e'), pg_temp.id('m'),
    '{leitura,escrita}', 'https://claude.ai/cb', repeat('a', 43), p_validade)
$$;
create function pg_temp.troca(p_hash text, p_token text, p_challenge text default repeat('a', 43), p_uri text default 'https://claude.ai/cb')
returns uuid language sql as $$
  select public.rs_fn_troca_codigo_oauth(p_hash, pg_temp.id('cli'), p_uri, p_challenge, p_token, 'rsm_test')
$$;

-- Criação do código
select throws_ok(format($q$select public.rs_fn_cria_codigo_oauth('c0', %L, %L, %L, '{leitura}', 'https://outro.site/cb', %L, 600)$q$,
                 pg_temp.id('cli'), pg_temp.id('e'), pg_temp.id('m'), repeat('a', 43)), 'P0001', 'invalid_request', 'redirect não registrado');
select throws_ok(format($q$select public.rs_fn_cria_codigo_oauth('c0', %L, %L, %L, '{leitura}', 'https://claude.ai/cb', 'curto', 600)$q$,
                 pg_temp.id('cli'), pg_temp.id('e'), pg_temp.id('m')), 'P0001', 'invalid_request', 'challenge fora do formato');
select throws_ok(format($q$select public.rs_fn_cria_codigo_oauth('c0', gen_random_uuid(), %L, %L, '{leitura}', 'https://claude.ai/cb', %L, 600)$q$,
                 pg_temp.id('e'), pg_temp.id('m'), repeat('a', 43)), 'P0001', 'invalid_client', 'cliente inexistente');

-- Troca válida cria a credencial mcp com membro e escopos, e o evento mcp_conectado
select pg_temp.codigo('c1');
insert into fx select 'cred', pg_temp.troca('c1', 'tok-1');
select ok(pg_temp.id('cred') is not null, 'troca válida devolve a credencial');
select is((select tipo::text || ':' || membro_id::text || ':' || escopos::text from public.rs_credenciais where id = pg_temp.id('cred')),
          'mcp:' || pg_temp.id('m')::text || ':{leitura,escrita}', 'credencial mcp do membro com os escopos escolhidos');
select is((select count(*)::int from public.rs_eventos where empresa_id = pg_temp.id('e') and tipo = 'mcp_conectado'), 1, 'evento mcp_conectado');
select is((select origem::text from public.rs_eventos where empresa_id = pg_temp.id('e') and tipo = 'mcp_conectado'), 'web', 'origem web');

-- Reuso do código revoga o token criado com ele
select is(pg_temp.troca('c1', 'tok-2'), null, 'código reutilizado não gera outro token');
select ok((select revogada_em is not null from public.rs_credenciais where id = pg_temp.id('cred')), 'reuso revoga o token anterior');

-- Challenge, redirect errados e código vencido
select pg_temp.codigo('c2');
select is(pg_temp.troca('c2', 'tok-3', repeat('b', 43)), null, 'verifier errado');
select is(pg_temp.troca('c2', 'tok-3', repeat('a', 43), 'https://claude.ai/outro'), null, 'redirect diferente');
select pg_temp.codigo('c3', 1);
update public.rs_oauth_codigos set expira_em = now() - interval '1 second' where codigo_hash = 'c3';
select is(pg_temp.troca('c3', 'tok-4'), null, 'código vencido');

-- Membro removido entre o consentimento e a troca
insert into fx values ('bia', (public.rs_fn_entra_usuario('sub-con-bia', 'bia-con@teste.dev', 'Bia', null) ->> 'usuario_id')::uuid);
insert into fx select 'm2', public.rs_fn_convida_membro(pg_temp.id('e'), 'bia-con@teste.dev', 'recrutador', true, '{}', 'h-bia', now() + interval '1 day', 50,
  jsonb_build_object('tipo', 'membro', 'membro_id', pg_temp.id('m')));
select public.rs_fn_aceita_convite(pg_temp.id('m2'), pg_temp.id('bia'));
select public.rs_fn_cria_codigo_oauth('c4', pg_temp.id('cli'), pg_temp.id('e'), pg_temp.id('m2'), '{leitura}', 'https://claude.ai/cb', repeat('a', 43), 600);
select public.rs_fn_remove_membro(pg_temp.id('m2'), jsonb_build_object('tipo', 'membro', 'membro_id', pg_temp.id('m')));
select is(pg_temp.troca('c4', 'tok-5'), null, 'membro removido não recebe token');

-- Chaves de API
select lives_ok(format($q$select public.rs_fn_cria_chave_api(%L, 'n8n', 'rsk_aaaa', 'h-k1', '{leitura}', 1, %L)$q$,
                pg_temp.id('e'), jsonb_build_object('tipo', 'membro', 'membro_id', pg_temp.id('m'), 'origem', 'formulario')), 'cria chave');
select throws_ok(format($q$select public.rs_fn_cria_chave_api(%L, 'outra', 'rsk_bbbb', 'h-k2', '{leitura}', 1, %L)$q$,
                 pg_temp.id('e'), jsonb_build_object('tipo', 'membro', 'membro_id', pg_temp.id('m'))), 'P0001', 'limite_chaves', 'limite de chaves ativas (11.15)');
select is((select origem::text from public.rs_eventos where empresa_id = pg_temp.id('e') and tipo = 'credencial_criada'), 'formulario',
          'a origem do ator (formulário) vence a da função');
select lives_ok(format($q$select public.rs_fn_revoga_credencial((select id from public.rs_credenciais where valor_hash = 'h-k1'), %L, %L)$q$,
                pg_temp.id('e'), jsonb_build_object('tipo', 'membro', 'membro_id', pg_temp.id('m'))), 'revoga a chave');
select throws_ok(format($q$select public.rs_fn_revoga_credencial((select id from public.rs_credenciais where valor_hash = 'h-k1'), %L, %L)$q$,
                 pg_temp.id('e'), jsonb_build_object('tipo', 'membro', 'membro_id', pg_temp.id('m'))), 'P0001', 'credencial_invalida', 'não revoga duas vezes');

-- Funções do 8.1 gravam 'web', não 'painel'
select is((select origem::text from public.rs_eventos where empresa_id = pg_temp.id('e') and tipo = 'empresa_criada'), 'web', 'eventos do 8.1 com origem web');

select * from finish();
rollback;
