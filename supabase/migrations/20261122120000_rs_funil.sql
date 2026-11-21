-- Contrata — épico 8.5, funil (spec.md v0.4.5, seções 11.9, 11.10, 11.22, 11.28, 11.30, 11.32 e
-- 11.34). Convenções do 8.1: plpgsql, search_path = '', EXECUTE só para service_role, evento na
-- mesma transação, erro P0001 = código. Toda leitura e escrita passa pelo alcance (11.32) e só
-- enxerga candidaturas recebidas (recebida_em, 8.4).

-- ---------------------------------------------------------------- atualizado_em (v0.4.5)
-- Para o filtro atualizada_desde da API v1: muda em toda alteração da candidatura, e as funções de
-- nota e avaliação tocam a linha.
alter table public.rs_candidaturas add column atualizado_em timestamptz not null default now();
update public.rs_candidaturas set atualizado_em = coalesce(recebida_em, criado_em);
create trigger rs_tg_atualizado_em before update on public.rs_candidaturas
  for each row execute function public.rs_tg_atualizado_em();
create index rs_candidaturas_atualizado on public.rs_candidaturas (empresa_id, atualizado_em);

-- ---------------------------------------------------------------- listar e buscar (8.5, 11.28)
-- Lista candidaturas recebidas no alcance. Recebe: empresa, alcance, filtros
-- {vaga_id, etapa_id, situacao ('ativa' padrão | 'todas' | uma situação), sinalizada,
-- parada_desde, pendente_de (membro: na equipe e sem avaliação na etapa atual), atualizada_desde,
-- q (busca, 11.28), ordem ('chegada' | 'movimentacao')}, início e limite. Com q, ordena por
-- relevância e depois por chegada. Devolve uma linha por candidatura (o servidor pede limite + 1).
create function public.rs_fn_lista_candidaturas(p_empresa uuid, p_alcance jsonb, p_filtros jsonb, p_inicio integer, p_limite integer)
returns table (id uuid, vaga_id uuid, etapa_id uuid, situacao text, sinalizada boolean, nome text,
               recebida_em timestamptz, movida_em timestamptz, encerrada_em timestamptz, atualizado_em timestamptz, relevancia real)
language plpgsql stable set search_path = '' as $$
#variable_conflict use_column
declare
  v_q text := nullif(pg_catalog.btrim(p_filtros ->> 'q'), '');
  v_tsq tsquery := case when v_q is null then null
                        else pg_catalog.websearch_to_tsquery('pg_catalog.portuguese', extensions.unaccent(v_q)) end;
  v_situacao text := coalesce(nullif(p_filtros ->> 'situacao', ''), 'ativa');
  v_pendente uuid := nullif(p_filtros ->> 'pendente_de', '')::uuid;
begin
  return query
  select c.id, c.vaga_id, c.etapa_id, c.situacao::text, c.sinalizada, k.nome, c.recebida_em, c.movida_em, c.encerrada_em,
         c.atualizado_em,
         case when v_tsq is null then null else pg_catalog.ts_rank(c.texto_busca, v_tsq) end
    from public.rs_candidaturas c
    join public.rs_vagas v on v.id = c.vaga_id
    join public.rs_candidatos k on k.id = c.candidato_id
   where c.empresa_id = p_empresa
     and c.recebida_em is not null
     and public.rs_fn_vaga_no_alcance(v.id, v.area_id, p_alcance)
     and (v_situacao = 'todas' or c.situacao::text = v_situacao)
     and (p_filtros ->> 'vaga_id' is null or c.vaga_id = (p_filtros ->> 'vaga_id')::uuid)
     and (p_filtros ->> 'etapa_id' is null or c.etapa_id = (p_filtros ->> 'etapa_id')::uuid)
     and (p_filtros ->> 'sinalizada' is null or c.sinalizada = (p_filtros ->> 'sinalizada')::boolean)
     and (p_filtros ->> 'parada_desde' is null
          or (c.situacao = 'ativa' and c.movida_em < (p_filtros ->> 'parada_desde')::timestamptz))
     and (p_filtros ->> 'atualizada_desde' is null or c.atualizado_em >= (p_filtros ->> 'atualizada_desde')::timestamptz)
     and (v_pendente is null or (
           c.situacao = 'ativa'
           and exists (select 1 from public.rs_vaga_equipe q where q.vaga_id = c.vaga_id and q.membro_id = v_pendente)
           and not exists (select 1 from public.rs_avaliacoes a where a.candidatura_id = c.id and a.etapa_id = c.etapa_id
                           and a.membro_id = v_pendente)))
     and (v_tsq is null or c.texto_busca @@ v_tsq)
   order by
     case when v_tsq is not null then pg_catalog.ts_rank(c.texto_busca, v_tsq) end desc nulls last,
     case when v_tsq is null and p_filtros ->> 'ordem' = 'movimentacao' then c.movida_em end desc nulls last,
     c.recebida_em, c.id
   offset greatest(p_inicio, 0) limit greatest(p_limite, 0);
