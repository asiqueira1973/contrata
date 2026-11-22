-- Contrata — épico 8.9, empresa, LGPD e configurações (spec.md v0.4.10; 7.4, 11.12, 11.20, 15.5,
-- 24.6). Convenções do 8.1: plpgsql, search_path = '', EXECUTE só para service_role, evento na
-- mesma transação, erro P0001 = código. Só o administrador ativo configura e exclui a empresa.

-- ---------------------------------------------------------------- estrutura (v0.4.10)
-- Histórico do texto extra do aviso de privacidade: o texto que cada consentimento_versao
-- representa (a versão é só um hash; aqui fica o que a pessoa aceitou).
create table public.rs_avisos_privacidade (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rs_empresas (id) on delete cascade,
  versao text not null,
  texto_extra text not null constraint rs_avisos_texto check (char_length(texto_extra) <= 1000),
  criado_em timestamptz not null default now(),
  constraint rs_avisos_unico unique (empresa_id, versao)
);
alter table public.rs_avisos_privacidade enable row level security;
revoke all on table public.rs_avisos_privacidade from anon, authenticated;

alter type public.rs_tipo_notificacao add value if not exists 'empresa_excluida';

-- Catálogo 15.3 (v0.4.10): configuração da empresa, exclusão e desfazer.
alter table public.rs_eventos drop constraint rs_eventos_tipo_catalogo;
alter table public.rs_eventos add constraint rs_eventos_tipo_catalogo check (tipo in (
  'empresa_criada', 'membro_convidado', 'convite_cancelado', 'membro_entrou', 'membro_acesso_alterado', 'membro_removido',
  'area_criada', 'area_editada', 'area_arquivada', 'pessoa_cadastrada', 'pessoa_editada', 'pessoa_arquivada',
  'acesso_pedido', 'vaga_dono_alterado', 'credencial_criada', 'credencial_revogada', 'mcp_conectado',
  'vaga_criada', 'vaga_editada', 'vaga_publicada', 'vaga_pausada', 'vaga_pausada_prazo', 'vaga_encerrada',
  'candidatura_criada', 'etapa_alterada', 'nota_adicionada', 'avaliacao_registrada', 'mensagem_enviada',
  'candidatura_reprovada', 'candidatura_contratada', 'candidatura_desistiu', 'candidatura_encerrada_vaga', 'candidatura_reaberta',
  'decisao_proposta', 'decisao_confirmada', 'decisao_descartada', 'decisao_expirada', 'revisao_pedida', 'revisao_respondida',
  'dados_exportados', 'dados_excluidos', 'candidatura_anonimizada', 'talentos_consentido', 'talentos_retirado', 'talentos_convidado',
  'candidaturas_exportadas', 'webhook_criado', 'webhook_editado', 'webhook_removido',
  'empresa_editada', 'empresa_excluida', 'exclusao_desfeita'));

-- ---------------------------------------------------------------- salvar (8.9)
-- Grava só os campos que vierem em p_dados (null limpa os opcionais); os checks da tabela conferem
-- as faixas (retenção 90–365, talentos 6–24, site https, cor #rrggbb). Mudar a retenção não toca nas
-- candidaturas já encerradas (24.6: expurgar_em é fixado no encerramento). Texto extra do aviso
-- novo → guarda o texto com a versão (p_versao_aviso, calculada pelo servidor). Evento
-- empresa_editada com os nomes dos campos mudados. Recebe: empresa, dados, versão do aviso e ator.
-- Devolve a lista de campos mudados.
create function public.rs_fn_salva_empresa(p_empresa uuid, p_dados jsonb, p_versao_aviso text, p_ator jsonb) returns text[]
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

-- Troca (ou remove, com p_path nulo) o logo: uma linha rs_arquivos tipo logo por empresa.
-- Recebe: empresa, caminho, mime, bytes, sha256 e ator. Devolve o caminho antigo (o servidor apaga).
create function public.rs_fn_troca_logo(p_empresa uuid, p_path text, p_mime text, p_bytes integer, p_sha256 text, p_ator jsonb) returns text
language plpgsql set search_path = '' as $$
declare
  v_antigo text;
begin
  perform public.rs_fn_exige_administrador(p_empresa, p_ator);
  select logo_path into v_antigo from public.rs_empresas where id = p_empresa and excluida_em is null for update;
  if not found then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  delete from public.rs_arquivos where empresa_id = p_empresa and tipo = 'logo';
  if p_path is not null then
    insert into public.rs_arquivos (empresa_id, candidatura_id, tipo, path, nome_original, mime, bytes, sha256, extracao_status, confirmado_em)
    values (p_empresa, null, 'logo', p_path, pg_catalog.substring(p_path, '[^/]+$'), p_mime, p_bytes, p_sha256, 'ok', pg_catalog.now());
  end if;
  update public.rs_empresas set logo_path = p_path where id = p_empresa;
  perform public.rs_fn_registra_evento(p_empresa, null, null, 'empresa_editada', p_ator, 'web',
    pg_catalog.jsonb_build_object('campos', array['logo'], 'logo', p_path is not null));
  return case when v_antigo is distinct from p_path then v_antigo end;
end $$;

-- ---------------------------------------------------------------- excluir e desfazer (7.4)
-- Exclui a empresa (desfaz em 7 dias; o expurgo é da faxina): administrador, slug digitado igual,
-- nenhuma candidatura recebida em andamento (cada pessoa recebe a devolutiva pelo fluxo normal,
-- 11.5; decisão do 8.9). Recebe: empresa, slug e ator. Devolve {expurgar_em}.
create function public.rs_fn_exclui_empresa(p_empresa uuid, p_slug text, p_ator jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  e public.rs_empresas;
  v_ativas integer;
begin
  perform public.rs_fn_exige_administrador(p_empresa, p_ator);
  select * into e from public.rs_empresas where id = p_empresa and excluida_em is null for update;
  if e.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if p_slug is distinct from e.slug then
    raise exception 'slug_nao_confere' using errcode = 'P0001';
  end if;
  select count(*) into v_ativas from public.rs_candidaturas where empresa_id = p_empresa and situacao = 'ativa' and recebida_em is not null;
  if v_ativas > 0 then
    raise exception 'empresa_com_ativas' using errcode = 'P0001', detail = v_ativas::text;
  end if;
  update public.rs_empresas set excluida_em = pg_catalog.now() where id = p_empresa;
  perform public.rs_fn_registra_evento(p_empresa, null, null, 'empresa_excluida', p_ator, 'web', '{}');
  return pg_catalog.jsonb_build_object('expurgar_em', pg_catalog.now() + interval '7 days');
end $$;

-- Desfaz a exclusão dentro de 7 dias: administrador ativo. Recebe: empresa e ator.
create function public.rs_fn_desfaz_exclusao(p_empresa uuid, p_ator jsonb) returns void
language plpgsql set search_path = '' as $$
declare e public.rs_empresas;
begin
  perform public.rs_fn_exige_administrador(p_empresa, p_ator);
  select * into e from public.rs_empresas where id = p_empresa for update;
  if e.id is null or e.excluida_em is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if e.excluida_em <= pg_catalog.now() - interval '7 days' then
    raise exception 'prazo_vencido' using errcode = 'P0001';
  end if;
  update public.rs_empresas set excluida_em = null where id = p_empresa;
  perform public.rs_fn_registra_evento(p_empresa, null, null, 'exclusao_desfeita', p_ator, 'web', '{}');
end $$;

-- ---------------------------------------------------------------- privilégios (6.5)
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'rs\_fn\_%' or p.proname like 'rs\_tg\_%') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
