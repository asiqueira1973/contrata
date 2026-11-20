-- Contrata — lógica no banco do épico 8.1 (spec.md v0.3, seção 7.5).
-- Triggers que guardam invariantes (trilha, situação da candidatura, etapa da vaga, congelamento)
-- e as funções da administração da empresa. As funções de vagas, candidaturas, decisões, mensagens,
-- retenção e faxina entram nas migrations dos épicos 8.3 a 8.10 (plans/8.1-fundacao.md).
-- Convenções: plpgsql, SECURITY INVOKER, search_path = '', EXECUTE só para service_role.
-- Erros de regra: raise exception com errcode P0001 e mensagem = código snake_case (o servidor
-- traduz para a copy). Nenhum evento grava dado pessoal (11.6): só ids, papéis e contagens.
-- E-mails são citext, mas com search_path = '' o "=" cai no operador de text (diferencia
-- maiúsculas). Toda comparação de e-mail usa operator(extensions.=) explicitamente.

-- ---------------------------------------------------------------- utilidades
-- Atualiza atualizado_em em toda linha alterada (7.5, rs_tg_atualizado_em).
create function public.rs_tg_atualizado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := pg_catalog.now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['rs_empresas', 'rs_areas', 'rs_pessoas', 'rs_vagas', 'rs_candidatos', 'rs_avaliacoes', 'rs_modelos_mensagem'] loop
    execute format('create trigger rs_tg_atualizado_em before update on public.%I for each row execute function public.rs_tg_atualizado_em()', t);
  end loop;
end $$;

-- Única porta de escrita em rs_eventos (regra 11.6). Recebe a empresa, a vaga e a candidatura
-- (opcionais), o tipo (validado pelo check do catálogo 15.3), o ator como jsonb
-- {tipo, membro_id?, credencial_id?, autorizado_por_membro_id?}, a origem e os dados sem dado
-- pessoal. Devolve o id do evento.
create function public.rs_fn_registra_evento(
  p_empresa uuid, p_vaga uuid, p_candidatura uuid, p_tipo text,
  p_ator jsonb, p_origem public.rs_origem_evento, p_dados jsonb default '{}'
) returns bigint
language plpgsql set search_path = '' as $$
declare v_id bigint;
begin
  if p_ator is null or p_ator ->> 'tipo' is null then
    raise exception 'ator_obrigatorio' using errcode = 'P0001';
  end if;
  insert into public.rs_eventos (empresa_id, vaga_id, candidatura_id, tipo, ator_tipo, membro_id,
                                 credencial_id, autorizado_por_membro_id, origem, dados)
  values (p_empresa, p_vaga, p_candidatura, p_tipo, (p_ator ->> 'tipo')::public.rs_tipo_ator,
          (p_ator ->> 'membro_id')::uuid, (p_ator ->> 'credencial_id')::uuid,
          (p_ator ->> 'autorizado_por_membro_id')::uuid, p_origem, coalesce(p_dados, '{}'))
  returning id into v_id;
  return v_id;
end $$;

-- rs_eventos não muda nem se apaga (11.6). Única exceção: o delete em cascata do expurgo de uma
-- empresa excluída (7.4), liberado pela variável de sessão rs.expurgo_empresa = id da empresa.
create function public.rs_tg_eventos_imutaveis() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and pg_catalog.current_setting('rs.expurgo_empresa', true) = old.empresa_id::text then
    return old;
  end if;
  raise exception 'trilha_imutavel' using errcode = 'P0001';
end $$;
create trigger rs_tg_eventos_imutaveis before update or delete on public.rs_eventos
  for each row execute function public.rs_tg_eventos_imutaveis();

