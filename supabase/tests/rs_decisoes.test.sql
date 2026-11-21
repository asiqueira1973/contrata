-- Decisões (épico 8.6): devolutiva de 20+ em todo caminho (11.5), proposta nunca executa e só uma
-- pendente por alvo (11.7), confirmar executa com quem propôs e quem confirmou, alvo mudado vira
-- expirada (12.3), encerrar vaga com ativas, reabrir (11.23), revisão uma vez (11.13), cota de
-- mensagens da API (11.8), link girado (11.4) e faxina das vencidas.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table fx (k text primary key, id uuid);
create function pg_temp.id(p text) returns uuid language sql as $$ select id from fx where k = p $$;
create function pg_temp.ator(p text) returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'membro', 'membro_id', pg_temp.id(p), 'origem', 'formulario') $$;
create function pg_temp.todas() returns jsonb language sql as $$ select '{"tipo":"todas"}'::jsonb $$;
create function pg_temp.publico() returns jsonb language sql as $$ select '{"tipo":"candidato","origem":"publico"}'::jsonb $$;
create function pg_temp.msg(p_corpo text, p_chave text) returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'devolutiva', 'assunto', 'Sobre sua candidatura', 'corpo', p_corpo,
    'notificacao', jsonb_build_object('tipo', 'mensagem_candidato', 'destinatario', 'x@teste.dev', 'chave', p_chave, 'assunto', 'a', 'html', 'h', 'texto', 't')) $$;
create function pg_temp.msgs(p_cand text, p_corpo text) returns jsonb language sql as $$
  select jsonb_build_object(pg_temp.id(p_cand)::text, pg_temp.msg(p_corpo, 'm:' || p_cand || ':' || gen_random_uuid())) $$;
create function pg_temp.cand(p_k text, p_vaga text) returns uuid language plpgsql as $$
declare c uuid;
begin
  c := (public.rs_fn_cria_candidatura(pg_temp.id('e'), pg_temp.id(p_vaga), jsonb_build_object('nome', 'Pessoa ' || p_k, 'email', p_k || '@de.teste.dev'),
    '[]', 'pagina', pg_temp.publico(), '2026-11-20', false, 'tok-' || p_k, 10000) ->> 'id')::uuid;
  perform public.rs_fn_conclui_candidatura(c, pg_temp.id('e'), null, '{"assunto":"a","corpo":"b"}',
    jsonb_build_object('tipo', 'candidatura_recebida', 'destinatario', 'x@teste.dev', 'chave', 'rec:' || p_k, 'assunto', 'a', 'html', 'h', 'texto', 't'),
    pg_temp.publico(), 'fin-' || p_k);
  insert into fx values (p_k, c);
  return c;
end $$;
create function pg_temp.vaga(p_k text) returns uuid language plpgsql as $$
declare v uuid;
begin
  v := (public.rs_fn_cria_vaga(pg_temp.id('e'), jsonb_build_object('titulo', 'Vaga ' || p_k, 'modelo_trabalho', 'remoto', 'curriculo_obrigatorio', false,
    'descricao', repeat('Descrição longa da vaga. ', 4), 'etapas', '[{"nome":"Triagem","tipo":"triagem"},{"nome":"Entrevista","tipo":"entrevista"}]'::jsonb),
    pg_temp.todas(), pg_temp.ator('m')) ->> 'id')::uuid;
  perform public.rs_fn_transicao_vaga(v, pg_temp.id('e'), 'publicada', null, pg_temp.todas(), pg_temp.ator('m'), 50);
  insert into fx values (p_k, v);
  return v;
end $$;

insert into fx values ('ana', (public.rs_fn_entra_usuario('sub-de-ana', 'ana-de@teste.dev', 'Ana', null) ->> 'usuario_id')::uuid);
insert into fx select 'e', public.rs_fn_cria_empresa(pg_temp.id('ana'), 'de-padaria', 'Padaria', 'ana-de@teste.dev');
insert into fx select 'm', id from public.rs_membros where empresa_id = pg_temp.id('e');
with c as (insert into public.rs_credenciais (empresa_id, tipo, nome, prefixo, valor_hash, escopos, criada_por_membro_id)
  values (pg_temp.id('e'), 'api', 'n8n', 'rsk_test', 'hash-de-' || gen_random_uuid(), array['leitura','escrita','decisao']::public.rs_escopo[], pg_temp.id('m'))
  returning id)
