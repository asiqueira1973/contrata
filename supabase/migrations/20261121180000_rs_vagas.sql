-- Contrata — épico 8.3, vagas (spec.md v0.4.2, seções 7.3, 7.5, 11.1, 11.11, 11.14, 11.22, 11.31,
-- 11.32 e 12.1). Convenções do 8.1: plpgsql, SECURITY INVOKER, search_path = '', EXECUTE só para
-- service_role, evento na mesma transação, erro P0001 com mensagem = código.
-- O servidor valida tudo antes com os schemas zod da 11.1 (src/lib/schemas/jobs.ts); aqui ficam as
-- invariantes que não podem depender da porta: alcance, máquina 12.1, congelamento, unicidade.
-- O alcance chega como jsonb: {"tipo":"todas"} | {"tipo":"areas","area_ids":[...]} | {"tipo":"equipe","membro_id":...}.

-- ---------------------------------------------------------------- índices apontados pelo advisor (8.2)
create index rs_decisoes_candidatura on public.rs_decisoes (candidatura_id);
create index rs_empresas_criada_por on public.rs_empresas (criada_por_usuario_id);

-- ---------------------------------------------------------------- idempotência do POST /api/v1/vagas (13.2)
-- Mesmo padrão do Assina: a chave fica na própria vaga criada; chave repetida devolve a mesma vaga.
alter table public.rs_vagas add column chave_idempotencia text
  constraint rs_vagas_chave_idempotencia check (char_length(chave_idempotencia) between 1 and 100);
create unique index rs_vagas_idempotencia on public.rs_vagas (empresa_id, chave_idempotencia)
  where chave_idempotencia is not null;

-- ---------------------------------------------------------------- congelamento estendido (11.1, 12.1)
-- Vaga encerrada: nada muda, nem etapas nem equipe (rs_tg_vaga_congelada já cobre a vaga e as
-- perguntas). O expurgo da empresa (rs.expurgo_empresa) e o apagar de rascunho passam.
create function public.rs_tg_vaga_encerrada_filhos() returns trigger
language plpgsql set search_path = '' as $$
declare v_vaga public.rs_vagas;
begin
  select * into v_vaga from public.rs_vagas where id = coalesce(new.vaga_id, old.vaga_id);
  if not found then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if pg_catalog.current_setting('rs.expurgo_empresa', true) = v_vaga.empresa_id::text then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if v_vaga.status = 'encerrada' then
    raise exception 'vaga_encerrada' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger rs_tg_vaga_encerrada_filhos before insert or update or delete on public.rs_etapas
  for each row execute function public.rs_tg_vaga_encerrada_filhos();
create trigger rs_tg_vaga_encerrada_filhos before insert or update or delete on public.rs_vaga_equipe
  for each row execute function public.rs_tg_vaga_encerrada_filhos();

-- ---------------------------------------------------------------- alcance (11.32)
-- Diz se uma vaga (pela área e pela equipe) está no alcance. Recebe: id e área da vaga, alcance.
create function public.rs_fn_vaga_no_alcance(p_vaga uuid, p_area uuid, p_alcance jsonb) returns boolean
language plpgsql stable set search_path = '' as $$
begin
  case p_alcance ->> 'tipo'
    when 'todas' then return true;
    when 'areas' then
      return p_area is not null and p_area::text in (select pg_catalog.jsonb_array_elements_text(p_alcance -> 'area_ids'));
    when 'equipe' then
      return exists (select 1 from public.rs_vaga_equipe where vaga_id = p_vaga
                     and membro_id = (p_alcance ->> 'membro_id')::uuid);
    else return false;
  end case;
end $$;