-- Expurgo de empresa excluída (7.4): apaga a empresa e tudo dela em cascata, só 7 dias depois de
-- excluida_em. Libera a trilha só para esta empresa e só nesta transação (rs.expurgo_empresa).
-- Os arquivos no R2 são apagados antes pelo servidor, por prefixo (épico 8.10).
create function public.rs_fn_expurga_empresa(p_empresa uuid) returns void
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.rs_empresas where id = p_empresa
                 and excluida_em <= pg_catalog.now() - interval '7 days') then
    raise exception 'empresa_nao_expurgavel' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('rs.expurgo_empresa', p_empresa::text, true);
  delete from public.rs_empresas where id = p_empresa;
  perform pg_catalog.set_config('rs.expurgo_empresa', '', true);
end $$;

-- ---------------------------------------------------------------- invariantes de candidatura e vaga
-- Máquina de estado 12.2: candidatura nasce ativa; situacao só muda com rs.transicao = 'on'
-- (setada pelas funções de encerrar e reabrir, épicos 8.4 e 8.6) e só pelas transições da tabela.
create function public.rs_tg_situacao_candidatura() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.situacao <> 'ativa' then
      raise exception 'candidatura_nasce_ativa' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.situacao is distinct from old.situacao then
    if coalesce(pg_catalog.current_setting('rs.transicao', true), '') <> 'on' then
      raise exception 'situacao_so_por_funcao' using errcode = 'P0001';
    end if;
    if not (
      (old.situacao = 'ativa' and new.situacao in ('reprovada', 'desistiu', 'contratada', 'encerrada_vaga'))
      or (old.situacao in ('reprovada', 'desistiu', 'contratada') and new.situacao = 'ativa')
    ) then
      raise exception 'transicao_proibida' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger rs_tg_situacao_candidatura before insert or update on public.rs_candidaturas
  for each row execute function public.rs_tg_situacao_candidatura();

-- A etapa atual pertence à mesma vaga; empresa da candidatura = da vaga = do candidato (11.27).
create function public.rs_tg_etapa_da_vaga() returns trigger
language plpgsql set search_path = '' as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from public.rs_vagas where id = new.vaga_id;
  if v_empresa is distinct from new.empresa_id then
    raise exception 'empresa_diferente_da_vaga' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.rs_candidatos where id = new.candidato_id and empresa_id = new.empresa_id) then
    raise exception 'candidato_de_outra_empresa' using errcode = 'P0001';
  end if;
  if new.etapa_id is not null and not exists (
    select 1 from public.rs_etapas where id = new.etapa_id and vaga_id = new.vaga_id
  ) then
    raise exception 'etapa_de_outra_vaga' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger rs_tg_etapa_da_vaga before insert or update of etapa_id, vaga_id, empresa_id, candidato_id
  on public.rs_candidaturas for each row execute function public.rs_tg_etapa_da_vaga();

-- Congelamento (11.1, 7.4): vaga encerrada não muda; vaga só se apaga em rascunho; perguntas não
-- mudam depois da primeira publicação. O expurgo da empresa (rs.expurgo_empresa) passa.
create function public.rs_tg_vaga_congelada() returns trigger
language plpgsql set search_path = '' as $$
declare v_vaga public.rs_vagas;
begin
  if tg_table_name = 'rs_vagas' then
    if pg_catalog.current_setting('rs.expurgo_empresa', true) = old.empresa_id::text then
      return case when tg_op = 'DELETE' then old else new end;
    end if;
    if tg_op = 'DELETE' then
      if old.status <> 'rascunho' then
        raise exception 'vaga_so_apaga_rascunho' using errcode = 'P0001';
      end if;
      return old;
    end if;
    if old.status = 'encerrada' then
      raise exception 'vaga_encerrada' using errcode = 'P0001';
    end if;
    return new;
  end if;
  -- rs_perguntas
  select * into v_vaga from public.rs_vagas where id = coalesce(new.vaga_id, old.vaga_id);
  if not found then
    return case when tg_op = 'DELETE' then old else new end; -- vaga em rascunho sendo apagada
  end if;
  if pg_catalog.current_setting('rs.expurgo_empresa', true) = v_vaga.empresa_id::text then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if v_vaga.publicada_em is not null then
    raise exception 'perguntas_congeladas' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger rs_tg_vaga_congelada before update or delete on public.rs_vagas
  for each row execute function public.rs_tg_vaga_congelada();
