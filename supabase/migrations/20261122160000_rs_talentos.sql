-- Contrata — épico 8.7, banco de talentos (spec.md v0.4.8; 11.12, 11.27, 11.32, 13.2, 13.3, 15.1,
-- 15.3, 15.4). Convenções do 8.1: plpgsql, search_path = '', EXECUTE só para service_role, evento na
-- mesma transação, erro P0001 = código. Só quem tem consentimento válido aparece; o convite não cria
-- candidatura: guarda só quem foi convidado para qual vaga (o texto do e-mail não fica, 20.3).

-- ---------------------------------------------------------------- estrutura (v0.4.8)
-- Convite do banco de talentos: o id é o ?convite= do link da vaga. Vale 30 dias, uma vez.
create table public.rs_convites_talento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  candidato_id uuid not null references public.rs_candidatos (id) on delete cascade,
  vaga_id uuid not null references public.rs_vagas (id) on delete cascade,
  ator_tipo public.rs_tipo_ator not null constraint rs_convites_talento_ator check (ator_tipo in ('membro', 'agente', 'api')),
  membro_id uuid references public.rs_membros (id),
  credencial_id uuid references public.rs_credenciais (id),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '30 days',
  usado_em timestamptz
);
create index rs_convites_talento_candidato on public.rs_convites_talento (candidato_id, vaga_id);
create index rs_convites_talento_empresa on public.rs_convites_talento (empresa_id);
create index rs_convites_talento_vaga on public.rs_convites_talento (vaga_id);
create index rs_convites_talento_membro on public.rs_convites_talento (membro_id);
create index rs_convites_talento_credencial on public.rs_convites_talento (credencial_id);
alter table public.rs_convites_talento enable row level security;
revoke all on table public.rs_convites_talento from anon, authenticated;

-- Aviso de 30 dias (talentos_expirando): uma vez por período de consentimento; renovar zera.
alter table public.rs_candidatos add column talentos_avisado_em timestamptz;

