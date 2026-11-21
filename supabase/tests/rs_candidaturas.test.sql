-- Candidaturas (épico 8.4): criar (11.2, 11.3, 11.10), vaga fechada, limite por vaga, concluir uma
-- vez só, desistiu com expurgar_em (11.12), devolutiva obrigatória (11.5), código de exclusão
-- (11.13), exclusão e anonimização (7.4), janela deslizante (11.14) e faxina (9.4).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table fx (k text primary key, id uuid);
create function pg_temp.id(p text) returns uuid language sql as $$ select id from fx where k = p $$;
create function pg_temp.ator(p text) returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'membro', 'membro_id', pg_temp.id(p)) $$;
create function pg_temp.cand(p_email text, p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('nome', 'Pessoa Teste', 'email', p_email) || p_extra $$;
create function pg_temp.publico() returns jsonb language sql as $$ select '{"tipo":"candidato","origem":"publico"}'::jsonb $$;
create function pg_temp.cria(p_email text, p_token text, p_respostas jsonb default '[]', p_vaga text default 'v') returns jsonb language sql as $$
  select public.rs_fn_cria_candidatura(pg_temp.id('e'), pg_temp.id(p_vaga), pg_temp.cand(p_email), p_respostas, 'pagina',
    pg_temp.publico(), '2026-11-20', false, p_token, 10000) $$;
create function pg_temp.notif(p_chave text) returns jsonb language sql as $$
  select jsonb_build_object('tipo', 'candidatura_recebida', 'destinatario', 'x@teste.dev', 'chave', p_chave,
    'assunto', 'Recebemos', 'html', '<p>link</p>', 'texto', 'link') $$;
create function pg_temp.conclui(p_cand uuid, p_chave text, p_arquivo jsonb default null) returns jsonb language sql as $$
  select public.rs_fn_conclui_candidatura(p_cand, pg_temp.id('e'), p_arquivo,
    '{"assunto":"Recebemos","corpo":"Acompanhe: {{link_acompanhamento}}"}', pg_temp.notif(p_chave), pg_temp.publico(), 'final-' || p_chave) $$;

insert into fx values ('ana', (public.rs_fn_entra_usuario('sub-ca-ana', 'ana-ca@teste.dev', 'Ana', null) ->> 'usuario_id')::uuid);
insert into fx select 'e', public.rs_fn_cria_empresa(pg_temp.id('ana'), 'ca-padaria', 'Padaria', 'ana-ca@teste.dev');
insert into fx select 'm', id from public.rs_membros where empresa_id = pg_temp.id('e');
insert into fx select 'v', (public.rs_fn_cria_vaga(pg_temp.id('e'), jsonb_build_object('titulo', 'Atendente', 'modelo_trabalho', 'remoto',
  'curriculo_obrigatorio', false, 'descricao', repeat('Descrição longa da vaga. ', 4),
  'etapas', '[{"nome":"Triagem","tipo":"triagem"},{"nome":"Entrevista","tipo":"entrevista"}]'::jsonb,
  'perguntas', '[{"texto":"Trabalha aos sábados?","tipo":"sim_nao","resposta_esperada":"sim"},{"texto":"Conte algo","tipo":"texto_curto","obrigatoria":false}]'::jsonb),
  '{"tipo":"todas"}', pg_temp.ator('m')) ->> 'id')::uuid;
select public.rs_fn_transicao_vaga(pg_temp.id('v'), pg_temp.id('e'), 'publicada', null, '{"tipo":"todas"}', pg_temp.ator('m'), 50);
insert into fx select 'p1', id from public.rs_perguntas where vaga_id = pg_temp.id('v') and ordem = 1;
insert into fx select 'vr', (public.rs_fn_cria_vaga(pg_temp.id('e'), jsonb_build_object('titulo', 'Rascunho', 'modelo_trabalho', 'remoto',
  'etapas', '[{"nome":"Triagem","tipo":"triagem"}]'::jsonb), '{"tipo":"todas"}', pg_temp.ator('m')) ->> 'id')::uuid;

-- Criar
select throws_ok($$select pg_temp.cria('a@teste.dev', 'tok-0', '[]', 'vr')$$, 'P0001', 'vaga_fechada', 'vaga em rascunho não recebe candidatura');
select throws_ok($$select pg_temp.cria('a@teste.dev', 'tok-0')$$, 'P0001', 'resposta_obrigatoria', 'pergunta obrigatória sem resposta (11.2)');
insert into fx select 'c1', (pg_temp.cria('Ana.Silva@Teste.dev', 'tok-1', jsonb_build_array(jsonb_build_object('pergunta_id', pg_temp.id('p1'), 'valor', 'nao'))) ->> 'id')::uuid;
select is((select situacao::text || '/' || (recebida_em is null)::text from public.rs_candidaturas where id = pg_temp.id('c1')), 'ativa/true', 'nasce ativa e não recebida');
select is((select e.nome from public.rs_candidaturas c join public.rs_etapas e on e.id = c.etapa_id where c.id = pg_temp.id('c1')), 'Triagem', 'entra na 1ª etapa');
select is((select sinalizada from public.rs_candidaturas where id = pg_temp.id('c1')), true, 'resposta diferente do requisito sinaliza (11.10)');
select is((select email::text from public.rs_candidatos k join public.rs_candidaturas c on c.candidato_id = k.id where c.id = pg_temp.id('c1')), 'ana.silva@teste.dev', 'e-mail normalizado');
select is(pg_temp.cria('ana.silva@teste.dev', 'tok-1b', jsonb_build_array(jsonb_build_object('pergunta_id', pg_temp.id('p1'), 'valor', 'sim'))),
          jsonb_build_object('id', pg_temp.id('c1'), 'existente', true, 'recebida', false), 'mesmo e-mail na vaga devolve a existente (11.3)');
select is((select token_hash from public.rs_candidaturas where id = pg_temp.id('c1')), 'tok-1', 'a duplicada não mexe no token (o servidor gira o link pela rs_fn_troca_link, 8.6)');
select is((select sinalizada from public.rs_candidaturas where id = pg_temp.id('c1')), true, 'a duplicada não muda a candidatura');
select throws_ok($$select public.rs_fn_cria_candidatura(pg_temp.id('e'), pg_temp.id('v'), pg_temp.cand('b@teste.dev'),
  jsonb_build_array(jsonb_build_object('pergunta_id', pg_temp.id('p1'), 'valor', 'sim')), 'pagina', pg_temp.publico(), '2026-11-20', false, 'tok-x', 1)$$,
  'P0001', 'limite_candidaturas_vaga', 'limite de candidaturas por vaga (11.14)');

-- Concluir
select is((pg_temp.conclui(pg_temp.id('c1'), 'rec:c1') ->> 'ja_recebida'), null, 'conclui');
select isnt((select recebida_em from public.rs_candidaturas where id = pg_temp.id('c1')), null, 'recebida_em preenchida');
select is((pg_temp.conclui(pg_temp.id('c1'), 'rec:c1b') ->> 'ja_recebida')::boolean, true, 'concluir de novo não repete');
select is((select corpo from public.rs_mensagens where candidatura_id = pg_temp.id('c1') and tipo = 'confirmacao'), 'Acompanhe: {{link_acompanhamento}}',
          'a mensagem guardada não tem o link (20.3)');
select is((select count(*)::int from public.rs_eventos where candidatura_id = pg_temp.id('c1') and tipo = 'candidatura_criada'), 1, 'evento candidatura_criada');
select is((select token_hash from public.rs_candidaturas where id = pg_temp.id('c1')), 'final-rec:c1', 'o token definitivo nasce na conclusão');

-- Manual (11.2): sem respostas obrigatórias e sem currículo, mesmo com a vaga pedindo
update public.rs_vagas set curriculo_obrigatorio = true where id = pg_temp.id('v');
select throws_ok($$select pg_temp.conclui((pg_temp.cria('dani@teste.dev', 'tok-d', jsonb_build_array(jsonb_build_object('pergunta_id', pg_temp.id('p1'), 'valor', 'sim'))) ->> 'id')::uuid, 'rec:d')$$,
                 'P0001', 'curriculo_obrigatorio', 'pela página, a vaga que pede currículo não conclui sem ele');
insert into fx select 'cm', (public.rs_fn_cria_candidatura(pg_temp.id('e'), pg_temp.id('v'), pg_temp.cand('edu@teste.dev'), '[]', 'manual',
  pg_temp.ator('m'), 'manual', false, 'tok-m', 10000) ->> 'id')::uuid;
select lives_ok(format('select pg_temp.conclui(%L, %L)', pg_temp.id('cm'), 'rec:cm'), 'manual conclui sem currículo e sem respostas');
update public.rs_vagas set curriculo_obrigatorio = false where id = pg_temp.id('v');

-- Desistiu (12.2, 11.12)
select throws_ok(format('select public.rs_fn_encerra_candidatura(%L, %L, %L, %L, null, null)', pg_temp.id('c1'), pg_temp.id('e'), 'reprovada', pg_temp.ator('m')),
                 'P0001', 'devolutiva_obrigatoria', 'reprovar exige devolutiva (11.5)');
select lives_ok(format('select public.rs_fn_encerra_candidatura(%L, %L, %L, %L, null, null)', pg_temp.id('c1'), pg_temp.id('e'), 'desistiu', pg_temp.publico()), 'retirar');
select is((select (expurgar_em::date - encerrada_em::date) from public.rs_candidaturas where id = pg_temp.id('c1')), 180, 'expurgar_em = encerramento + retenção (11.12)');
select throws_ok(format('select public.rs_fn_encerra_candidatura(%L, %L, %L, %L, null, null)', pg_temp.id('c1'), pg_temp.id('e'), 'desistiu', pg_temp.publico()),
                 'P0001', 'transicao_proibida', 'não retira duas vezes');

-- Código de exclusão (11.13)
insert into fx select 'c2', (pg_temp.cria('bia@teste.dev', 'tok-2', jsonb_build_array(jsonb_build_object('pergunta_id', pg_temp.id('p1'), 'valor', 'sim'))) ->> 'id')::uuid;
select pg_temp.conclui(pg_temp.id('c2'), 'rec:c2', '{"path":"x/y/curriculo.pdf","nome_original":"cv.pdf","mime":"application/pdf","bytes":10,"sha256":"ab"}');
select is(public.rs_fn_valida_codigo_exclusao(pg_temp.id('c2'), 'h1', 5), 'sem_codigo', 'sem código pedido');
select is(public.rs_fn_novo_codigo_exclusao(pg_temp.id('c2'), 'h1', 600, 60, 5), 'ok', 'gera código');
select is(public.rs_fn_novo_codigo_exclusao(pg_temp.id('c2'), 'h2', 600, 60, 5), 'aguarde', 'intervalo mínimo entre códigos');
select is(public.rs_fn_valida_codigo_exclusao(pg_temp.id('c2'), 'errado', 5), 'errado:4', 'errado conta tentativa');
select is(public.rs_fn_valida_codigo_exclusao(pg_temp.id('c2'), 'errado', 5), 'errado:3', 'errado de novo');
select is(public.rs_fn_valida_codigo_exclusao(pg_temp.id('c2'), 'errado', 5), 'errado:2', 'terceira');
select is(public.rs_fn_valida_codigo_exclusao(pg_temp.id('c2'), 'errado', 5), 'errado:1', 'quarta');
select is(public.rs_fn_valida_codigo_exclusao(pg_temp.id('c2'), 'errado', 5), 'bloqueado', 'quinta bloqueia');
select is(public.rs_fn_valida_codigo_exclusao(pg_temp.id('c2'), 'h1', 5), 'sem_codigo', 'bloqueado apaga o código');
update public.rs_candidaturas set exclusao_expira_em = now() - interval '11 minutes' where id = pg_temp.id('c2');
select is(public.rs_fn_novo_codigo_exclusao(pg_temp.id('c2'), 'h3', 600, 60, 5), 'ok', 'novo código depois do intervalo');
update public.rs_candidaturas set exclusao_expira_em = now() - interval '1 second' where id = pg_temp.id('c2');
select is(public.rs_fn_valida_codigo_exclusao(pg_temp.id('c2'), 'h3', 5), 'expirado', 'código vence em 10 min');
update public.rs_candidaturas set exclusao_codigos_hora = 5 where id = pg_temp.id('c2');
select is(public.rs_fn_novo_codigo_exclusao(pg_temp.id('c2'), 'h4', 600, 0, 5), 'limite_hora', 'até 5 códigos por hora');
update public.rs_candidaturas set exclusao_codigos_hora = 0 where id = pg_temp.id('c2');
select is(public.rs_fn_novo_codigo_exclusao(pg_temp.id('c2'), 'h5', 600, 0, 5), 'ok', 'código');
select is(public.rs_fn_valida_codigo_exclusao(pg_temp.id('c2'), 'h5', 5), 'ok', 'código certo');

-- Excluir os dados (7.4, 11.13): duas candidaturas da mesma pessoa na empresa
insert into fx select 'v2', (public.rs_fn_cria_vaga(pg_temp.id('e'), jsonb_build_object('titulo', 'Caixa', 'modelo_trabalho', 'remoto',
  'curriculo_obrigatorio', false, 'descricao', repeat('Descrição longa da vaga. ', 4), 'etapas', '[{"nome":"Triagem","tipo":"triagem"}]'::jsonb),
  '{"tipo":"todas"}', pg_temp.ator('m')) ->> 'id')::uuid;
select public.rs_fn_transicao_vaga(pg_temp.id('v2'), pg_temp.id('e'), 'publicada', null, '{"tipo":"todas"}', pg_temp.ator('m'), 50);
insert into fx select 'c3', (pg_temp.cria('bia@teste.dev', 'tok-3', '[]', 'v2') ->> 'id')::uuid;
select pg_temp.conclui(pg_temp.id('c3'), 'rec:c3');
select is(public.rs_fn_exclui_dados_candidato(pg_temp.id('c2'), pg_temp.id('e')), array['x/y/curriculo.pdf'], 'devolve os arquivos para apagar');
select is((select string_agg(situacao::text, ',' order by criado_em) from public.rs_candidaturas where id in (pg_temp.id('c2'), pg_temp.id('c3'))),
          'desistiu,desistiu', 'as ativas viram desistiu');
select is((select count(*)::int from public.rs_notificacoes where candidatura_id in (pg_temp.id('c2'), pg_temp.id('c3')) and tipo = 'mensagem_candidato'), 0,
          'desistência por exclusão não manda e-mail');
select is((select nome || '/' || coalesce(email::text, 'null') || '/' || (anonimizado_em is not null)::text from public.rs_candidatos k
             join public.rs_candidaturas c on c.candidato_id = k.id where c.id = pg_temp.id('c2')), 'Pessoa removida/null/true', 'cadastro anonimizado');
select is((select count(*)::int from public.rs_respostas where candidatura_id = pg_temp.id('c2')), 0, 'respostas apagadas');
select is((select count(*)::int from public.rs_arquivos where candidatura_id = pg_temp.id('c2')), 0, 'arquivos apagados');
select is((select assunto || corpo from public.rs_mensagens where candidatura_id = pg_temp.id('c2') and tipo = 'confirmacao'), '', 'mensagens sem assunto e corpo');
select is((select count(*)::int from public.rs_candidaturas where id in (pg_temp.id('c2'), pg_temp.id('c3'))), 2, 'as linhas das candidaturas ficam');
select is((select count(*)::int from public.rs_eventos where candidatura_id = pg_temp.id('c2') and tipo = 'dados_excluidos'), 1, 'evento dados_excluidos');
select throws_ok(format('select public.rs_fn_encerra_candidatura(%L, %L, %L, %L, null, null)', pg_temp.id('c3'), pg_temp.id('e'), 'contratada', pg_temp.ator('m')),
                 'P0001', 'candidatura_anonimizada', 'anonimizada não transita mais (12.2)');
select is(public.rs_fn_novo_codigo_exclusao(pg_temp.id('c2'), 'h6', 600, 0, 5), 'indisponivel', 'sem código depois de excluído');

-- Janela deslizante (11.14)
select is(public.rs_fn_conta_tentativa('ip-hash-0000000001', 'candidatura', 2, 3600), true, '1ª tentativa');
select is(public.rs_fn_conta_tentativa('ip-hash-0000000001', 'candidatura', 2, 3600), true, '2ª tentativa');
select is(public.rs_fn_conta_tentativa('ip-hash-0000000001', 'candidatura', 2, 3600), false, '3ª passa do limite');
update public.rs_tentativas_publicas set criado_em = now() - interval '61 minutes' where chave_hash = 'ip-hash-0000000001';
select is(public.rs_fn_conta_tentativa('ip-hash-0000000001', 'candidatura', 2, 3600), true, 'a janela anda');

-- Faxina (9.4): não recebida com mais de 24 h sai, recebida fica
insert into fx select 'c4', (pg_temp.cria('caio@teste.dev', 'tok-4', jsonb_build_array(jsonb_build_object('pergunta_id', pg_temp.id('p1'), 'valor', 'sim'))) ->> 'id')::uuid;
update public.rs_candidaturas set criado_em = now() - interval '25 hours' where id in (pg_temp.id('c4'), pg_temp.id('c3'));
select is(public.rs_fn_faxina_candidaturas_abandonadas(200), array[pg_temp.id('e')::text || '/' || pg_temp.id('c4')::text || '/'], 'devolve o prefixo da abandonada');
select is((select count(*)::int from public.rs_candidaturas where id in (pg_temp.id('c4'), pg_temp.id('c3'))), 1, 'só a não recebida sai');
select is((select count(*)::int from public.rs_candidatos where email = 'caio@teste.dev'), 0, 'o cadastro sem candidatura sai junto');

-- Achados do verifier do 8.4
-- (a) talentos só vale na conclusão: candidatura abandonada não deixa consentimento.
insert into fx select 'ct', (public.rs_fn_cria_candidatura(pg_temp.id('e'), pg_temp.id('v'), pg_temp.cand('tal@teste.dev'),
  jsonb_build_array(jsonb_build_object('pergunta_id', pg_temp.id('p1'), 'valor', 'sim')), 'pagina', pg_temp.publico(), '2026-11-20', true, 'tok-t', 10000) ->> 'id')::uuid;
select is((select talentos_consentido_em from public.rs_candidatos where email operator(extensions.=) 'tal@teste.dev'::extensions.citext), null,
          'o consentimento de talentos não vale antes de concluir');
select pg_temp.conclui(pg_temp.id('ct'), 'rec:ct');
select isnt((select talentos_consentido_em from public.rs_candidatos where email operator(extensions.=) 'tal@teste.dev'::extensions.citext), null,
          'o consentimento de talentos vale na conclusão');
-- (b) candidatura nova não sobrescreve o cadastro que já existe.
insert into fx select 'v3', (public.rs_fn_cria_vaga(pg_temp.id('e'), jsonb_build_object('titulo', 'Repositor', 'modelo_trabalho', 'remoto',
  'descricao', repeat('Descrição longa da vaga. ', 4), 'etapas', '[{"nome":"Triagem","tipo":"triagem"}]'::jsonb),
  '{"tipo":"todas"}', pg_temp.ator('m')) ->> 'id')::uuid;
select public.rs_fn_transicao_vaga(pg_temp.id('v3'), pg_temp.id('e'), 'publicada', null, '{"tipo":"todas"}', pg_temp.ator('m'), 50);
insert into fx select 'cz', (public.rs_fn_cria_candidatura(pg_temp.id('e'), pg_temp.id('v3'), pg_temp.cand('tal@teste.dev', '{"nome":"Outro Nome","telefone":"11999998888"}'),
  '[]', 'pagina', pg_temp.publico(), '2026-11-20', false, 'tok-z', 10000) ->> 'id')::uuid;
select is((select nome || '/' || coalesce(telefone, '-') from public.rs_candidatos where email operator(extensions.=) 'tal@teste.dev'::extensions.citext),
          'Pessoa Teste/-', 'quem se candidata com um e-mail já cadastrado não muda o cadastro');
-- (c) vaga fechada entre criar e concluir: não conclui.
select public.rs_fn_transicao_vaga(pg_temp.id('v3'), pg_temp.id('e'), 'pausada', null, '{"tipo":"todas"}', pg_temp.ator('m'), 50);
select throws_ok(format('select pg_temp.conclui(%L, %L)', pg_temp.id('cz'), 'rec:cz'), 'P0001', 'vaga_fechada',
                 'concluir depois de a vaga sair do ar é recusado');

select * from finish();
rollback;