end $$;

-- ---------------------------------------------------------------- mover (11.30, 11.34)
-- Move de 1 a 100 candidaturas para uma etapa, tudo ou nada. Todas da mesma vaga da etapa, ativas,
-- recebidas e no alcance. Grava movida_em e o evento etapa_alterada {de, para} em cada uma; quem já
-- está na etapa fica como está. Recebe: ids, empresa, etapa, alcance e ator. Devolve quantas mudaram.
create function public.rs_fn_move_etapa(p_ids uuid[], p_empresa uuid, p_etapa uuid, p_alcance jsonb, p_ator jsonb)
returns integer
language plpgsql set search_path = '' as $$
declare
  v_ids uuid[] := (select pg_catalog.array_agg(distinct x) from pg_catalog.unnest(p_ids) x);
  v_etapa public.rs_etapas;
  v_vaga public.rs_vagas;
  v record;
  v_achadas integer;
  v_movidas integer := 0;
begin
  if v_ids is null or pg_catalog.cardinality(v_ids) = 0 or pg_catalog.cardinality(v_ids) > 100 then
    raise exception 'lote_invalido' using errcode = 'P0001';
  end if;
  select * into v_etapa from public.rs_etapas where id = p_etapa;
  select * into v_vaga from public.rs_vagas where id = v_etapa.vaga_id and empresa_id = p_empresa;
  if v_vaga.id is null or not public.rs_fn_vaga_no_alcance(v_vaga.id, v_vaga.area_id, p_alcance) then
    raise exception 'etapa_nao_encontrada' using errcode = 'P0001';
  end if;
  -- Trava as linhas antes de conferir, para o lote valer inteiro ou nada.
  perform 1 from public.rs_candidaturas c where c.id = any (v_ids) and c.empresa_id = p_empresa order by c.id for update;
  select count(*) into v_achadas from public.rs_candidaturas c join public.rs_vagas w on w.id = c.vaga_id
   where c.id = any (v_ids) and c.empresa_id = p_empresa and c.recebida_em is not null
     and public.rs_fn_vaga_no_alcance(w.id, w.area_id, p_alcance);
  if v_achadas <> pg_catalog.cardinality(v_ids) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_candidaturas where id = any (v_ids) and vaga_id <> v_vaga.id) then
    raise exception 'etapa_de_outra_vaga' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_candidaturas where id = any (v_ids) and situacao <> 'ativa') then
    raise exception 'candidatura_nao_ativa' using errcode = 'P0001';
  end if;
  for v in select c.id, c.etapa_id from public.rs_candidaturas c
            where c.id = any (v_ids) and c.etapa_id is distinct from p_etapa order by c.id loop
    update public.rs_candidaturas set etapa_id = p_etapa, movida_em = pg_catalog.now() where id = v.id;
    perform public.rs_fn_registra_evento(p_empresa, v_vaga.id, v.id, 'etapa_alterada', p_ator, 'web',
      pg_catalog.jsonb_build_object('candidatura_id', v.id, 'de', v.etapa_id, 'para', p_etapa));
    v_movidas := v_movidas + 1;
  end loop;
  return v_movidas;
end $$;