-- ---------------------------------------------------------------- criar candidatura com convite
-- rs_fn_cria_candidatura ganha p_convite (opcional, no fim): mesma regra do 8.6 e, com convite
-- válido, origem banco_talentos.
drop function public.rs_fn_cria_candidatura(uuid, uuid, jsonb, jsonb, public.rs_origem_candidatura, jsonb, text, boolean, text, integer);
create function public.rs_fn_cria_candidatura(
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
  if p_convite is not null and exists (select 1 from public.rs_convites_talento t where t.id = p_convite and t.empresa_id = p_empresa
       and t.vaga_id = p_vaga and t.candidato_id = v_candidato and t.usado_em is null and t.expira_em > pg_catalog.now()) then
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

-- Diz se a pessoa aparece no banco de talentos para esse alcance (11.32): alguma candidatura
-- recebida dela em vaga do alcance. O avaliador (alcance equipe) não usa o banco de talentos.
create function public.rs_fn_talento_no_alcance(p_candidato uuid, p_alcance jsonb) returns boolean
language plpgsql stable set search_path = '' as $$
begin
  if p_alcance ->> 'tipo' = 'equipe' then return false; end if;
  return exists (select 1 from public.rs_candidaturas c join public.rs_vagas v on v.id = c.vaga_id
                 where c.candidato_id = p_candidato and c.recebida_em is not null
                   and public.rs_fn_vaga_no_alcance(v.id, v.area_id, p_alcance));
end $$;

-- ---------------------------------------------------------------- buscar (8.7, 11.28)
-- Pessoas com consentimento válido, não anonimizadas, no alcance. Filtros {q, vaga_anterior}: q
-- busca no texto das candidaturas dela (nome, e-mail, cidade, respostas, currículo); vaga_anterior,
-- quem se candidatou àquela vaga. Com q, por relevância. O servidor pede limite + 1.
create function public.rs_fn_busca_talentos(p_empresa uuid, p_alcance jsonb, p_filtros jsonb, p_inicio integer, p_limite integer)
returns table (candidato_id uuid, nome text, cidade text, linkedin_url text, talentos_expira_em timestamptz, relevancia real)
language plpgsql stable set search_path = '' as $$
#variable_conflict use_column
declare
  v_q text := nullif(pg_catalog.btrim(p_filtros ->> 'q'), '');
  v_tsq tsquery := case when v_q is null then null
                        else pg_catalog.websearch_to_tsquery('pg_catalog.portuguese', extensions.unaccent(v_q)) end;
  v_vaga uuid := nullif(p_filtros ->> 'vaga_anterior', '')::uuid;
begin
  return query
  select k.id, k.nome, k.cidade, k.linkedin_url, k.talentos_expira_em,
         case when v_tsq is null then null else
           (select max(pg_catalog.ts_rank(c.texto_busca, v_tsq)) from public.rs_candidaturas c where c.candidato_id = k.id and c.texto_busca @@ v_tsq) end
    from public.rs_candidatos k
   where k.empresa_id = p_empresa
     and k.anonimizado_em is null
     and k.talentos_expira_em > pg_catalog.now()
     and public.rs_fn_talento_no_alcance(k.id, p_alcance)
     and (v_vaga is null or exists (select 1 from public.rs_candidaturas c where c.candidato_id = k.id and c.vaga_id = v_vaga and c.recebida_em is not null))
     and (v_tsq is null or exists (select 1 from public.rs_candidaturas c where c.candidato_id = k.id and c.texto_busca @@ v_tsq))
   order by 6 desc nulls last, k.talentos_expira_em desc, k.id
   offset greatest(p_inicio, 0) limit greatest(p_limite, 0);
end $$;

-- ---------------------------------------------------------------- convidar (8.7)
-- Convida uma pessoa do banco para uma vaga publicada do alcance: cria (ou reaproveita, se ainda
-- vale) o convite e registra talentos_convidado. Não cria candidatura. Quem já se candidatou à vaga
-- volta com ja_candidato. Recebe: empresa, candidato, vaga, alcance e ator. Devolve
-- {convite_id, ja_candidato}.
create function public.rs_fn_convida_talento(p_empresa uuid, p_candidato uuid, p_vaga uuid, p_alcance jsonb, p_ator jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_vaga public.rs_vagas;
  k public.rs_candidatos;
  v_id uuid;
begin
  if p_ator ->> 'tipo' not in ('membro', 'agente', 'api') then
    raise exception 'ator_invalido' using errcode = 'P0001';
  end if;
  select * into v_vaga from public.rs_vagas where id = p_vaga and empresa_id = p_empresa;
  if v_vaga.id is null or not public.rs_fn_vaga_no_alcance(v_vaga.id, v_vaga.area_id, p_alcance) then
    raise exception 'vaga_nao_encontrada' using errcode = 'P0001';
  end if;
  if v_vaga.status <> 'publicada' then
    raise exception 'vaga_fechada' using errcode = 'P0001';
  end if;
  select * into k from public.rs_candidatos where id = p_candidato and empresa_id = p_empresa for update;
  if k.id is null or k.anonimizado_em is not null or k.talentos_expira_em is null or k.talentos_expira_em <= pg_catalog.now()
     or not public.rs_fn_talento_no_alcance(k.id, p_alcance) then
    raise exception 'talento_indisponivel' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_candidaturas where candidato_id = k.id and vaga_id = p_vaga) then
    return pg_catalog.jsonb_build_object('convite_id', null, 'ja_candidato', true);
  end if;
  select id into v_id from public.rs_convites_talento where candidato_id = k.id and vaga_id = p_vaga and usado_em is null
     and expira_em > pg_catalog.now() order by criado_em desc limit 1;
  if v_id is null then
    insert into public.rs_convites_talento (empresa_id, candidato_id, vaga_id, ator_tipo, membro_id, credencial_id)
    values (p_empresa, k.id, p_vaga, (p_ator ->> 'tipo')::public.rs_tipo_ator, (p_ator ->> 'membro_id')::uuid, (p_ator ->> 'credencial_id')::uuid)
    returning id into v_id;
  end if;
  perform public.rs_fn_registra_evento(p_empresa, p_vaga, null, 'talentos_convidado', p_ator, 'web',
    pg_catalog.jsonb_build_object('candidato_id', k.id, 'vaga_id', p_vaga, 'convite_id', v_id));
  return pg_catalog.jsonb_build_object('convite_id', v_id, 'ja_candidato', false);
end $$;

-- ---------------------------------------------------------------- o titular no /c (11.13; 8.7)
-- Entrar, renovar ou sair do banco de talentos pelo link de acompanhamento. Entrar e renovar valem
-- por talentos_meses a partir de agora e zeram o aviso de 30 dias. Recebe: candidatura e ação.
-- Devolve a nova validade (null ao sair).
create function public.rs_fn_talentos_candidato(p_candidatura uuid, p_acao text) returns timestamptz
language plpgsql set search_path = '' as $$
declare
  v public.rs_candidaturas;
  v_meses smallint;
  v_expira timestamptz;
  v_ator jsonb := '{"tipo":"candidato","origem":"publico"}';
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and recebida_em is not null;
  if v.id is null or exists (select 1 from public.rs_candidatos where id = v.candidato_id and anonimizado_em is not null) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if p_acao = 'sair' then
    update public.rs_candidatos set talentos_consentido_em = null, talentos_expira_em = null, talentos_avisado_em = null where id = v.candidato_id;
    perform public.rs_fn_registra_evento(v.empresa_id, v.vaga_id, p_candidatura, 'talentos_retirado', v_ator, 'publico',
      pg_catalog.jsonb_build_object('candidatura_id', p_candidatura));
    return null;
  elsif p_acao in ('entrar', 'renovar') then
    select talentos_meses into v_meses from public.rs_empresas where id = v.empresa_id;
    v_expira := pg_catalog.now() + pg_catalog.make_interval(months => v_meses);
    update public.rs_candidatos set talentos_consentido_em = pg_catalog.now(), talentos_expira_em = v_expira, talentos_avisado_em = null
     where id = v.candidato_id;
    perform public.rs_fn_registra_evento(v.empresa_id, v.vaga_id, p_candidatura, 'talentos_consentido', v_ator, 'publico',
      pg_catalog.jsonb_build_object('candidatura_id', p_candidatura, 'acao', p_acao));
    return v_expira;
  end if;
  raise exception 'acao_invalida' using errcode = 'P0001';
end $$;

-- ---------------------------------------------------------------- faxina (11.12; 8.7)
-- Tira do banco quem venceu (talentos_retirado, ator sistema) e devolve, marcando o aviso, quem
-- vence em até 30 dias e ainda não foi avisado, com a candidatura mais recente (para o link do /c).
-- Recebe: o lote. Devolve {retirados, avisar: [{empresa_id, candidato_id, candidatura_id, expira_em}]}.
create function public.rs_fn_faxina_talentos(p_lote integer) returns jsonb
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

-- ---------------------------------------------------------------- privilégios (6.5)
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'rs\_%' loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