insert into fx select 'cred', id from c;
create function pg_temp.api() returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'api', 'credencial_id', pg_temp.id('cred'), 'origem', 'api') $$;
select pg_temp.vaga('v');
select pg_temp.cand('a', 'v');
select pg_temp.cand('b', 'v');
select pg_temp.cand('c', 'v');

-- 11.5: devolutiva de 20 a 3.000 em todo caminho
select throws_ok(format('select public.rs_fn_decide(%L, %L, %L, null, %L, %L, %L, %L)', pg_temp.id('e'), 'reprovar', pg_temp.id('a'),
  '{"motivo":"requisitos"}', pg_temp.msgs('a', 'Curta demais'), pg_temp.todas(), pg_temp.ator('m')), 'P0001', 'devolutiva_obrigatoria', 'decidir com devolutiva curta é recusado');
select throws_ok(format('select public.rs_fn_encerra_candidatura(%L, %L, %L, %L, %L, %L)', pg_temp.id('a'), pg_temp.id('e'), 'reprovada', pg_temp.ator('m'), 'requisitos',
  pg_temp.msg('Curta demais', 'x1')), 'P0001', 'devolutiva_obrigatoria', 'a função de encerrar também confere');
select throws_ok(format('select public.rs_fn_decide(%L, %L, %L, null, %L, %L, %L, %L)', pg_temp.id('e'), 'reprovar', pg_temp.id('a'),
  '{"motivo":"requisitos"}', pg_temp.msgs('a', 'Obrigado pelo interesse; seguimos com outras pessoas.'), pg_temp.todas(), pg_temp.api()),
  'P0001', 'decisao_so_por_pessoa', 'decidir na hora só com um membro como ator');

-- Proposta (11.7): nunca executa; uma pendente por alvo
insert into fx select 'd1', public.rs_fn_propoe_decisao(pg_temp.id('e'), 'reprovar', pg_temp.id('a'), null, '{"motivo":"requisitos"}', 'Sem experiência', pg_temp.api(), pg_temp.todas());
select is((select situacao::text from public.rs_candidaturas where id = pg_temp.id('a')), 'ativa', 'proposta não executa');
select throws_ok(format('select public.rs_fn_propoe_decisao(%L, %L, %L, null, %L, null, %L, %L)', pg_temp.id('e'), 'reprovar', pg_temp.id('a'),
  '{}', pg_temp.api(), pg_temp.todas()), 'P0001', 'proposta_existente', 'uma pendente por alvo');
select throws_ok(format('select public.rs_fn_confirma_decisao(%L, %L, %L, null, %L, %L)', pg_temp.id('d1'), pg_temp.id('e'), pg_temp.todas(),
  pg_temp.msgs('a', 'Obrigado pelo interesse; seguimos com outras pessoas.'), pg_temp.api()), 'P0001', 'decisao_so_por_pessoa', 'credencial não confirma');
select is(public.rs_fn_confirma_decisao(pg_temp.id('d1'), pg_temp.id('e'), pg_temp.todas(), null,
  pg_temp.msgs('a', 'Obrigado pelo interesse; seguimos com outras pessoas.'), pg_temp.ator('m')) ->> 'status', 'confirmada', 'membro confirma');
select is((select situacao::text || '/' || motivo_reprovacao::text from public.rs_candidaturas where id = pg_temp.id('a')), 'reprovada/requisitos', 'confirmar executa');
select is((select corpo from public.rs_mensagens where candidatura_id = pg_temp.id('a') and tipo = 'devolutiva'),
  'Obrigado pelo interesse; seguimos com outras pessoas.', 'a devolutiva vai na mesma transação');
select is((select (dados ->> 'proposta_por_credencial_id')::uuid = pg_temp.id('cred') and autorizado_por_membro_id = pg_temp.id('m')
  from public.rs_eventos where tipo = 'decisao_confirmada' and candidatura_id = pg_temp.id('a')), true, 'o evento guarda quem propôs e quem confirmou');

-- Alvo mudado: expirada, não executa
insert into fx select 'd2', public.rs_fn_propoe_decisao(pg_temp.id('e'), 'contratar', pg_temp.id('b'), null, '{}', null, pg_temp.api(), pg_temp.todas());
select public.rs_fn_encerra_candidatura(pg_temp.id('b'), pg_temp.id('e'), 'desistiu', pg_temp.publico(), null, null);
select is(public.rs_fn_confirma_decisao(pg_temp.id('d2'), pg_temp.id('e'), pg_temp.todas(), null, '{}', pg_temp.ator('m')),
  '{"status":"expirada","motivo":"candidatura_encerrada"}'::jsonb, 'alvo mudado vira expirada');