create trigger rs_tg_vaga_congelada before insert or update or delete on public.rs_perguntas
  for each row execute function public.rs_tg_vaga_congelada();

-- ---------------------------------------------------------------- membros e convites
-- Confere as áreas de um recrutador limitado (11.32): pelo menos uma, todas ativas e da empresa.
-- Recebe: empresa, papel, todas_areas, ids das áreas. Devolve: nada; levanta erro se inválido.
create function public.rs_fn_valida_areas(p_empresa uuid, p_papel public.rs_papel_membro, p_todas boolean, p_areas uuid[])
returns void
language plpgsql set search_path = '' as $$
begin
  if p_papel <> 'recrutador' or p_todas then
    if coalesce(pg_catalog.cardinality(p_areas), 0) > 0 then
      raise exception 'areas_so_para_recrutador_limitado' using errcode = 'P0001';
    end if;
    return;
  end if;
  if coalesce(pg_catalog.cardinality(p_areas), 0) = 0 then
    raise exception 'recrutador_sem_area' using errcode = 'P0001';
  end if;
  if (select count(*) from public.rs_areas
      where id = any (p_areas) and empresa_id = p_empresa and arquivada_em is null)
     <> (select count(distinct a) from pg_catalog.unnest(p_areas) a) then
    raise exception 'area_invalida' using errcode = 'P0001';
  end if;
end $$;

-- Liga um convite pendente ao usuário que entrou (11.24) e liga (ou cria) a pessoa de mesmo
-- e-mail no cadastro (7.3). Recebe: membro (convite) e usuário. Devolve: true se aceitou.
-- Recusa e-mail diferente e convite vencido; ignora (false) se o usuário já é membro ativo da empresa.
create function public.rs_fn_aceita_convite(p_membro uuid, p_usuario uuid) returns boolean
language plpgsql set search_path = '' as $$
declare
  v_m public.rs_membros;
  v_u public.rs_usuarios;
  v_pessoa uuid;
begin
  select * into v_m from public.rs_membros where id = p_membro for update;
  select * into v_u from public.rs_usuarios where id = p_usuario;
  if v_m.id is null or v_m.removido_em is not null or v_m.usuario_id is not null then
    raise exception 'convite_invalido' using errcode = 'P0001';
  end if;
  if v_m.email operator(extensions.<>) v_u.email then
    raise exception 'convite_outro_email' using errcode = 'P0001';
  end if;
  if v_m.convite_expira_em <= pg_catalog.now() then
    raise exception 'convite_vencido' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_membros where empresa_id = v_m.empresa_id and usuario_id = p_usuario
             and removido_em is null) then
    return false;
  end if;
  update public.rs_membros
     set usuario_id = p_usuario, aceito_em = pg_catalog.now(), convite_token_hash = null, convite_expira_em = null
   where id = p_membro;
  select id into v_pessoa from public.rs_pessoas
   where empresa_id = v_m.empresa_id and email operator(extensions.=) v_m.email and arquivada_em is null for update;
  if v_pessoa is null then
    insert into public.rs_pessoas (empresa_id, nome, email, membro_id)
    values (v_m.empresa_id, v_u.nome, v_m.email, p_membro);
  else
    update public.rs_pessoas set membro_id = p_membro where id = v_pessoa;
  end if;
  perform public.rs_fn_registra_evento(v_m.empresa_id, null, null, 'membro_entrou',
    pg_catalog.jsonb_build_object('tipo', 'membro', 'membro_id', p_membro), 'painel',
    pg_catalog.jsonb_build_object('membro_id', p_membro, 'papel', v_m.papel));
  return true;
end $$;