-- ---------------------------------------------------------------- nota (11.34)
-- Adiciona uma nota interna (membro, agente em nome do membro, ou integração). Recebe: candidatura,
-- empresa, alcance, texto (1–10.000) e ator. O evento nota_adicionada não leva o texto (11.6).
-- Devolve o id da nota.
create function public.rs_fn_adiciona_nota(p_candidatura uuid, p_empresa uuid, p_alcance jsonb, p_texto text, p_ator jsonb)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v public.rs_candidaturas;
  v_vaga public.rs_vagas;
  v_id uuid;
  v_texto text := pg_catalog.btrim(coalesce(p_texto, ''));
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa and recebida_em is not null for update;
  select * into v_vaga from public.rs_vagas where id = v.vaga_id;
  if v.id is null or not public.rs_fn_vaga_no_alcance(v_vaga.id, v_vaga.area_id, p_alcance) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if pg_catalog.char_length(v_texto) not between 1 and 10000 then
    raise exception 'nota_invalida' using errcode = 'P0001';
  end if;
  if p_ator ->> 'tipo' not in ('membro', 'agente', 'api') then
    raise exception 'ator_invalido' using errcode = 'P0001';
  end if;
  insert into public.rs_notas (candidatura_id, texto, ator_tipo, membro_id, credencial_id)
  values (p_candidatura, v_texto, (p_ator ->> 'tipo')::public.rs_tipo_ator, (p_ator ->> 'membro_id')::uuid,
          (p_ator ->> 'credencial_id')::uuid)
  returning id into v_id;
  update public.rs_candidaturas set atualizado_em = pg_catalog.now() where id = p_candidatura;
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'nota_adicionada', p_ator, 'web',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura, 'nota_id', v_id));
  return v_id;
end $$;

-- ---------------------------------------------------------------- avaliação (11.9)
-- Registra ou troca a avaliação do membro numa etapa (uma por etapa por membro). Só quem está na
-- equipe da vaga avalia, e só candidatura ativa; etapa da mesma vaga; comentário de 10 a 5.000.
-- Recebe: candidatura, empresa, etapa, membro, recomendação, comentário e ator. O evento leva só a
-- etapa e a recomendação. Devolve o id da avaliação.
create function public.rs_fn_registra_avaliacao(p_candidatura uuid, p_empresa uuid, p_etapa uuid, p_membro uuid,
  p_recomendacao public.rs_recomendacao, p_comentario text, p_ator jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  v public.rs_candidaturas;
  v_id uuid;
  v_nova boolean;
  v_comentario text := pg_catalog.btrim(coalesce(p_comentario, ''));
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa and recebida_em is not null for update;
  if v.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.rs_vaga_equipe where vaga_id = v.vaga_id and membro_id = p_membro) then
    raise exception 'fora_da_equipe' using errcode = 'P0001';
  end if;
  if v.situacao <> 'ativa' then
    raise exception 'candidatura_nao_ativa' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.rs_etapas where id = p_etapa and vaga_id = v.vaga_id) then
    raise exception 'etapa_de_outra_vaga' using errcode = 'P0001';
  end if;
  if pg_catalog.char_length(v_comentario) not between 10 and 5000 then
    raise exception 'comentario_invalido' using errcode = 'P0001';
  end if;
  v_nova := not exists (select 1 from public.rs_avaliacoes where candidatura_id = p_candidatura and etapa_id = p_etapa and membro_id = p_membro);
  insert into public.rs_avaliacoes (candidatura_id, etapa_id, membro_id, recomendacao, comentario)
  values (p_candidatura, p_etapa, p_membro, p_recomendacao, v_comentario)
  on conflict (candidatura_id, etapa_id, membro_id)
  do update set recomendacao = excluded.recomendacao, comentario = excluded.comentario
  returning id into v_id;
  update public.rs_candidaturas set atualizado_em = pg_catalog.now() where id = p_candidatura;
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'avaliacao_registrada', p_ator, 'web',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura, 'etapa_id', p_etapa, 'recomendacao', p_recomendacao,
      'nova', v_nova));
  return v_id;
end $$;

-- ---------------------------------------------------------------- privilégios (6.5)
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('rs_fn_lista_candidaturas', 'rs_fn_move_etapa', 'rs_fn_adiciona_nota',
                                                       'rs_fn_registra_avaliacao') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
