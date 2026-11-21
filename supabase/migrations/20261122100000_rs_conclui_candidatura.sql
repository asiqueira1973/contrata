-- Contrata — épico 8.4, ajuste de rs_fn_conclui_candidatura (antes do primeiro uso, ainda local):
-- 1) recebe o hash do token /c definitivo: o link só existe em claro no e-mail que sai agora, então
--    o servidor gera o token na conclusão e grava o hash na mesma transação (11.4, 20.3);
-- 2) candidatura manual (adicionar_candidato, 11.2) conclui sem currículo mesmo quando a vaga pede
--    (o fallback registrar_candidato é "sem currículo", 13.3).
drop function public.rs_fn_conclui_candidatura(uuid, uuid, jsonb, jsonb, jsonb, jsonb);

create function public.rs_fn_conclui_candidatura(p_candidatura uuid, p_empresa uuid, p_arquivo jsonb,
  p_mensagem jsonb, p_notificacao jsonb, p_ator jsonb, p_token_hash text) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v public.rs_candidaturas;
  v_obrigatorio boolean;
  v_arquivo uuid;
  v_notificacao uuid;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa for update;
  if v.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if v.recebida_em is not null then
    return pg_catalog.jsonb_build_object('ja_recebida', true);
  end if;
  select curriculo_obrigatorio into v_obrigatorio from public.rs_vagas where id = v.vaga_id;
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
  perform public.rs_fn_atualiza_busca(p_candidatura);
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'candidatura_criada', p_ator, 'publico',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura, 'origem', v.origem, 'com_curriculo', p_arquivo is not null,
      'sinalizada', v.sinalizada));
  return pg_catalog.jsonb_build_object('notificacao_id', v_notificacao, 'arquivo_id', v_arquivo);
end $$;

revoke execute on function public.rs_fn_conclui_candidatura(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.rs_fn_conclui_candidatura(uuid, uuid, jsonb, jsonb, jsonb, jsonb, text) to service_role;
