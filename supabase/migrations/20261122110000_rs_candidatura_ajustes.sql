-- Contrata — épico 8.4, correções do verifier (spec.md v0.4.4; 11.29, 12.1, 11.5, 20.3):
-- 1) o pedido de banco de talentos fica na candidatura (talentos_pedido) e só vira consentimento na
--    conclusão: candidatura abandonada não deixa a pessoa no banco, e a faxina pode apagá-la;
-- 2) candidatura nova não altera o cadastro que já existe (o e-mail não é verificado);
-- 3) concluir confere de novo que a vaga está publicada.
-- Mesmas assinaturas: create or replace, privilégios mantidos.
alter table public.rs_candidaturas add column talentos_pedido boolean not null default false;

create or replace function public.rs_fn_cria_candidatura(
  p_empresa uuid, p_vaga uuid, p_candidato jsonb, p_respostas jsonb, p_origem public.rs_origem_candidatura,
  p_ator jsonb, p_consentimento text, p_talentos boolean, p_token_hash text, p_max_por_vaga integer
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_vaga public.rs_vagas;
  v_empresa public.rs_empresas;
  v_candidato uuid;
  v_existente public.rs_candidaturas;
  v_etapa uuid;
  v_id uuid;
  v_email extensions.citext := pg_catalog.lower(pg_catalog.btrim(p_candidato ->> 'email'))::extensions.citext;
  v_item jsonb;
  v_pergunta public.rs_perguntas;
  v_sinalizada boolean := false;
begin
  select * into v_empresa from public.rs_empresas where id = p_empresa and excluida_em is null and suspensa_em is null;
  select * into v_vaga from public.rs_vagas where id = p_vaga and empresa_id = p_empresa for share;
  if v_empresa.id is null or v_vaga.id is null or v_vaga.status <> 'publicada' then
    raise exception 'vaga_fechada' using errcode = 'P0001';
  end if;
  select id into v_candidato from public.rs_candidatos
   where empresa_id = p_empresa and email operator(extensions.=) v_email for update;
  if v_candidato is not null then
    select * into v_existente from public.rs_candidaturas where vaga_id = p_vaga and candidato_id = v_candidato for update;
    if v_existente.id is not null then
      -- 11.3: não cria outra nem muda a candidatura; só troca o token para o link ser reenviado.
      update public.rs_candidaturas set token_hash = p_token_hash where id = v_existente.id;
      return pg_catalog.jsonb_build_object('id', v_existente.id, 'existente', true, 'recebida', v_existente.recebida_em is not null);
    end if;
  end if;
  if (select count(*) from public.rs_candidaturas where vaga_id = p_vaga) >= p_max_por_vaga then
    raise exception 'limite_candidaturas_vaga' using errcode = 'P0001';
  end if;
  if v_candidato is null then
    insert into public.rs_candidatos (empresa_id, email, nome, telefone, linkedin_url, cidade)
    values (p_empresa, v_email, p_candidato ->> 'nome', nullif(p_candidato ->> 'telefone', ''),
            nullif(p_candidato ->> 'linkedin_url', ''), nullif(p_candidato ->> 'cidade', ''))
    returning id into v_candidato;
  end if;
  -- Cadastro que já existe não muda: o e-mail não é verificado, então quem o souber não pode
  -- trocar o nome nem preencher o telefone de outra pessoa (achado do verifier do 8.4).
  select id into v_etapa from public.rs_etapas where vaga_id = p_vaga order by ordem limit 1;
  insert into public.rs_candidaturas (empresa_id, vaga_id, candidato_id, etapa_id, origem, token_hash,
                                      consentimento_versao, consentimento_em, talentos_pedido)
  values (p_empresa, p_vaga, v_candidato, v_etapa, p_origem, p_token_hash, p_consentimento, pg_catalog.now(), coalesce(p_talentos, false))
  returning id into v_id;
  for v_item in select * from pg_catalog.jsonb_array_elements(coalesce(p_respostas, '[]')) loop
    select * into v_pergunta from public.rs_perguntas where id = (v_item ->> 'pergunta_id')::uuid and vaga_id = p_vaga;
    if v_pergunta.id is null then
      raise exception 'pergunta_invalida' using errcode = 'P0001';
    end if;
    if nullif(v_item ->> 'valor', '') is not null then
      insert into public.rs_respostas (candidatura_id, pergunta_id, valor) values (v_id, v_pergunta.id, v_item ->> 'valor');
      -- 11.10: resposta diferente do requisito declarado só sinaliza; nunca move nem reprova.
      if v_pergunta.resposta_esperada is not null and v_item ->> 'valor' <> v_pergunta.resposta_esperada then
        v_sinalizada := true;
      end if;
    end if;
  end loop;
  -- Pergunta obrigatória sem resposta: só a manual (11.2) passa sem as respostas.
  if p_origem <> 'manual' and exists (
    select 1 from public.rs_perguntas p where p.vaga_id = p_vaga and p.obrigatoria
       and not exists (select 1 from public.rs_respostas r where r.candidatura_id = v_id and r.pergunta_id = p.id)
  ) then
    raise exception 'resposta_obrigatoria' using errcode = 'P0001';
  end if;
  update public.rs_candidaturas set sinalizada = v_sinalizada where id = v_id;
  return pg_catalog.jsonb_build_object('id', v_id, 'existente', false, 'recebida', false);
end $$;

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

revoke execute on function public.rs_fn_cria_candidatura(uuid, uuid, jsonb, jsonb, public.rs_origem_candidatura, jsonb, text, boolean, text, integer) from public, anon, authenticated;
grant execute on function public.rs_fn_cria_candidatura(uuid, uuid, jsonb, jsonb, public.rs_origem_candidatura, jsonb, text, boolean, text, integer) to service_role;
revoke execute on function public.rs_fn_conclui_candidatura(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.rs_fn_conclui_candidatura(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text) to service_role;
