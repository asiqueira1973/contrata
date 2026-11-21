-- Contrata — épico 8.6, correções do verifier (spec.md v0.4.7; 11.7, 11.23, 11.32): o banco
-- exige um membro como ator também em rs_fn_reabre_candidatura e rs_fn_executa_decisao (defesa em
-- profundidade: os invólucros já exigiam), e rs_fn_confirma_decisao confere o alcance antes de
-- olhar status e prazo. Mesmas assinaturas; privilégios mantidos.

create or replace function public.rs_fn_reabre_candidatura(p_candidatura uuid, p_empresa uuid, p_alcance jsonb, p_ator jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  v public.rs_candidaturas;
  v_vaga public.rs_vagas;
  v_etapa uuid;
begin
  -- Reabrir é decisão (11.23): só com um membro como ator, mesmo chamada direto.
  if p_ator ->> 'tipo' <> 'membro' then
    raise exception 'decisao_so_por_pessoa' using errcode = 'P0001';
  end if;
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa and recebida_em is not null for update;
  select * into v_vaga from public.rs_vagas where id = v.vaga_id;
  if v.id is null or not public.rs_fn_vaga_no_alcance(v_vaga.id, v_vaga.area_id, p_alcance) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_candidatos where id = v.candidato_id and anonimizado_em is not null) then
    raise exception 'candidatura_anonimizada' using errcode = 'P0001';
  end if;
  if v.situacao in ('ativa', 'encerrada_vaga') or (v.expurgar_em is not null and v.expurgar_em <= pg_catalog.now()) then
    raise exception 'transicao_proibida' using errcode = 'P0001';
  end if;
  if v_vaga.status not in ('publicada', 'pausada') then
    raise exception 'vaga_fechada' using errcode = 'P0001';
  end if;
  v_etapa := coalesce(v.etapa_id, (select id from public.rs_etapas where vaga_id = v.vaga_id order by ordem limit 1));
  perform pg_catalog.set_config('rs.transicao', 'on', true);
  update public.rs_candidaturas set situacao = 'ativa', encerrada_em = null, expurgar_em = null, motivo_reprovacao = null,
         etapa_id = v_etapa, movida_em = pg_catalog.now()
   where id = p_candidatura;
  perform pg_catalog.set_config('rs.transicao', 'off', true);
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'candidatura_reaberta', p_ator, 'web',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura, 'de', v.situacao));
end $$;

create or replace function public.rs_fn_executa_decisao(p_empresa uuid, p_tipo public.rs_tipo_decisao, p_candidatura uuid, p_vaga uuid,
  p_payload jsonb, p_mensagens jsonb, p_ator jsonb, p_decisao uuid) returns integer
language plpgsql set search_path = '' as $$
declare
  v_c record;
  v_n integer := 0;
  v_dados jsonb := pg_catalog.jsonb_build_object('decisao_id', p_decisao);
begin
  -- Defesa em profundidade (11.7): o executor também exige um membro como ator.
  if p_ator ->> 'tipo' <> 'membro' then
    raise exception 'decisao_so_por_pessoa' using errcode = 'P0001';
  end if;
  if p_tipo = 'reprovar' then
    perform public.rs_fn_encerra_candidatura(p_candidatura, p_empresa, 'reprovada', p_ator,
      coalesce(nullif(p_payload ->> 'motivo', ''), 'outro')::public.rs_motivo_reprovacao, p_mensagens -> p_candidatura::text, v_dados);
    return 1;
  elsif p_tipo = 'contratar' then
    perform public.rs_fn_encerra_candidatura(p_candidatura, p_empresa, 'contratada', p_ator, null, p_mensagens -> p_candidatura::text, v_dados);
    return 1;
  elsif p_tipo = 'enviar_mensagem' then
    perform public.rs_fn_envia_mensagem(p_candidatura, p_empresa, coalesce(p_mensagens -> p_candidatura::text ->> 'tipo', 'contato')::public.rs_tipo_mensagem,
      p_mensagens -> p_candidatura::text, p_ator, p_decisao, null);
    return 1;
  end if;
  -- encerrar_vaga: todas as recebidas em andamento recebem a devolutiva (11.5); depois, a vaga.
  if (select count(*) from public.rs_candidaturas where vaga_id = p_vaga and empresa_id = p_empresa and situacao = 'ativa'
       and recebida_em is not null) > 1000 then
    raise exception 'lote_grande_demais' using errcode = 'P0001';
  end if;
  for v_c in select id from public.rs_candidaturas where vaga_id = p_vaga and empresa_id = p_empresa and situacao = 'ativa'
              and recebida_em is not null order by id for update loop
    perform public.rs_fn_encerra_candidatura(v_c.id, p_empresa, 'encerrada_vaga', p_ator, null, p_mensagens -> v_c.id::text, v_dados);
    v_n := v_n + 1;
  end loop;
  perform public.rs_fn_transicao_vaga(p_vaga, p_empresa, 'encerrada',
    coalesce(nullif(p_payload ->> 'motivo_encerramento', ''), 'outro')::public.rs_motivo_encerramento_vaga,
    '{"tipo":"todas"}', p_ator, 50);
  return v_n;