-- Login (6.1): cria ou atualiza o usuário pelo google_sub, aceita os convites pendentes do e-mail
-- (11.24) e devolve {usuario_id, novo, empresas: [slug]}. Recusa usuário suspenso e e-mail que já
-- pertence a outro usuário (o servidor mostra a copy "E-mail já em uso").
create function public.rs_fn_entra_usuario(p_google_sub text, p_email text, p_nome text, p_foto text)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_u public.rs_usuarios;
  v_novo boolean := false;
  v_convite record;
begin
  select * into v_u from public.rs_usuarios where google_sub = p_google_sub for update;
  if v_u.id is not null and v_u.suspenso_em is not null then
    raise exception 'usuario_suspenso' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_usuarios where email operator(extensions.=) p_email::extensions.citext
             and google_sub <> p_google_sub) then
    raise exception 'email_em_uso' using errcode = 'P0001';
  end if;
  if v_u.id is null then
    insert into public.rs_usuarios (email, nome, google_sub, foto_url, ultimo_acesso_em)
    values (p_email, p_nome, p_google_sub, p_foto, pg_catalog.now())
    returning * into v_u;
    v_novo := true;
  else
    update public.rs_usuarios
       set email = p_email, nome = p_nome, foto_url = p_foto, ultimo_acesso_em = pg_catalog.now()
     where id = v_u.id
    returning * into v_u;
  end if;
  for v_convite in
    select m.id from public.rs_membros m join public.rs_empresas e on e.id = m.empresa_id
     where m.email operator(extensions.=) v_u.email and m.usuario_id is null and m.removido_em is null
       and m.convite_expira_em > pg_catalog.now() and e.excluida_em is null
  loop
    perform public.rs_fn_aceita_convite(v_convite.id, v_u.id);
  end loop;
  return pg_catalog.jsonb_build_object(
    'usuario_id', v_u.id,
    'novo', v_novo,
    'empresas', coalesce((
      select pg_catalog.jsonb_agg(e.slug order by e.nome)
        from public.rs_membros m join public.rs_empresas e on e.id = m.empresa_id
       where m.usuario_id = v_u.id and m.removido_em is null and e.excluida_em is null
    ), '[]'::jsonb));
end $$;

-- Cria a empresa com quem criou como administrador e no cadastro de pessoas (11.33: quem pode
-- criar é conferido no servidor antes, pela lista CRIACAO_EMPRESA_EMAILS). Recebe: usuário, slug,
-- nome, e-mail de contato. Devolve: id da empresa. Slug repetido → slug_em_uso.
create function public.rs_fn_cria_empresa(p_usuario uuid, p_slug text, p_nome text, p_email_contato text)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_u public.rs_usuarios;
  v_empresa uuid;
  v_membro uuid;
begin
  select * into v_u from public.rs_usuarios where id = p_usuario and suspenso_em is null;
  if v_u.id is null then
    raise exception 'usuario_invalido' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_empresas where slug = p_slug) then
    raise exception 'slug_em_uso' using errcode = 'P0001';
  end if;
  insert into public.rs_empresas (slug, nome, email_contato, criada_por_usuario_id)
  values (p_slug, p_nome, p_email_contato, p_usuario) returning id into v_empresa;
  insert into public.rs_membros (empresa_id, usuario_id, email, papel, aceito_em)
  values (v_empresa, p_usuario, v_u.email, 'administrador', pg_catalog.now()) returning id into v_membro;
  insert into public.rs_pessoas (empresa_id, nome, email, membro_id) values (v_empresa, v_u.nome, v_u.email, v_membro);
  perform public.rs_fn_registra_evento(v_empresa, null, null, 'empresa_criada',
    pg_catalog.jsonb_build_object('tipo', 'membro', 'membro_id', v_membro), 'painel', '{}');
  return v_empresa;
end $$;

