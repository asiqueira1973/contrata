-- Contrata — épico 8.7, correções do verifier (spec.md v0.4.8; 11.12, 11.32): a busca do banco de
-- talentos casa o texto e a vaga anterior só em candidaturas recebidas no alcance, e e-mail não é
-- busca; convite usado por candidatura não concluída que a faxina apagou volta a valer; a faxina não
-- manda (nem marca) o aviso de 30 dias de empresa suspensa ou excluída. Mesmas assinaturas.

-- ---------------------------------------------------------------- criar candidatura com convite
create or replace function public.rs_fn_cria_candidatura(
  p_empresa uuid, p_vaga uuid, p_candidato jsonb, p_respostas jsonb, p_origem public.rs_origem_candidatura,
  p_ator jsonb, p_consentimento text, p_talentos boolean, p_token_hash text, p_max_por_vaga integer, p_convite uuid default null
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
  v_origem public.rs_origem_candidatura := p_origem;
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
      -- 11.3: não cria outra nem muda nada; o servidor gira o link (rs_fn_troca_link) para reenviá-lo.
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
  -- Convite do banco de talentos (8.7): vale só se for desta empresa, desta vaga, desta pessoa
  -- (mesmo e-mail) e estiver no prazo; aí a origem é banco_talentos e o convite fica usado.
  -- Convite que não vale não é erro: a candidatura segue com a origem recebida.
  -- Usado por uma candidatura que não existe mais (a faxina apaga a não concluída em 24 h) volta a
  -- valer: a pessoa só tem uma candidatura por vaga (11.3), então chegar aqui é prova disso.
  if p_convite is not null and exists (select 1 from public.rs_convites_talento t where t.id = p_convite and t.empresa_id = p_empresa
       and t.vaga_id = p_vaga and t.candidato_id = v_candidato and t.expira_em > pg_catalog.now()) then
    v_origem := 'banco_talentos';
    update public.rs_convites_talento set usado_em = pg_catalog.now() where id = p_convite;
  end if;
  select id into v_etapa from public.rs_etapas where vaga_id = p_vaga order by ordem limit 1;
  insert into public.rs_candidaturas (empresa_id, vaga_id, candidato_id, etapa_id, origem, token_hash,
                                      consentimento_versao, consentimento_em, talentos_pedido)
  values (p_empresa, p_vaga, v_candidato, v_etapa, v_origem, p_token_hash, p_consentimento, pg_catalog.now(), coalesce(p_talentos, false))
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
  if v_origem <> 'manual' and exists (
    select 1 from public.rs_perguntas p where p.vaga_id = p_vaga and p.obrigatoria
       and not exists (select 1 from public.rs_respostas r where r.candidatura_id = v_id and r.pergunta_id = p.id)
  ) then
    raise exception 'resposta_obrigatoria' using errcode = 'P0001';
  end if;
  update public.rs_candidaturas set sinalizada = v_sinalizada where id = v_id;
  return pg_catalog.jsonb_build_object('id', v_id, 'existente', false, 'recebida', false);
end $$;

-- ---------------------------------------------------------------- buscar (8.7, 11.28, 11.32)
-- Pessoas com consentimento válido, não anonimizadas, no alcance. Filtros {q, vaga_anterior}: q
-- busca no texto das candidaturas recebidas dela em vagas do alcance (respostas, currículo, cidade);
-- vaga_anterior, quem se candidatou àquela vaga, se ela estiver no alcance. Texto com "@" não busca
-- nada: o banco de talentos não serve para descobrir se um e-mail está lá. Com q, por relevância.
create or replace function public.rs_fn_busca_talentos(p_empresa uuid, p_alcance jsonb, p_filtros jsonb, p_inicio integer, p_limite integer)
returns table (candidato_id uuid, nome text, cidade text, linkedin_url text, talentos_expira_em timestamptz, relevancia real)
language plpgsql stable set search_path = '' as $$
#variable_conflict use_column
declare
  v_q text := nullif(pg_catalog.btrim(p_filtros ->> 'q'), '');
  v_tsq tsquery := case when v_q is null then null
                        else pg_catalog.websearch_to_tsquery('pg_catalog.portuguese', extensions.unaccent(v_q)) end;
  v_vaga uuid := nullif(p_filtros ->> 'vaga_anterior', '')::uuid;
begin
  if v_q is not null and pg_catalog.strpos(v_q, '@') > 0 then
    return;
  end if;
  return query
  with visiveis as (
    select c.candidato_id, c.vaga_id, c.texto_busca
      from public.rs_candidaturas c join public.rs_vagas v on v.id = c.vaga_id
     where c.empresa_id = p_empresa and c.recebida_em is not null and p_alcance ->> 'tipo' <> 'equipe'
       and public.rs_fn_vaga_no_alcance(v.id, v.area_id, p_alcance)
  )
  select k.id, k.nome, k.cidade, k.linkedin_url, k.talentos_expira_em,
         case when v_tsq is null then null else
           (select max(pg_catalog.ts_rank(c.texto_busca, v_tsq)) from visiveis c where c.candidato_id = k.id and c.texto_busca @@ v_tsq) end
    from public.rs_candidatos k
   where k.empresa_id = p_empresa
     and k.anonimizado_em is null
     and k.talentos_expira_em > pg_catalog.now()
     and exists (select 1 from visiveis c where c.candidato_id = k.id)
     and (v_vaga is null or exists (select 1 from visiveis c where c.candidato_id = k.id and c.vaga_id = v_vaga))
     and (v_tsq is null or exists (select 1 from visiveis c where c.candidato_id = k.id and c.texto_busca @@ v_tsq))
   order by 6 desc nulls last, k.talentos_expira_em desc, k.id
   offset greatest(p_inicio, 0) limit greatest(p_limite, 0);
end $$;

-- ---------------------------------------------------------------- faxina (11.12; 8.7)
create or replace function public.rs_fn_faxina_talentos(p_lote integer) returns jsonb
language plpgsql set search_path = '' as $$
declare
  k record;
  v_retirados integer := 0;
  v_avisar jsonb := '[]';
  v_cand uuid;
begin
  for k in select id, empresa_id from public.rs_candidatos where talentos_expira_em <= pg_catalog.now()
            order by talentos_expira_em limit p_lote for update skip locked loop
    update public.rs_candidatos set talentos_consentido_em = null, talentos_expira_em = null, talentos_avisado_em = null where id = k.id;
    perform public.rs_fn_registra_evento(k.empresa_id, null, null, 'talentos_retirado', '{"tipo":"sistema","origem":"cron"}', 'cron',
      pg_catalog.jsonb_build_object('candidato_id', k.id, 'motivo', 'venceu'));
    v_retirados := v_retirados + 1;
  end loop;
  for k in select id, empresa_id, talentos_expira_em from public.rs_candidatos
            where talentos_expira_em > pg_catalog.now() and talentos_expira_em <= pg_catalog.now() + interval '30 days'
              and talentos_avisado_em is null and anonimizado_em is null
              -- Empresa suspensa ou excluída não manda o aviso; ele fica para quando ela voltar.
              and exists (select 1 from public.rs_empresas e where e.id = rs_candidatos.empresa_id and e.excluida_em is null and e.suspensa_em is null)
            order by talentos_expira_em limit p_lote for update skip locked loop
    select id into v_cand from public.rs_candidaturas where candidato_id = k.id and recebida_em is not null
       and token_hash not like 'anonimizada:%' order by recebida_em desc limit 1;
    update public.rs_candidatos set talentos_avisado_em = pg_catalog.now() where id = k.id;
    if v_cand is not null then
      v_avisar := v_avisar || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('empresa_id', k.empresa_id, 'candidato_id', k.id,
        'candidatura_id', v_cand, 'expira_em', k.talentos_expira_em));
    end if;
  end loop;
  return pg_catalog.jsonb_build_object('retirados', v_retirados, 'avisar', v_avisar);
end $$;

revoke execute on function public.rs_fn_cria_candidatura(uuid, uuid, jsonb, jsonb, public.rs_origem_candidatura, jsonb, text, boolean, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.rs_fn_cria_candidatura(uuid, uuid, jsonb, jsonb, public.rs_origem_candidatura, jsonb, text, boolean, text, integer, uuid) to service_role;
revoke execute on function public.rs_fn_busca_talentos(uuid, jsonb, jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.rs_fn_busca_talentos(uuid, jsonb, jsonb, integer, integer) to service_role;
revoke execute on function public.rs_fn_faxina_talentos(integer) from public, anon, authenticated;
grant execute on function public.rs_fn_faxina_talentos(integer) to service_role;