-- Diz se uma área pode receber vaga de quem tem esse alcance (criar ou trocar de área, 8.3).
-- "Sem área" (nulo) só para quem vê todas. Avaliador (equipe) não cria vaga.
create function public.rs_fn_area_no_alcance(p_area uuid, p_alcance jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  case p_alcance ->> 'tipo'
    when 'todas' then return true;
    when 'areas' then
      return p_area is not null and p_area::text in (select pg_catalog.jsonb_array_elements_text(p_alcance -> 'area_ids'));
    else return false;
  end case;
end $$;

-- ---------------------------------------------------------------- slug (7.3)
-- Gera um slug livre na empresa a partir do título: sem acento, minúsculo, hífens; colisão ganha
-- -2, -3… Recebe: empresa, texto base e a vaga que pode manter o próprio slug.
create function public.rs_fn_slug_vaga(p_empresa uuid, p_base text, p_vaga uuid) returns text
language plpgsql set search_path = '' as $$
declare
  v_base text;
  v_slug text;
  v_n integer := 1;
begin
  v_base := pg_catalog.lower(extensions.unaccent(coalesce(p_base, '')));
  v_base := pg_catalog.regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := pg_catalog.btrim(pg_catalog.left(v_base, 120), '-');
  if v_base = '' then
    v_base := 'vaga';
  end if;
  v_slug := v_base;
  while exists (select 1 from public.rs_vagas where empresa_id = p_empresa and slug = v_slug
                and id is distinct from p_vaga) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end $$;

-- ---------------------------------------------------------------- partes da vaga
-- Grava as etapas (11.22): 1–15; itens com id são da vaga e mudam nome, tipo e ordem; itens sem id
-- entram; etapa que saiu da lista é excluída, só se não houver candidatura nela.
-- Recebe: vaga e a lista [{id?, nome, tipo}] na ordem desejada.
create function public.rs_fn_grava_etapas(p_vaga uuid, p_etapas jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  v_item jsonb;
  v_ordem integer := 0;
  v_ids uuid[] := '{}';
begin
  if p_etapas is null or pg_catalog.jsonb_typeof(p_etapas) <> 'array'
     or pg_catalog.jsonb_array_length(p_etapas) not between 1 and 15 then
    raise exception 'etapas_invalidas' using errcode = 'P0001';
  end if;
  for v_item in select * from pg_catalog.jsonb_array_elements(p_etapas) loop
    if v_item ? 'id' and v_item ->> 'id' is not null then
      if not exists (select 1 from public.rs_etapas where id = (v_item ->> 'id')::uuid and vaga_id = p_vaga) then
        raise exception 'etapas_invalidas' using errcode = 'P0001';
      end if;
      v_ids := v_ids || (v_item ->> 'id')::uuid;
    end if;
  end loop;
  if exists (select 1 from public.rs_candidaturas c join public.rs_etapas e on e.id = c.etapa_id
             where e.vaga_id = p_vaga and not (e.id = any (v_ids))) then
    raise exception 'etapa_com_candidaturas' using errcode = 'P0001';
  end if;
  delete from public.rs_etapas where vaga_id = p_vaga and not (id = any (v_ids));
  -- A ordem é única e adiável (initially deferred): renumerar no meio da transação não colide.
  for v_item in select * from pg_catalog.jsonb_array_elements(p_etapas) loop
    v_ordem := v_ordem + 1;
    if v_item ? 'id' and v_item ->> 'id' is not null then
      update public.rs_etapas set nome = v_item ->> 'nome', tipo = (v_item ->> 'tipo')::public.rs_tipo_etapa, ordem = v_ordem
       where id = (v_item ->> 'id')::uuid;
    else
      insert into public.rs_etapas (vaga_id, nome, tipo, ordem)
      values (p_vaga, v_item ->> 'nome', (v_item ->> 'tipo')::public.rs_tipo_etapa, v_ordem);
    end if;
  end loop;
end $$;

-- Grava as perguntas (11.1): 0–10, substituindo a lista. Depois da primeira publicação, só passa se
-- a lista recebida for igual à atual (o formulário devolve as mesmas, em só leitura); senão,
-- perguntas_congeladas. Recebe: vaga, a lista [{texto, tipo, opcoes?, obrigatoria?, resposta_esperada?}].
create function public.rs_fn_grava_perguntas(p_vaga uuid, p_perguntas jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  v_publicada timestamptz;
  v_atual jsonb;
  v_nova jsonb;
  v_item jsonb;
  v_ordem integer := 0;
begin
  if p_perguntas is null or pg_catalog.jsonb_typeof(p_perguntas) <> 'array'
     or pg_catalog.jsonb_array_length(p_perguntas) > 10 then
    raise exception 'perguntas_invalidas' using errcode = 'P0001';
  end if;
  select publicada_em into v_publicada from public.rs_vagas where id = p_vaga;
  if v_publicada is not null then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('texto', texto, 'tipo', tipo,
             'opcoes', coalesce(pg_catalog.to_jsonb(opcoes), '[]'::jsonb), 'obrigatoria', obrigatoria,
             'resposta_esperada', resposta_esperada) order by ordem), '[]'::jsonb)
      into v_atual from public.rs_perguntas where vaga_id = p_vaga;
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('texto', p ->> 'texto', 'tipo', p ->> 'tipo',
             'opcoes', coalesce(p -> 'opcoes', '[]'::jsonb), 'obrigatoria', coalesce((p ->> 'obrigatoria')::boolean, true),
             'resposta_esperada', p ->> 'resposta_esperada') order by n), '[]'::jsonb)
      into v_nova from pg_catalog.jsonb_array_elements(p_perguntas) with ordinality as x(p, n);
    if v_atual is distinct from v_nova then
      raise exception 'perguntas_congeladas' using errcode = 'P0001';
    end if;
    return;
  end if;
  delete from public.rs_perguntas where vaga_id = p_vaga;
  for v_item in select * from pg_catalog.jsonb_array_elements(p_perguntas) loop
    v_ordem := v_ordem + 1;
    insert into public.rs_perguntas (vaga_id, ordem, texto, tipo, opcoes, obrigatoria, resposta_esperada)
    values (p_vaga, v_ordem, v_item ->> 'texto', (v_item ->> 'tipo')::public.rs_tipo_pergunta,
            case when (v_item ->> 'tipo') = 'escolha_unica'
                 then array(select pg_catalog.jsonb_array_elements_text(v_item -> 'opcoes')) end,
            coalesce((v_item ->> 'obrigatoria')::boolean, true), nullif(v_item ->> 'resposta_esperada', ''));
  end loop;