-- Convida um membro (11.24): token (o servidor gera e passa só o hash), prazo e limite de
-- convites pendentes vêm de limits.ts. Áreas só para recrutador limitado (11.32). Se já há pessoa
-- com o e-mail, ela é ligada ao aceitar. Devolve: id do membro (convite).
create function public.rs_fn_convida_membro(
  p_empresa uuid, p_email text, p_papel public.rs_papel_membro, p_todas_areas boolean, p_areas uuid[],
  p_token_hash text, p_expira_em timestamptz, p_max_pendentes integer, p_ator jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare v_membro uuid;
begin
  perform public.rs_fn_valida_areas(p_empresa, p_papel, p_todas_areas, p_areas);
  if (select count(*) from public.rs_membros where empresa_id = p_empresa and usuario_id is null
      and removido_em is null and convite_expira_em > pg_catalog.now()) >= p_max_pendentes then
    raise exception 'limite_convites' using errcode = 'P0001';
  end if;
  -- Convite vencido e não aceito do mesmo e-mail sai do caminho (pode ser convidado de novo).
  update public.rs_membros set removido_em = pg_catalog.now()
   where empresa_id = p_empresa and email operator(extensions.=) p_email::extensions.citext and usuario_id is null
     and removido_em is null and convite_expira_em <= pg_catalog.now();
  if exists (select 1 from public.rs_membros where empresa_id = p_empresa
             and email operator(extensions.=) p_email::extensions.citext and removido_em is null) then
    raise exception 'membro_ja_existe' using errcode = 'P0001';
  end if;
  insert into public.rs_membros (empresa_id, email, papel, todas_areas, convite_token_hash, convite_expira_em,
                                 convidado_por_membro_id)
  values (p_empresa, p_email, p_papel, p_papel <> 'recrutador' or p_todas_areas, p_token_hash, p_expira_em,
          (p_ator ->> 'membro_id')::uuid)
  returning id into v_membro;
  insert into public.rs_membro_areas (membro_id, area_id)
  select v_membro, a from pg_catalog.unnest(coalesce(p_areas, '{}')) a;
  perform public.rs_fn_registra_evento(p_empresa, null, null, 'membro_convidado', p_ator, 'painel',
    pg_catalog.jsonb_build_object('membro_id', v_membro, 'papel', p_papel,
      'areas', coalesce(pg_catalog.cardinality(p_areas), 0)));
  return v_membro;
end $$;

-- Reenvia um convite pendente (11.24): token novo invalida o anterior; prazo recomeça.
create function public.rs_fn_reenvia_convite(p_membro uuid, p_token_hash text, p_expira_em timestamptz, p_ator jsonb)
returns void
language plpgsql set search_path = '' as $$
declare v_m public.rs_membros;
begin
  update public.rs_membros set convite_token_hash = p_token_hash, convite_expira_em = p_expira_em
   where id = p_membro and usuario_id is null and removido_em is null
  returning * into v_m;
  if v_m.id is null then
    raise exception 'convite_invalido' using errcode = 'P0001';
  end if;
  perform public.rs_fn_registra_evento(v_m.empresa_id, null, null, 'membro_convidado', p_ator, 'painel',
    pg_catalog.jsonb_build_object('membro_id', p_membro, 'papel', v_m.papel, 'reenvio', true));
end $$;

-- Cancela um convite pendente (soft delete, 7.4).
create function public.rs_fn_cancela_convite(p_membro uuid, p_ator jsonb) returns void
language plpgsql set search_path = '' as $$
declare v_m public.rs_membros;
begin
  update public.rs_membros set removido_em = pg_catalog.now(), convite_token_hash = null
   where id = p_membro and usuario_id is null and removido_em is null
  returning * into v_m;
  if v_m.id is null then
    raise exception 'convite_invalido' using errcode = 'P0001';
  end if;
  perform public.rs_fn_registra_evento(v_m.empresa_id, null, null, 'convite_cancelado', p_ator, 'painel',
    pg_catalog.jsonb_build_object('membro_id', p_membro));
end $$;

-- Recusa deixar a empresa sem administrador com convite aceito (11.26). Recebe o membro que vai
-- deixar de ser administrador ativo.
create function public.rs_fn_garante_administrador(p_membro uuid) returns void
language plpgsql set search_path = '' as $$
declare v_m public.rs_membros;
begin
  select * into v_m from public.rs_membros where id = p_membro;
  if v_m.papel = 'administrador' and v_m.aceito_em is not null and v_m.removido_em is null
     and not exists (select 1 from public.rs_membros where empresa_id = v_m.empresa_id and id <> p_membro
                     and papel = 'administrador' and aceito_em is not null and removido_em is null) then
    raise exception 'ultimo_administrador' using errcode = 'P0001';
  end if;
end $$;

-- Muda papel e áreas (11.32) e revoga os tokens MCP do membro na mesma transação (6.3).
create function public.rs_fn_muda_acesso(
  p_membro uuid, p_papel public.rs_papel_membro, p_todas_areas boolean, p_areas uuid[], p_ator jsonb
) returns void
language plpgsql set search_path = '' as $$
declare v_m public.rs_membros;
begin
  select * into v_m from public.rs_membros where id = p_membro and removido_em is null for update;
  if v_m.id is null then
    raise exception 'membro_invalido' using errcode = 'P0001';
  end if;
  if p_papel <> 'administrador' then
    perform public.rs_fn_garante_administrador(p_membro);
  end if;
  perform public.rs_fn_valida_areas(v_m.empresa_id, p_papel, p_todas_areas, p_areas);
  update public.rs_membros set papel = p_papel, todas_areas = (p_papel <> 'recrutador' or p_todas_areas)
   where id = p_membro;
  delete from public.rs_membro_areas where membro_id = p_membro;
  insert into public.rs_membro_areas (membro_id, area_id)
  select p_membro, a from pg_catalog.unnest(coalesce(p_areas, '{}')) a;
  update public.rs_credenciais set revogada_em = pg_catalog.now()
   where membro_id = p_membro and tipo = 'mcp' and revogada_em is null;
  perform public.rs_fn_registra_evento(v_m.empresa_id, null, null, 'membro_acesso_alterado', p_ator, 'painel',
    pg_catalog.jsonb_build_object('membro_id', p_membro, 'de', v_m.papel, 'para', p_papel,
      'areas', coalesce(pg_catalog.cardinality(p_areas), 0)));
end $$;

-- Remove um membro (7.4): soft delete, revoga os tokens MCP, desliga a pessoa (que continua no
-- cadastro, sem acesso). Recusa o último administrador (11.26).
create function public.rs_fn_remove_membro(p_membro uuid, p_ator jsonb) returns void
language plpgsql set search_path = '' as $$
declare v_m public.rs_membros;
begin
  select * into v_m from public.rs_membros where id = p_membro and removido_em is null
     and usuario_id is not null for update;
  if v_m.id is null then
    raise exception 'membro_invalido' using errcode = 'P0001';
  end if;
  perform public.rs_fn_garante_administrador(p_membro);
  update public.rs_membros set removido_em = pg_catalog.now() where id = p_membro;
  update public.rs_credenciais set revogada_em = pg_catalog.now()
   where membro_id = p_membro and tipo = 'mcp' and revogada_em is null;
  update public.rs_pessoas set membro_id = null where membro_id = p_membro;
  perform public.rs_fn_registra_evento(v_m.empresa_id, null, null, 'membro_removido', p_ator, 'painel',
    pg_catalog.jsonb_build_object('membro_id', p_membro));
end $$;

-- ---------------------------------------------------------------- áreas
-- Cria (p_id nulo) ou edita uma área. Responsável precisa ser pessoa ativa da empresa.
-- Nome repetido entre as ativas → area_nome_em_uso. Devolve: id da área.
create function public.rs_fn_salva_area(p_empresa uuid, p_id uuid, p_nome text, p_responsavel uuid, p_ator jsonb)
returns uuid
language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  if p_responsavel is not null and not exists (
    select 1 from public.rs_pessoas where id = p_responsavel and empresa_id = p_empresa and arquivada_em is null
  ) then
    raise exception 'pessoa_invalida' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_areas where empresa_id = p_empresa and arquivada_em is null
             and pg_catalog.lower(nome) = pg_catalog.lower(p_nome) and id is distinct from p_id) then
    raise exception 'area_nome_em_uso' using errcode = 'P0001';
  end if;
  if p_id is null then
    insert into public.rs_areas (empresa_id, nome, responsavel_pessoa_id)
    values (p_empresa, p_nome, p_responsavel) returning id into v_id;
    perform public.rs_fn_registra_evento(p_empresa, null, null, 'area_criada', p_ator, 'painel',
      pg_catalog.jsonb_build_object('area_id', v_id));
  else
    update public.rs_areas set nome = p_nome, responsavel_pessoa_id = p_responsavel
     where id = p_id and empresa_id = p_empresa and arquivada_em is null returning id into v_id;
    if v_id is null then
      raise exception 'area_invalida' using errcode = 'P0001';
    end if;
    perform public.rs_fn_registra_evento(p_empresa, null, null, 'area_editada', p_ator, 'painel',
      pg_catalog.jsonb_build_object('area_id', v_id));
  end if;
  return v_id;
