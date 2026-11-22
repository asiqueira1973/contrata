-- Contrata — épico 8.9, correções do verifier (spec.md v0.4.10; 7.4, 15.5): concluir candidatura
-- confere a empresa ativa e se trava com a exclusão (A2); salvar a empresa guarda também o texto
-- anterior do aviso com a versão dele (A7); e o texto extra que já existia entra no histórico.

-- ---------------------------------------------------------------- concluir (A2)
create or replace function public.rs_fn_conclui_candidatura(p_candidatura uuid, p_empresa uuid, p_arquivo jsonb,
  p_mensagem jsonb, p_notificacao jsonb, p_ator jsonb, p_token_hash text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v public.rs_candidaturas;
  v_obrigatorio boolean;
  v_arquivo uuid;
  v_notificacao uuid;
  v_vaga public.rs_vagas;
begin
  -- Empresa excluída ou suspensa não recebe candidatura; o "for share" serializa com a exclusão
  -- (rs_fn_exclui_empresa trava a empresa "for update" antes de contar as em andamento; achado A2
  -- do verifier do 8.9).
  perform 1 from public.rs_empresas where id = p_empresa and excluida_em is null and suspensa_em is null for share;
  if not found then
    raise exception 'vaga_fechada' using errcode = 'P0001';
  end if;
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa for update;
  if v.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if v.recebida_em is not null then
    return pg_catalog.jsonb_build_object('ja_recebida', true);
  end if;
  -- A vaga pode ter saído do ar entre criar e concluir (até 1 h): não entra candidatura ativa em
  -- vaga pausada ou encerrada (12.1, 11.5; achado do verifier do 8.4).
  select * into v_vaga from public.rs_vagas where id = v.vaga_id for share;
  if v_vaga.status <> 'publicada' then
    raise exception 'vaga_fechada' using errcode = 'P0001';
  end if;
  v_obrigatorio := v_vaga.curriculo_obrigatorio;
  if v_obrigatorio and p_arquivo is null and v.origem <> 'manual' then
    raise exception 'curriculo_obrigatorio' using errcode = 'P0001';
  end if;
  if p_arquivo is not null then
    delete from public.rs_arquivos where candidatura_id = p_candidatura and tipo = 'curriculo';
    insert into public.rs_arquivos (empresa_id, candidatura_id, tipo, path, nome_original, mime, bytes, sha256, confirmado_em)
    values (p_empresa, p_candidatura, 'curriculo', p_arquivo ->> 'path', p_arquivo ->> 'nome_original', p_arquivo ->> 'mime',
            (p_arquivo ->> 'bytes')::integer, p_arquivo ->> 'sha256', pg_catalog.now())
    returning id into v_arquivo;
  end if;
  update public.rs_candidaturas set recebida_em = pg_catalog.now(), movida_em = pg_catalog.now(), token_hash = p_token_hash
   where id = p_candidatura;
  insert into public.rs_notificacoes (empresa_id, candidatura_id, tipo, destinatario, chave_idempotencia, assunto, html, texto, reply_to)
  values (p_empresa, p_candidatura, (p_notificacao ->> 'tipo')::public.rs_tipo_notificacao, p_notificacao ->> 'destinatario',
          p_notificacao ->> 'chave', p_notificacao ->> 'assunto', p_notificacao ->> 'html', p_notificacao ->> 'texto',
          nullif(p_notificacao ->> 'reply_to', ''))
  returning id into v_notificacao;
  insert into public.rs_mensagens (empresa_id, candidatura_id, tipo, assunto, corpo, ator_tipo, notificacao_id)
  values (p_empresa, p_candidatura, 'confirmacao', p_mensagem ->> 'assunto', p_mensagem ->> 'corpo', 'sistema', v_notificacao);
  -- Banco de talentos (11.29): o pedido feito no formulário só vira consentimento aqui, com a
  -- candidatura enviada; a abandonada não deixa a pessoa no banco.
  if v.talentos_pedido then
    update public.rs_candidatos set talentos_consentido_em = pg_catalog.now(),
           talentos_expira_em = pg_catalog.now() + pg_catalog.make_interval(months => e.talentos_meses)
      from public.rs_empresas e
     where rs_candidatos.id = v.candidato_id and e.id = p_empresa;
    perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'talentos_consentido', p_ator, 'publico',
      pg_catalog.jsonb_build_object('candidatura_id', p_candidatura));
  end if;
  perform public.rs_fn_atualiza_busca(p_candidatura);
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'candidatura_criada', p_ator, 'publico',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura, 'origem', v.origem, 'com_curriculo', p_arquivo is not null,
      'sinalizada', v.sinalizada));
  return pg_catalog.jsonb_build_object('notificacao_id', v_notificacao, 'arquivo_id', v_arquivo);
end $$;

-- ---------------------------------------------------------------- salvar (A7)
drop function public.rs_fn_salva_empresa(uuid, jsonb, text, jsonb);
create function public.rs_fn_salva_empresa(p_empresa uuid, p_dados jsonb, p_versao_aviso text, p_ator jsonb, p_versao_anterior text default null) returns text[]
language plpgsql set search_path = '' as $$
declare
  a public.rs_empresas;
  n public.rs_empresas;
  v_campos text[] := '{}';