end $$;

create or replace function public.rs_fn_confirma_decisao(p_decisao uuid, p_empresa uuid, p_alcance jsonb, p_payload jsonb, p_mensagens jsonb, p_ator jsonb)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  d public.rs_decisoes;
  v_motivo text;
  v_ator jsonb;
begin
  if p_ator ->> 'tipo' <> 'membro' then
    raise exception 'decisao_so_por_pessoa' using errcode = 'P0001';
  end if;
  select * into d from public.rs_decisoes where id = p_decisao and empresa_id = p_empresa for update;
  -- Alcance antes de tudo: fora dele a proposta não existe para quem clica.
  if d.id is null or public.rs_fn_alvo_da_decisao(p_empresa, d.tipo, d.candidatura_id, d.vaga_id, p_alcance) = 'nao_encontrado' then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if d.status <> 'pendente' then
    return pg_catalog.jsonb_build_object('status', d.status, 'motivo', 'ja_decidida');
  end if;
  v_motivo := case when d.expira_em <= pg_catalog.now() then 'venceu'
                   else public.rs_fn_alvo_da_decisao(p_empresa, d.tipo, d.candidatura_id, d.vaga_id, p_alcance) end;
  if v_motivo = 'nao_encontrado' then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if v_motivo is not null then
    update public.rs_decisoes set status = 'expirada', decidida_por_membro_id = (p_ator ->> 'membro_id')::uuid, decidida_em = pg_catalog.now()
     where id = d.id;
    perform public.rs_fn_registra_evento(p_empresa, d.vaga_id, d.candidatura_id, 'decisao_expirada', p_ator, 'web',
      pg_catalog.jsonb_build_object('decisao_id', d.id, 'motivo', v_motivo));
    return pg_catalog.jsonb_build_object('status', 'expirada', 'motivo', v_motivo);
  end if;
  -- Quem executa é o membro que clicou; o evento guarda quem propôs.
  v_ator := p_ator || pg_catalog.jsonb_build_object('autorizado_por_membro_id', p_ator ->> 'membro_id');
  perform public.rs_fn_executa_decisao(p_empresa, d.tipo, d.candidatura_id, d.vaga_id, coalesce(p_payload, d.payload), p_mensagens, v_ator, d.id);
  update public.rs_decisoes set status = 'confirmada', payload = coalesce(p_payload, d.payload),
         decidida_por_membro_id = (p_ator ->> 'membro_id')::uuid, decidida_em = pg_catalog.now()
   where id = d.id;
  perform public.rs_fn_registra_evento(p_empresa, d.vaga_id, d.candidatura_id, 'decisao_confirmada', v_ator, 'web',
    pg_catalog.jsonb_build_object('decisao_id', d.id, 'tipo', d.tipo, 'proposta_por_tipo', d.proposta_por_tipo,
      'proposta_por_membro_id', d.proposta_por_membro_id, 'proposta_por_credencial_id', d.credencial_id));
  return pg_catalog.jsonb_build_object('status', 'confirmada');
end $$;

revoke execute on function public.rs_fn_reabre_candidatura(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.rs_fn_reabre_candidatura(uuid, uuid, jsonb, jsonb) to service_role;
revoke execute on function public.rs_fn_executa_decisao(uuid, public.rs_tipo_decisao, uuid, uuid, jsonb, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.rs_fn_executa_decisao(uuid, public.rs_tipo_decisao, uuid, uuid, jsonb, jsonb, jsonb, uuid) to service_role;
revoke execute on function public.rs_fn_confirma_decisao(uuid, uuid, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.rs_fn_confirma_decisao(uuid, uuid, jsonb, jsonb, jsonb, jsonb) to service_role;