end $$;

-- Arquiva uma área (7.4): recusa se houver vaga publicada ou pausada nela, ou se for a única área
-- ativa de algum recrutador limitado (11.32). Os dois casos dão o mesmo código (copy única, 15.2).
create function public.rs_fn_arquiva_area(p_area uuid, p_empresa uuid, p_ator jsonb) returns void
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.rs_areas where id = p_area and empresa_id = p_empresa and arquivada_em is null) then
    raise exception 'area_invalida' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_vagas where area_id = p_area and status in ('publicada', 'pausada'))
     or exists (
       select 1 from public.rs_membro_areas ma join public.rs_membros m on m.id = ma.membro_id
        where ma.area_id = p_area and m.removido_em is null and m.papel = 'recrutador' and not m.todas_areas
          and not exists (select 1 from public.rs_membro_areas o join public.rs_areas a on a.id = o.area_id
                           where o.membro_id = m.id and o.area_id <> p_area and a.arquivada_em is null)
     ) then
    raise exception 'area_em_uso' using errcode = 'P0001';
  end if;
  update public.rs_areas set arquivada_em = pg_catalog.now() where id = p_area;
  perform public.rs_fn_registra_evento(p_empresa, null, null, 'area_arquivada', p_ator, 'painel',
    pg_catalog.jsonb_build_object('area_id', p_area));