end $$;

-- Grava a equipe da vaga (7.3): no máximo um responsável, que é recrutador ou administrador ativo;
-- avaliadores são membros ativos; o dono com acesso entra sempre como avaliador (11.31), a não ser
-- que já seja o responsável. Recebe: vaga, empresa, {responsavel?, avaliadores: [membro_id]}.
create function public.rs_fn_grava_equipe(p_vaga uuid, p_empresa uuid, p_equipe jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  v_resp uuid := nullif(p_equipe ->> 'responsavel', '')::uuid;
  v_dono_membro uuid;
  v_av uuid;
begin
  if v_resp is not null and not exists (
    select 1 from public.rs_membros where id = v_resp and empresa_id = p_empresa and removido_em is null
       and usuario_id is not null and papel in ('administrador', 'recrutador')
  ) then
    raise exception 'responsavel_invalido' using errcode = 'P0001';
  end if;
  delete from public.rs_vaga_equipe where vaga_id = p_vaga;
  if v_resp is not null then
    insert into public.rs_vaga_equipe (vaga_id, membro_id, papel_na_vaga) values (p_vaga, v_resp, 'responsavel');
  end if;
  for v_av in select distinct (x)::uuid from pg_catalog.jsonb_array_elements_text(coalesce(p_equipe -> 'avaliadores', '[]')) x loop
    if not exists (select 1 from public.rs_membros where id = v_av and empresa_id = p_empresa
                   and removido_em is null and usuario_id is not null) then
      raise exception 'membro_invalido' using errcode = 'P0001';
    end if;
    insert into public.rs_vaga_equipe (vaga_id, membro_id, papel_na_vaga)
    values (p_vaga, v_av, 'avaliador') on conflict (vaga_id, membro_id) do nothing;
  end loop;
  select p.membro_id into v_dono_membro from public.rs_vagas v join public.rs_pessoas p on p.id = v.dono_pessoa_id
   join public.rs_membros m on m.id = p.membro_id
   where v.id = p_vaga and m.removido_em is null and m.usuario_id is not null;
  if v_dono_membro is not null then
    insert into public.rs_vaga_equipe (vaga_id, membro_id, papel_na_vaga)
    values (p_vaga, v_dono_membro, 'avaliador') on conflict (vaga_id, membro_id) do nothing;
  end if;
end $$;

-- Confere os dados da vaga que dependem do banco: área ativa da empresa e no alcance, dono pessoa
-- ativa da empresa. Recebe: empresa, área, dono, alcance.
create function public.rs_fn_confere_vaga(p_empresa uuid, p_area uuid, p_dono uuid, p_alcance jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  if p_area is not null and not exists (
    select 1 from public.rs_areas where id = p_area and empresa_id = p_empresa and arquivada_em is null
  ) then
    raise exception 'area_invalida' using errcode = 'P0001';
  end if;
  if not public.rs_fn_area_no_alcance(p_area, p_alcance) then
    raise exception 'fora_do_alcance' using errcode = 'P0001';
  end if;
  if p_dono is not null and not exists (
    select 1 from public.rs_pessoas where id = p_dono and empresa_id = p_empresa and arquivada_em is null
  ) then
    raise exception 'pessoa_invalida' using errcode = 'P0001';
  end if;
end $$;

-- ---------------------------------------------------------------- criar e editar
-- Cria a vaga em rascunho (7.5, rs_fn_cria_vaga). Recebe: empresa, dados (campos de rs_vagas mais
-- etapas, perguntas e equipe), alcance, ator e a chave de idempotência (só a API v1 manda).
-- Dono padrão = responsável da área. Devolve {id, criada}; chave repetida devolve a vaga existente.
create function public.rs_fn_cria_vaga(p_empresa uuid, p_dados jsonb, p_alcance jsonb, p_ator jsonb,
                                       p_chave text default null) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_area uuid := nullif(p_dados ->> 'area_id', '')::uuid;
  v_dono uuid := nullif(p_dados ->> 'dono_pessoa_id', '')::uuid;
  v_id uuid;
begin
  if p_chave is not null then
    select id into v_id from public.rs_vagas where empresa_id = p_empresa and chave_idempotencia = p_chave;
    if v_id is not null then
      return pg_catalog.jsonb_build_object('id', v_id, 'criada', false);
    end if;
  end if;
  perform public.rs_fn_confere_vaga(p_empresa, v_area, v_dono, p_alcance);
  if v_dono is null and v_area is not null then
    select responsavel_pessoa_id into v_dono from public.rs_areas where id = v_area;
  end if;
  insert into public.rs_vagas (empresa_id, slug, titulo, descricao, requisitos, area_id, dono_pessoa_id,
    modelo_trabalho, cidade, uf, regime, salario_min, salario_max, salario_periodo, mostrar_salario,
    curriculo_obrigatorio, encerra_em, chave_idempotencia)
  values (p_empresa,
    public.rs_fn_slug_vaga(p_empresa, coalesce(nullif(p_dados ->> 'slug', ''), p_dados ->> 'titulo'), null),
    p_dados ->> 'titulo', coalesce(p_dados ->> 'descricao', ''), nullif(p_dados ->> 'requisitos', ''),
    v_area, v_dono,
    coalesce((p_dados ->> 'modelo_trabalho')::public.rs_modelo_trabalho, 'presencial'),
    nullif(p_dados ->> 'cidade', ''), nullif(p_dados ->> 'uf', ''),
    coalesce((p_dados ->> 'regime')::public.rs_regime, 'clt'),
    (p_dados ->> 'salario_min')::numeric, (p_dados ->> 'salario_max')::numeric, nullif(p_dados ->> 'salario_periodo', ''),
    coalesce((p_dados ->> 'mostrar_salario')::boolean, false), coalesce((p_dados ->> 'curriculo_obrigatorio')::boolean, true),
    (nullif(p_dados ->> 'encerra_em', ''))::date, p_chave)
  returning id into v_id;
  perform public.rs_fn_grava_etapas(v_id, p_dados -> 'etapas');
  perform public.rs_fn_grava_perguntas(v_id, coalesce(p_dados -> 'perguntas', '[]'));
  perform public.rs_fn_grava_equipe(v_id, p_empresa, coalesce(p_dados -> 'equipe', '{}'));
  perform public.rs_fn_registra_evento(p_empresa, v_id, null, 'vaga_criada', p_ator, 'web',
    pg_catalog.jsonb_build_object('vaga_id', v_id));
  return pg_catalog.jsonb_build_object('id', v_id, 'criada', true);
end $$;

-- Edita a vaga (rascunho, publicada ou pausada; encerrada não muda — trigger). Recebe: vaga, empresa,
-- dados completos da vaga (o servidor junta o atual com o que mudou), alcance, ator. etapas,
-- perguntas e equipe só são regravadas se vierem no jsonb. Slug só muda antes da 1ª publicação.
create function public.rs_fn_salva_vaga(p_vaga uuid, p_empresa uuid, p_dados jsonb, p_alcance jsonb, p_ator jsonb)
returns void
language plpgsql set search_path = '' as $$
declare
  v_atual public.rs_vagas;
  v_area uuid := nullif(p_dados ->> 'area_id', '')::uuid;
  v_dono uuid := nullif(p_dados ->> 'dono_pessoa_id', '')::uuid;
  v_slug text;
begin
  select * into v_atual from public.rs_vagas where id = p_vaga and empresa_id = p_empresa for update;
  if v_atual.id is null or not public.rs_fn_vaga_no_alcance(p_vaga, v_atual.area_id, p_alcance) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if v_atual.status = 'encerrada' then
    raise exception 'vaga_encerrada' using errcode = 'P0001';
  end if;
  if v_area is distinct from v_atual.area_id or v_dono is distinct from v_atual.dono_pessoa_id then
    perform public.rs_fn_confere_vaga(p_empresa, v_area, v_dono, p_alcance);
  end if;
  v_slug := v_atual.slug;
  if v_atual.publicada_em is null and nullif(p_dados ->> 'slug', '') is not null and p_dados ->> 'slug' <> v_atual.slug then
    if exists (select 1 from public.rs_vagas where empresa_id = p_empresa and slug = p_dados ->> 'slug' and id <> p_vaga) then
      raise exception 'slug_vaga_em_uso' using errcode = 'P0001';
    end if;
    v_slug := p_dados ->> 'slug';
  end if;
  update public.rs_vagas set
    slug = v_slug, titulo = p_dados ->> 'titulo', descricao = coalesce(p_dados ->> 'descricao', ''),
    requisitos = nullif(p_dados ->> 'requisitos', ''), area_id = v_area, dono_pessoa_id = v_dono,
    modelo_trabalho = coalesce((p_dados ->> 'modelo_trabalho')::public.rs_modelo_trabalho, 'presencial'),
    cidade = nullif(p_dados ->> 'cidade', ''), uf = nullif(p_dados ->> 'uf', ''),
    regime = coalesce((p_dados ->> 'regime')::public.rs_regime, 'clt'),
    salario_min = (p_dados ->> 'salario_min')::numeric, salario_max = (p_dados ->> 'salario_max')::numeric,
    salario_periodo = nullif(p_dados ->> 'salario_periodo', ''),
    mostrar_salario = coalesce((p_dados ->> 'mostrar_salario')::boolean, false),
    curriculo_obrigatorio = coalesce((p_dados ->> 'curriculo_obrigatorio')::boolean, true),
    encerra_em = (nullif(p_dados ->> 'encerra_em', ''))::date
   where id = p_vaga;
  if p_dados ? 'etapas' then
    perform public.rs_fn_grava_etapas(p_vaga, p_dados -> 'etapas');
  end if;
  if p_dados ? 'perguntas' then
    perform public.rs_fn_grava_perguntas(p_vaga, p_dados -> 'perguntas');
  end if;
  if p_dados ? 'equipe' then
    perform public.rs_fn_grava_equipe(p_vaga, p_empresa, p_dados -> 'equipe');
  elsif v_dono is distinct from v_atual.dono_pessoa_id then
    -- Dono novo com acesso entra na equipe como avaliador mesmo sem a equipe no pedido (11.31).
    insert into public.rs_vaga_equipe (vaga_id, membro_id, papel_na_vaga)
    select p_vaga, p.membro_id, 'avaliador' from public.rs_pessoas p join public.rs_membros m on m.id = p.membro_id
     where p.id = v_dono and m.removido_em is null and m.usuario_id is not null
    on conflict (vaga_id, membro_id) do nothing;
  end if;
  perform public.rs_fn_registra_evento(p_empresa, p_vaga, null, 'vaga_editada', p_ator, 'web',
    pg_catalog.jsonb_build_object('vaga_id', p_vaga));
  if v_dono is distinct from v_atual.dono_pessoa_id then
    perform public.rs_fn_registra_evento(p_empresa, p_vaga, null, 'vaga_dono_alterado', p_ator, 'web',
      pg_catalog.jsonb_build_object('vaga_id', p_vaga, 'de', v_atual.dono_pessoa_id, 'para', v_dono));
  end if;
end $$;

-- ---------------------------------------------------------------- máquina 12.1
-- Muda o status da vaga (rs_fn_transicao_vaga). Recebe: vaga, empresa, status de destino, motivo
-- (só para encerrar), alcance, ator e o limite de vagas publicadas (11.14, limits.ts).
-- Publicar confere de novo a 11.1 (descrição 50+, etapa, data-limite ≥ hoje em São Paulo).
-- Encerrar com candidatura ativa é decisão (11.7, épico 8.6): aqui é recusado (vaga_com_ativas).
create function public.rs_fn_transicao_vaga(p_vaga uuid, p_empresa uuid, p_para public.rs_status_vaga,
  p_motivo public.rs_motivo_encerramento_vaga, p_alcance jsonb, p_ator jsonb, p_max_publicadas integer)
returns void
language plpgsql set search_path = '' as $$
declare
  v public.rs_vagas;
  v_hoje date := (pg_catalog.now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into v from public.rs_vagas where id = p_vaga and empresa_id = p_empresa for update;
  if v.id is null or not public.rs_fn_vaga_no_alcance(p_vaga, v.area_id, p_alcance) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if not (
    (v.status = 'rascunho' and p_para in ('publicada', 'encerrada'))
    or (v.status = 'publicada' and p_para in ('pausada', 'encerrada'))
    or (v.status = 'pausada' and p_para in ('publicada', 'encerrada'))
  ) then
    raise exception 'transicao_vaga_proibida' using errcode = 'P0001';
  end if;
  if p_para = 'publicada' then
    if pg_catalog.char_length(v.descricao) < 50
       or not exists (select 1 from public.rs_etapas where vaga_id = p_vaga)
       or (v.modelo_trabalho <> 'remoto' and (v.cidade is null or v.uf is null)) then
      raise exception 'vaga_incompleta' using errcode = 'P0001';
    end if;
    if v.encerra_em is not null and v.encerra_em < v_hoje then
      raise exception 'encerra_em_passada' using errcode = 'P0001';
    end if;
    if (select count(*) from public.rs_vagas where empresa_id = p_empresa and status = 'publicada') >= p_max_publicadas then
      raise exception 'limite_publicadas' using errcode = 'P0001';
    end if;
    update public.rs_vagas set status = 'publicada', publicada_em = coalesce(publicada_em, pg_catalog.now()) where id = p_vaga;
    perform public.rs_fn_registra_evento(p_empresa, p_vaga, null, 'vaga_publicada', p_ator, 'web',
      pg_catalog.jsonb_build_object('vaga_id', p_vaga, 'republicada', v.publicada_em is not null));
  elsif p_para = 'pausada' then
    update public.rs_vagas set status = 'pausada' where id = p_vaga;
    perform public.rs_fn_registra_evento(p_empresa, p_vaga, null, 'vaga_pausada', p_ator, 'web',
      pg_catalog.jsonb_build_object('vaga_id', p_vaga));
  else
    if p_motivo is null then
      raise exception 'motivo_obrigatorio' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.rs_candidaturas where vaga_id = p_vaga and situacao = 'ativa') then
      raise exception 'vaga_com_ativas' using errcode = 'P0001';
    end if;
    update public.rs_vagas set status = 'encerrada', encerrada_em = pg_catalog.now(), motivo_encerramento = p_motivo
     where id = p_vaga;
    perform public.rs_fn_registra_evento(p_empresa, p_vaga, null, 'vaga_encerrada', p_ator, 'web',
      pg_catalog.jsonb_build_object('vaga_id', p_vaga, 'motivo', p_motivo));
  end if;
end $$;

-- ---------------------------------------------------------------- faxina (11.11)
-- Pausa (não encerra) vagas publicadas com encerra_em < hoje em São Paulo, em lotes, pulando as
-- travadas por outra transação. Evento vaga_pausada_prazo, ator sistema, origem cron. O aviso ao
-- responsável sai no resumo diário (8.10). Recebe: tamanho do lote. Devolve: quantas pausou.
create function public.rs_fn_faxina_vagas_vencidas(p_lote integer) returns integer
language plpgsql set search_path = '' as $$
declare
  v record;
  v_n integer := 0;
begin
  for v in
    select id, empresa_id from public.rs_vagas
     where status = 'publicada' and encerra_em < (pg_catalog.now() at time zone 'America/Sao_Paulo')::date
     order by encerra_em limit p_lote
     for update skip locked
  loop
    update public.rs_vagas set status = 'pausada' where id = v.id;
    perform public.rs_fn_registra_evento(v.empresa_id, v.id, null, 'vaga_pausada_prazo',
      pg_catalog.jsonb_build_object('tipo', 'sistema'), 'cron', pg_catalog.jsonb_build_object('vaga_id', v.id));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ---------------------------------------------------------------- privilégios (6.5, 20.3)
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'rs\_%' loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