begin
  perform public.rs_fn_exige_administrador(p_empresa, p_ator);
  select * into a from public.rs_empresas where id = p_empresa and excluida_em is null for update;
  if a.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  update public.rs_empresas set
    nome = case when p_dados ? 'nome' then p_dados ->> 'nome' else nome end,
    descricao = case when p_dados ? 'descricao' then nullif(p_dados ->> 'descricao', '') else descricao end,
    site_url = case when p_dados ? 'site_url' then nullif(p_dados ->> 'site_url', '') else site_url end,
    email_contato = case when p_dados ? 'email_contato' then (p_dados ->> 'email_contato')::extensions.citext else email_contato end,
    cor_destaque = case when p_dados ? 'cor_destaque' then nullif(pg_catalog.lower(p_dados ->> 'cor_destaque'), '') else cor_destaque end,
    pagina_publicada = case when p_dados ? 'pagina_publicada' then (p_dados ->> 'pagina_publicada')::boolean else pagina_publicada end,
    retencao_dias = case when p_dados ? 'retencao_dias' then (p_dados ->> 'retencao_dias')::smallint else retencao_dias end,
    talentos_meses = case when p_dados ? 'talentos_meses' then (p_dados ->> 'talentos_meses')::smallint else talentos_meses end,
    mensagens_agente = case when p_dados ? 'mensagens_agente' then (p_dados ->> 'mensagens_agente')::public.rs_mensagens_agente else mensagens_agente end,
    aviso_privacidade_extra = case when p_dados ? 'aviso_privacidade_extra' then nullif(pg_catalog.btrim(p_dados ->> 'aviso_privacidade_extra'), '') else aviso_privacidade_extra end
   where id = p_empresa returning * into n;
  if n.nome is distinct from a.nome then v_campos := pg_catalog.array_append(v_campos, 'nome'); end if;
  if n.descricao is distinct from a.descricao then v_campos := pg_catalog.array_append(v_campos, 'descricao'); end if;
  if n.site_url is distinct from a.site_url then v_campos := pg_catalog.array_append(v_campos, 'site_url'); end if;
  if n.email_contato is distinct from a.email_contato then v_campos := pg_catalog.array_append(v_campos, 'email_contato'); end if;
  if n.cor_destaque is distinct from a.cor_destaque then v_campos := pg_catalog.array_append(v_campos, 'cor_destaque'); end if;
  if n.pagina_publicada is distinct from a.pagina_publicada then v_campos := pg_catalog.array_append(v_campos, 'pagina_publicada'); end if;
  if n.retencao_dias is distinct from a.retencao_dias then v_campos := pg_catalog.array_append(v_campos, 'retencao_dias'); end if;
  if n.talentos_meses is distinct from a.talentos_meses then v_campos := pg_catalog.array_append(v_campos, 'talentos_meses'); end if;
  if n.mensagens_agente is distinct from a.mensagens_agente then v_campos := pg_catalog.array_append(v_campos, 'mensagens_agente'); end if;
  if n.aviso_privacidade_extra is distinct from a.aviso_privacidade_extra then
    v_campos := pg_catalog.array_append(v_campos, 'aviso_privacidade_extra');
    -- O texto que sai também fica guardado com a versão dele (o anterior ao 8.9 não tinha histórico).
    if a.aviso_privacidade_extra is not null and p_versao_anterior is not null then
      insert into public.rs_avisos_privacidade (empresa_id, versao, texto_extra)
      values (p_empresa, p_versao_anterior, a.aviso_privacidade_extra) on conflict on constraint rs_avisos_unico do nothing;
    end if;
    if n.aviso_privacidade_extra is not null then
      if p_versao_aviso is null then
        raise exception 'dados_invalidos' using errcode = 'P0001';
      end if;
      insert into public.rs_avisos_privacidade (empresa_id, versao, texto_extra)
      values (p_empresa, p_versao_aviso, n.aviso_privacidade_extra) on conflict on constraint rs_avisos_unico do nothing;
    end if;
  end if;
  if pg_catalog.cardinality(v_campos) > 0 then
    perform public.rs_fn_registra_evento(p_empresa, null, null, 'empresa_editada', p_ator, 'web',
      pg_catalog.jsonb_build_object('campos', v_campos, 'retencao_dias', n.retencao_dias, 'talentos_meses', n.talentos_meses,
        'mensagens_agente', n.mensagens_agente, 'pagina_publicada', n.pagina_publicada));
  end if;
  return v_campos;
end $$;

-- Texto extra que já existia antes do 8.9: entra no histórico com a versão que as candidaturas
-- gravaram (a padrão de 2026-11-20 + 8 hex do sha256 do texto sem espaços nas pontas).
insert into public.rs_avisos_privacidade (empresa_id, versao, texto_extra)
select id, '2026-11-20+' || pg_catalog.left(pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.btrim(aviso_privacidade_extra), 'UTF8')), 'hex'), 8),
       pg_catalog.btrim(aviso_privacidade_extra)
  from public.rs_empresas where aviso_privacidade_extra is not null and pg_catalog.btrim(aviso_privacidade_extra) <> ''
on conflict on constraint rs_avisos_unico do nothing;

revoke execute on function public.rs_fn_conclui_candidatura(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.rs_fn_conclui_candidatura(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text) to service_role;
revoke execute on function public.rs_fn_salva_empresa(uuid, jsonb, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.rs_fn_salva_empresa(uuid, jsonb, text, jsonb, text) to service_role;