select is((select status::text from public.rs_decisoes where id = pg_temp.id('d2')), 'expirada', 'e fica expirada');

-- Reabrir (11.23)
select lives_ok(format('select public.rs_fn_reabre_candidatura(%L, %L, %L, %L)', pg_temp.id('a'), pg_temp.id('e'), pg_temp.todas(), pg_temp.ator('m')), 'reabre a reprovada');
select is((select situacao::text || '/' || (encerrada_em is null)::text || '/' || (motivo_reprovacao is null)::text from public.rs_candidaturas where id = pg_temp.id('a')),
  'ativa/true/true', 'volta ativa e limpa encerramento e motivo');
select throws_ok(format('select public.rs_fn_reabre_candidatura(%L, %L, %L, %L)', pg_temp.id('a'), pg_temp.id('e'), pg_temp.todas(), pg_temp.ator('m')),
  'P0001', 'transicao_proibida', 'não reabre ativa');

-- Revisão (11.13)
select throws_ok(format('select public.rs_fn_pede_revisao(%L, null)', pg_temp.id('a')), 'P0001', 'revisao_indisponivel', 'ativa não pede revisão');
select public.rs_fn_decide(pg_temp.id('e'), 'reprovar', pg_temp.id('c'), null, '{"motivo":"perfil"}',
  pg_temp.msgs('c', 'Obrigado pelo interesse; seguimos com outras pessoas.'), pg_temp.todas(), pg_temp.ator('m'));
select is(public.rs_fn_pede_revisao(pg_temp.id('c'), 'Tenho a certificação pedida.'), pg_temp.id('v'), 'reprovada pede revisão');
select throws_ok(format('select public.rs_fn_pede_revisao(%L, null)', pg_temp.id('c')), 'P0001', 'revisao_indisponivel', 'uma vez só');
select lives_ok(format('select public.rs_fn_responde_revisao(%L, %L, %L, %L, true, %L)', pg_temp.id('c'), pg_temp.id('e'), pg_temp.todas(),
  pg_temp.msg('Revimos e vamos seguir com você.', 'rr:c'), pg_temp.ator('m')), 'responde e reabre');
select is((select situacao::text || '/' || (revisao_respondida_em is not null)::text from public.rs_candidaturas where id = pg_temp.id('c')), 'ativa/true', 'reaberta e respondida');
select is((select count(*)::int from public.rs_mensagens where candidatura_id = pg_temp.id('c') and tipo = 'resposta_revisao'), 1, 'mensagem resposta_revisao');

-- Encerrar vaga com ativas (decisão): todas recebem a devolutiva, depois a vaga encerra
select throws_ok(format('select public.rs_fn_decide(%L, %L, null, %L, %L, %L, %L, %L)', pg_temp.id('e'), 'encerrar_vaga', pg_temp.id('v'),
  '{"motivo_encerramento":"preenchida"}', pg_temp.msgs('a', 'A vaga foi preenchida; obrigado por participar.'), pg_temp.todas(), pg_temp.ator('m')),
  'P0001', 'devolutiva_obrigatoria', 'sem devolutiva para cada ativa, nada muda');
select is((select status::text from public.rs_vagas where id = pg_temp.id('v')), 'publicada', 'vaga continua publicada');
select is(public.rs_fn_decide(pg_temp.id('e'), 'encerrar_vaga', null, pg_temp.id('v'), '{"motivo_encerramento":"preenchida"}',
  pg_temp.msgs('a', 'A vaga foi preenchida; obrigado por participar.') || pg_temp.msgs('c', 'A vaga foi preenchida; obrigado por participar.'),
  pg_temp.todas(), pg_temp.ator('m')), 2, 'encerra as duas ativas');
select is((select status::text from public.rs_vagas where id = pg_temp.id('v')), 'encerrada', 'e a vaga');