end $$;

-- ---------------------------------------------------------------- pessoas
-- Cria (p_id nulo) ou edita uma pessoa do cadastro (7.3). Área precisa ser ativa da empresa.
-- E-mail de pessoa com acesso não muda (é a identidade do membro). Devolve: id da pessoa.
create function public.rs_fn_salva_pessoa(
  p_empresa uuid, p_id uuid, p_nome text, p_email text, p_cargo text, p_area uuid,
  p_recebe_resumo boolean, p_ator jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_atual public.rs_pessoas;
  v_id uuid;
begin
  if p_area is not null and not exists (
    select 1 from public.rs_areas where id = p_area and empresa_id = p_empresa and arquivada_em is null
  ) then
    raise exception 'area_invalida' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_pessoas where empresa_id = p_empresa and arquivada_em is null
             and email operator(extensions.=) p_email::extensions.citext and id is distinct from p_id) then
    raise exception 'pessoa_email_em_uso' using errcode = 'P0001';
  end if;
  if p_id is null then
    insert into public.rs_pessoas (empresa_id, nome, email, cargo, area_id, recebe_resumo)
    values (p_empresa, p_nome, p_email, p_cargo, p_area, coalesce(p_recebe_resumo, true)) returning id into v_id;
    perform public.rs_fn_registra_evento(p_empresa, null, null, 'pessoa_cadastrada', p_ator, 'painel',
      pg_catalog.jsonb_build_object('pessoa_id', v_id));
  else
    select * into v_atual from public.rs_pessoas where id = p_id and empresa_id = p_empresa and arquivada_em is null;
    if v_atual.id is null then
      raise exception 'pessoa_invalida' using errcode = 'P0001';
    end if;
    if v_atual.membro_id is not null and v_atual.email operator(extensions.<>) p_email::extensions.citext then
      raise exception 'pessoa_com_acesso_email' using errcode = 'P0001';
    end if;
    update public.rs_pessoas set nome = p_nome, email = p_email, cargo = p_cargo, area_id = p_area,
           recebe_resumo = coalesce(p_recebe_resumo, recebe_resumo)
     where id = p_id returning id into v_id;
    perform public.rs_fn_registra_evento(p_empresa, null, null, 'pessoa_editada', p_ator, 'painel',
      pg_catalog.jsonb_build_object('pessoa_id', v_id));
  end if;
  return v_id;
