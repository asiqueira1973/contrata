-- Máquina 12.2 (rs_tg_situacao_candidatura), etapa e empresa coerentes (rs_tg_etapa_da_vaga) e
-- congelamento da vaga e das perguntas (rs_tg_vaga_congelada, 11.1 e 7.4).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table fx (k text primary key, id uuid);
insert into fx values ('ana', (public.rs_fn_entra_usuario('sub-sit-ana', 'ana-sit@teste.dev', 'Ana', null) ->> 'usuario_id')::uuid);
insert into fx select 'e1', public.rs_fn_cria_empresa((select id from fx where k = 'ana'), 'sit-um', 'Um', 'ana-sit@teste.dev');
insert into fx select 'e2', public.rs_fn_cria_empresa((select id from fx where k = 'ana'), 'sit-dois', 'Dois', 'ana-sit@teste.dev');
with x as (insert into public.rs_vagas (empresa_id, slug, titulo, modelo_trabalho)
  values ((select id from fx where k = 'e1'), 'vaga-um', 'Vaga um', 'remoto') returning id) insert into fx select 'v1', id from x;
with x as (insert into public.rs_vagas (empresa_id, slug, titulo, modelo_trabalho)
  values ((select id from fx where k = 'e1'), 'vaga-dois', 'Vaga dois', 'remoto') returning id) insert into fx select 'v2', id from x;
with x as (insert into public.rs_etapas (vaga_id, nome, tipo, ordem)
  values ((select id from fx where k = 'v1'), 'Triagem', 'triagem', 1) returning id) insert into fx select 'et1', id from x;
with x as (insert into public.rs_etapas (vaga_id, nome, tipo, ordem)
  values ((select id from fx where k = 'v2'), 'Triagem', 'triagem', 1) returning id) insert into fx select 'et2', id from x;
with x as (insert into public.rs_candidatos (empresa_id, email, nome)
  values ((select id from fx where k = 'e1'), 'pessoa-sit@teste.dev', 'Pessoa') returning id) insert into fx select 'cand', id from x;
with x as (insert into public.rs_candidatos (empresa_id, email, nome)
  values ((select id from fx where k = 'e2'), 'pessoa-sit@teste.dev', 'Pessoa') returning id) insert into fx select 'cand2', id from x;

create function pg_temp.nova(p_situacao text, p_etapa text, p_candidato text, p_token text) returns text language sql as $$
  select format($q$insert into public.rs_candidaturas (empresa_id, vaga_id, candidato_id, etapa_id, situacao, origem,
    token_hash, consentimento_versao, consentimento_em) values (%L, %L, %L, %L, %L, 'pagina', %L, '2026-11-20', now())$q$,
    (select id from fx where k = 'e1'), (select id from fx where k = 'v1'), (select id from fx where k = p_candidato),
    (select id from fx where k = p_etapa), p_situacao, p_token)
$$;

select throws_ok(pg_temp.nova('reprovada', 'et1', 'cand', 'tok-a'), 'P0001', 'candidatura_nasce_ativa', 'candidatura nasce ativa');
select throws_ok(pg_temp.nova('ativa', 'et2', 'cand', 'tok-b'), 'P0001', 'etapa_de_outra_vaga', 'etapa de outra vaga recusada');
select throws_ok(pg_temp.nova('ativa', 'et1', 'cand2', 'tok-c'), 'P0001', 'candidato_de_outra_empresa', 'candidato de outra empresa recusado (11.27)');
select lives_ok(pg_temp.nova('ativa', 'et1', 'cand', 'tok-d'), 'candidatura válida');
insert into fx select 'c', id from public.rs_candidaturas where token_hash = 'tok-d';

create function pg_temp.muda(p_para text) returns text language sql as $$
  select format('update public.rs_candidaturas set situacao = %L, encerrada_em = %s where id = %L',
    p_para, case when p_para = 'ativa' then 'null' else 'now()' end, (select id from fx where k = 'c'))
$$;

select throws_ok(pg_temp.muda('reprovada'), 'P0001', 'situacao_so_por_funcao', 'update direto de situacao recusado');
select set_config('rs.transicao', 'on', true);
select lives_ok(pg_temp.muda('reprovada'), 'ativa → reprovada');
select throws_ok(pg_temp.muda('contratada'), 'P0001', 'transicao_proibida', 'reprovada → contratada proibida');
select throws_ok(pg_temp.muda('desistiu'), 'P0001', 'transicao_proibida', 'reprovada → desistiu proibida');
select throws_ok(pg_temp.muda('encerrada_vaga'), 'P0001', 'transicao_proibida', 'reprovada → encerrada_vaga proibida');
select lives_ok(pg_temp.muda('ativa'), 'reprovada → ativa (reabrir)');
select lives_ok(pg_temp.muda('desistiu'), 'ativa → desistiu');
select throws_ok(pg_temp.muda('reprovada'), 'P0001', 'transicao_proibida', 'desistiu → reprovada proibida');
select lives_ok(pg_temp.muda('ativa'), 'desistiu → ativa');
select lives_ok(pg_temp.muda('contratada'), 'ativa → contratada');
select throws_ok(pg_temp.muda('encerrada_vaga'), 'P0001', 'transicao_proibida', 'contratada → encerrada_vaga proibida');
select lives_ok(pg_temp.muda('ativa'), 'contratada → ativa');
select lives_ok(pg_temp.muda('encerrada_vaga'), 'ativa → encerrada_vaga');
select throws_ok(pg_temp.muda('ativa'), 'P0001', 'transicao_proibida', 'encerrada_vaga → ativa proibida');
select set_config('rs.transicao', 'off', true);

-- Perguntas congeladas depois da primeira publicação; vaga encerrada não muda; só rascunho se apaga.
select lives_ok(format($q$insert into public.rs_perguntas (vaga_id, ordem, texto, tipo) values (%L, 1, 'Tem CNH?', 'sim_nao')$q$,
                (select id from fx where k = 'v2')), 'pergunta em rascunho');
update public.rs_vagas set status = 'publicada', publicada_em = now() where id = (select id from fx where k = 'v2');
select throws_ok(format($q$update public.rs_perguntas set texto = 'Outra coisa' where vaga_id = %L$q$, (select id from fx where k = 'v2')),
                 'P0001', 'perguntas_congeladas', 'pergunta não muda depois de publicada');
select throws_ok(format($q$insert into public.rs_perguntas (vaga_id, ordem, texto, tipo) values (%L, 2, 'Nova?', 'sim_nao')$q$,
                 (select id from fx where k = 'v2')), 'P0001', 'perguntas_congeladas', 'pergunta nova recusada depois de publicada');
select throws_ok(format('delete from public.rs_vagas where id = %L', (select id from fx where k = 'v2')),
                 'P0001', 'vaga_so_apaga_rascunho', 'vaga publicada não se apaga');
update public.rs_vagas set status = 'encerrada', encerrada_em = now(), motivo_encerramento = 'cancelada'
 where id = (select id from fx where k = 'v2');
select throws_ok(format($q$update public.rs_vagas set titulo = 'Outro título' where id = %L$q$, (select id from fx where k = 'v2')),
                 'P0001', 'vaga_encerrada', 'vaga encerrada não muda');

select * from finish();
rollback;