-- Mensagens pela API: cota diária
select pg_temp.vaga('v2');
select pg_temp.cand('d', 'v2');
select isnt(public.rs_fn_envia_mensagem(pg_temp.id('d'), pg_temp.id('e'), 'contato', pg_temp.msg('Podemos conversar amanhã?', 'k1'), pg_temp.api(), null, 1), null, 'dentro da cota');
select throws_ok(format('select public.rs_fn_envia_mensagem(%L, %L, %L, %L, %L, null, 1)', pg_temp.id('d'), pg_temp.id('e'), 'contato',
  pg_temp.msg('Mais uma mensagem aqui.', 'k2'), pg_temp.api()), 'P0001', 'limite_mensagens', 'passou da cota');

-- Link girado (11.4)
select is(public.rs_fn_troca_link(pg_temp.id('d'), pg_temp.id('e'), 0, 'h-v1'), true, 'gira da versão 0 para 1');
select is(public.rs_fn_troca_link(pg_temp.id('d'), pg_temp.id('e'), 0, 'h-v1b'), false, 'versão velha não gira');
select is((select link_versao || '/' || token_hash from public.rs_candidaturas where id = pg_temp.id('d')), '1/h-v1', 'versão e hash novos');

-- Faxina das vencidas
insert into fx select 'd3', public.rs_fn_propoe_decisao(pg_temp.id('e'), 'contratar', pg_temp.id('d'), null, '{}', null, pg_temp.api(), pg_temp.todas());
update public.rs_decisoes set expira_em = now() - interval '1 minute' where id = pg_temp.id('d3');
select is(public.rs_fn_faxina_decisoes(200) >= 1, true, 'faxina expira as vencidas');
select is((select status::text from public.rs_decisoes where id = pg_temp.id('d3')), 'expirada', 'proposta vencida');

-- Defesa em profundidade (achado do verifier do 8.6): só membro reabre e executa, mesmo chamando direto.
select throws_ok(format('select public.rs_fn_reabre_candidatura(%L, %L, %L, %L)', pg_temp.id('a'), pg_temp.id('e'), pg_temp.todas(), pg_temp.api()),
  'P0001', 'decisao_so_por_pessoa', 'reabrir com ator que não é membro é recusado');
select throws_ok(format('select public.rs_fn_executa_decisao(%L, %L, %L, null, %L, %L, %L, null)', pg_temp.id('e'), 'contratar', pg_temp.id('d'),
  '{}', '{}', pg_temp.api()), 'P0001', 'decisao_so_por_pessoa', 'executar com ator que não é membro é recusado');
-- Confirmar fora do alcance (11.32): a proposta não existe para quem não enxerga a vaga.
insert into fx select 'd5', public.rs_fn_propoe_decisao(pg_temp.id('e'), 'contratar', pg_temp.id('d'), null, '{}', null, pg_temp.api(), pg_temp.todas());
select throws_ok(format('select public.rs_fn_confirma_decisao(%L, %L, %L, null, %L, %L)', pg_temp.id('d5'), pg_temp.id('e'),
  '{"tipo":"areas","area_ids":[]}', '{}', pg_temp.ator('m')), 'P0001', 'nao_encontrado', 'fora do alcance a proposta não é confirmada');
select is((select status::text from public.rs_decisoes where id = pg_temp.id('d5')), 'pendente', 'e continua pendente');
-- Encerrar vaga com mais de 1.000 em andamento é recusado (11.7).
select pg_temp.vaga('vg');
insert into public.rs_candidatos (empresa_id, email, nome)
  select pg_temp.id('e'), 'massa' || g || '@de.teste.dev', 'Massa ' || g from generate_series(1, 1001) g;
insert into public.rs_candidaturas (empresa_id, vaga_id, candidato_id, etapa_id, origem, token_hash, consentimento_versao, consentimento_em, recebida_em)
  select pg_temp.id('e'), pg_temp.id('vg'), k.id, (select id from public.rs_etapas where vaga_id = pg_temp.id('vg') order by ordem limit 1),
         'pagina', 'massa-' || k.id, '2026-11-20', now(), now()
    from public.rs_candidatos k where k.email like 'massa%@de.teste.dev';
select throws_ok(format('select public.rs_fn_decide(%L, %L, null, %L, %L, %L, %L, %L)', pg_temp.id('e'), 'encerrar_vaga', pg_temp.id('vg'),
  '{"motivo_encerramento":"cancelada"}', '{}', pg_temp.todas(), pg_temp.ator('m')), 'P0001', 'lote_grande_demais', 'mais de 1.000 em andamento: encerra-se em partes');

select * from finish();
rollback;