end $$;

-- Arquiva uma pessoa (7.4): só se não for membro ativo nem dona de vaga não encerrada. Se for
-- responsável de alguma área, a área fica sem responsável (divergência registrada no plano 8.1).
create function public.rs_fn_arquiva_pessoa(p_pessoa uuid, p_empresa uuid, p_ator jsonb) returns void
language plpgsql set search_path = '' as $$
declare v_p public.rs_pessoas;
begin
  select * into v_p from public.rs_pessoas where id = p_pessoa and empresa_id = p_empresa and arquivada_em is null for update;
  if v_p.id is null then
    raise exception 'pessoa_invalida' using errcode = 'P0001';
  end if;
  if v_p.membro_id is not null then
    raise exception 'pessoa_com_acesso' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_vagas where dono_pessoa_id = p_pessoa and status in ('rascunho', 'publicada', 'pausada')) then
    raise exception 'pessoa_dona_de_vaga' using errcode = 'P0001';
  end if;
  update public.rs_areas set responsavel_pessoa_id = null where responsavel_pessoa_id = p_pessoa;
  update public.rs_pessoas set arquivada_em = pg_catalog.now() where id = p_pessoa;
  perform public.rs_fn_registra_evento(p_empresa, null, null, 'pessoa_arquivada', p_ator, 'painel',
    pg_catalog.jsonb_build_object('pessoa_id', p_pessoa));
end $$;

-- "Dar acesso" a uma pessoa sem acesso (7.5): vira convite para o e-mail dela. Devolve o membro.
create function public.rs_fn_da_acesso(
  p_pessoa uuid, p_empresa uuid, p_papel public.rs_papel_membro, p_todas_areas boolean, p_areas uuid[],
  p_token_hash text, p_expira_em timestamptz, p_max_pendentes integer, p_ator jsonb
) returns uuid
language plpgsql set search_path = '' as $$
declare v_p public.rs_pessoas;
begin
  select * into v_p from public.rs_pessoas where id = p_pessoa and empresa_id = p_empresa and arquivada_em is null;
  if v_p.id is null then
    raise exception 'pessoa_invalida' using errcode = 'P0001';
  end if;
  if v_p.membro_id is not null then
    raise exception 'pessoa_com_acesso' using errcode = 'P0001';
  end if;
  return public.rs_fn_convida_membro(p_empresa, v_p.email::text, p_papel, p_todas_areas, p_areas,
                                     p_token_hash, p_expira_em, p_max_pendentes, p_ator);
end $$;

-- ---------------------------------------------------------------- privilégios (6.5, 20.3)
-- Nenhuma função rs_ executável por public, anon ou authenticated; só a service role chama.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'rs\_%' loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
