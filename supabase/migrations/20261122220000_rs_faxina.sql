-- Contrata — épico 8.10, faxina diária (spec.md v0.4.11; 7.4, 11.11, 11.12, 11.31, 12.4). Convenções
-- do 8.1: plpgsql, search_path = '', EXECUTE só para service_role, evento na mesma transação, erro
-- P0001 = código. Cada passo trabalha em lotes ("for update skip locked") e é idempotente.

-- ---------------------------------------------------------------- estrutura (v0.4.11)
-- O nome do remetente ("{empresa} via …") vai junto, para a retentativa da faxina não o perder.
alter table public.rs_notificacoes add column remetente_nome text constraint rs_notificacoes_remetente check (char_length(remetente_nome) <= 120);
alter type public.rs_tipo_notificacao add value if not exists 'acesso_pedido';

-- ---------------------------------------------------------------- convites vencidos (8.10)
-- Convite de membro vencido sai (como o cancelado), com convite_cancelado {motivo: venceu}, ator
-- sistema. Recebe: o lote. Devolve quantos.
create function public.rs_fn_faxina_convites(p_lote integer) returns integer
language plpgsql set search_path = '' as $$
declare
  m record;
  v_n integer := 0;
begin
  for m in select id, empresa_id from public.rs_membros
            where aceito_em is null and removido_em is null and convite_expira_em <= pg_catalog.now()
            order by convite_expira_em limit p_lote for update skip locked loop
    update public.rs_membros set removido_em = pg_catalog.now(), convite_token_hash = null where id = m.id;
    perform public.rs_fn_registra_evento(m.empresa_id, null, null, 'convite_cancelado', '{"tipo":"sistema","origem":"cron"}', 'cron',
      pg_catalog.jsonb_build_object('membro_id', m.id, 'motivo', 'venceu'));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ---------------------------------------------------------------- anonimizar (7.4, 11.12)
-- Anonimiza a candidatura (7.4). Com p_manter_curriculo, o currículo fica (a pessoa está no banco
-- de talentos: o currículo mais recente fica até o consentimento vencer, 11.12). Recebe:
-- candidatura, empresa e se mantém o currículo. Devolve os caminhos dos arquivos apagados.
drop function public.rs_fn_anonimiza_candidatura(uuid, uuid);
create function public.rs_fn_anonimiza_candidatura(p_candidatura uuid, p_empresa uuid, p_manter_curriculo boolean default false) returns text[]
language plpgsql set search_path = '' as $$
declare
  v_paths text[];
  v public.rs_candidaturas;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa for update;
  if v.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  select coalesce(pg_catalog.array_agg(path), '{}') into v_paths from public.rs_arquivos
   where candidatura_id = p_candidatura and not (p_manter_curriculo and tipo = 'curriculo');
  delete from public.rs_arquivos where candidatura_id = p_candidatura and not (p_manter_curriculo and tipo = 'curriculo');
  delete from public.rs_respostas where candidatura_id = p_candidatura;
  delete from public.rs_notas where candidatura_id = p_candidatura;
  update public.rs_avaliacoes set comentario = '' where candidatura_id = p_candidatura;
  update public.rs_mensagens set assunto = '', corpo = '' where candidatura_id = p_candidatura;
  update public.rs_notificacoes set status = 'descartada', html = '', texto = ''
   where candidatura_id = p_candidatura and status in ('pendente', 'falhou');
  update public.rs_candidaturas set texto_busca = null, sinalizada = false, exclusao_codigo_hash = null, revisao_texto = null,
         token_hash = 'anonimizada:' || id::text
   where id = p_candidatura;
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'candidatura_anonimizada',
    pg_catalog.jsonb_build_object('tipo', 'sistema'), 'publico', pg_catalog.jsonb_build_object('candidatura_id', p_candidatura));
  return v_paths;
end $$;

-- ---------------------------------------------------------------- expurgo (11.12)
-- 1) Candidatura com expurgar_em vencido e ainda não anonimizada → anonimiza. Se a pessoa tem
--    consentimento de talentos válido, a candidatura mais recente dela com currículo guarda o
--    currículo, e o cadastro (nome, contato) fica.
-- 2) Pessoa sem candidatura viva (todas anonimizadas), sem consentimento válido e ainda não
--    anonimizada → apaga o currículo guardado e anonimiza o cadastro.
-- Recebe: o lote. Devolve {candidaturas, pessoas, paths}.
create function public.rs_fn_faxina_expurgos(p_lote integer) returns jsonb
language plpgsql set search_path = '' as $$
declare
  c record;
  k record;
  v_paths text[] := '{}';
  v_cands integer := 0;
  v_pessoas integer := 0;
  v_manter boolean;
begin
  for c in select id, empresa_id, candidato_id from public.rs_candidaturas
            where expurgar_em <= pg_catalog.now() and token_hash not like 'anonimizada:%'
            order by expurgar_em limit p_lote for update skip locked loop
    v_manter := exists (select 1 from public.rs_candidatos t where t.id = c.candidato_id and t.anonimizado_em is null
                          and t.talentos_expira_em > pg_catalog.now())
                and c.id = (select x.id from public.rs_candidaturas x
                             where x.candidato_id = c.candidato_id and x.recebida_em is not null
                               and exists (select 1 from public.rs_arquivos a where a.candidatura_id = x.id and a.tipo = 'curriculo')
                             order by x.recebida_em desc limit 1);
    v_paths := v_paths || public.rs_fn_anonimiza_candidatura(c.id, c.empresa_id, v_manter);
    v_cands := v_cands + 1;
  end loop;
  for k in select t.id from public.rs_candidatos t
            where t.anonimizado_em is null and (t.talentos_expira_em is null or t.talentos_expira_em <= pg_catalog.now())
              and exists (select 1 from public.rs_candidaturas x where x.candidato_id = t.id)
              and not exists (select 1 from public.rs_candidaturas x where x.candidato_id = t.id and x.token_hash not like 'anonimizada:%')
            limit p_lote for update skip locked loop
    v_paths := v_paths || coalesce((select pg_catalog.array_agg(a.path) from public.rs_arquivos a
                                      join public.rs_candidaturas x on x.id = a.candidatura_id where x.candidato_id = k.id), '{}');
    delete from public.rs_arquivos a using public.rs_candidaturas x where x.id = a.candidatura_id and x.candidato_id = k.id;
    update public.rs_candidatos set nome = 'Pessoa removida', email = null, telefone = null, linkedin_url = null, cidade = null,
           talentos_consentido_em = null, talentos_expira_em = null, talentos_avisado_em = null, anonimizado_em = pg_catalog.now()
     where id = k.id;
    v_pessoas := v_pessoas + 1;
  end loop;
  return pg_catalog.jsonb_build_object('candidaturas', v_cands, 'pessoas', v_pessoas, 'paths', pg_catalog.to_jsonb(v_paths));
end $$;

-- Empresas excluídas há 7 dias ou mais (7.4): o servidor apaga a pasta no bucket e depois chama
-- rs_fn_expurga_empresa. Recebe: o lote. Devolve os ids.
create function public.rs_fn_empresas_a_expurgar(p_lote integer) returns setof uuid
language sql stable set search_path = '' as $$
  select id from public.rs_empresas where excluida_em <= pg_catalog.now() - interval '7 days'
   order by excluida_em limit greatest(p_lote, 0) $$;

-- ---------------------------------------------------------------- e-mails (12.4, 7.4)
-- Notificações a retentar: as que falharam com tentativas sobrando e as pendentes que o envio logo
-- depois da resposta perdeu (mais de 10 min), de empresa ativa. Recebe: lote e máximo. Devolve os ids.
create function public.rs_fn_notificacoes_a_retentar(p_lote integer, p_max integer) returns setof uuid
language sql stable set search_path = '' as $$
  select n.id from public.rs_notificacoes n join public.rs_empresas e on e.id = n.empresa_id
   where e.excluida_em is null and e.suspensa_em is null and n.tentativas < p_max and n.enviar_apos <= pg_catalog.now()
     and (n.status = 'falhou' or (n.status = 'pendente' and n.criado_em < pg_catalog.now() - interval '10 minutes'))
   order by n.criado_em limit greatest(p_lote, 0) $$;

-- Apaga as enviadas e descartadas com mais de p_dias dias (o HTML já saiu, mas o assunto e o
-- destinatário são dados pessoais). Recebe: dias e lote. Devolve quantas.
create function public.rs_fn_limpa_notificacoes(p_dias integer, p_lote integer) returns integer
language plpgsql set search_path = '' as $$
declare v_n integer;
begin
  delete from public.rs_notificacoes where id in (
    select id from public.rs_notificacoes where status in ('enviada', 'descartada') and criado_em < pg_catalog.now() - pg_catalog.make_interval(days => p_dias)
     limit p_lote);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------------------------------------- resumo diário (11.11)
-- Por vaga da empresa, as contagens do resumo diário (só vagas com algum item) e o responsável válido
-- (membro ativo com conta, administrador ou recrutador), mais a equipe que pode receber (com o que
-- define o alcance). Sem nomes de candidatos. Recebe: empresa, dias de parada e de revisão atrasada.
-- Devolve {vagas: [...], membros: [...]}.
create function public.rs_fn_resumo_diario(p_empresa uuid, p_parada_dias integer, p_revisao_dias integer) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_vagas jsonb;
  v_membros jsonb;
begin
  if not exists (select 1 from public.rs_empresas where id = p_empresa and excluida_em is null and suspensa_em is null) then
    return pg_catalog.jsonb_build_object('vagas', '[]'::jsonb, 'membros', '[]'::jsonb);
  end if;
  with base as (
    select v.id, v.titulo, v.area_id,
      (select count(*) from public.rs_decisoes d left join public.rs_candidaturas dc on dc.id = d.candidatura_id
        where d.empresa_id = p_empresa and d.status = 'pendente' and d.criado_em <= pg_catalog.now() - interval '24 hours'
          and coalesce(d.vaga_id, dc.vaga_id) = v.id)::int as propostas,
      (select count(*) from public.rs_candidaturas c where c.vaga_id = v.id and c.revisao_pedida_em is not null
          and c.revisao_respondida_em is null and (c.expurgar_em is null or c.expurgar_em > pg_catalog.now()))::int as revisoes,
      (select count(*) from public.rs_candidaturas c where c.vaga_id = v.id and c.revisao_pedida_em is not null
          and c.revisao_respondida_em is null and (c.expurgar_em is null or c.expurgar_em > pg_catalog.now())
          and c.revisao_pedida_em <= pg_catalog.now() - pg_catalog.make_interval(days => p_revisao_dias))::int as revisoes_atrasadas,
      (select count(*) from public.rs_candidaturas c where c.vaga_id = v.id and c.situacao = 'ativa' and c.recebida_em is not null
          and c.movida_em <= pg_catalog.now() - pg_catalog.make_interval(days => p_parada_dias))::int as paradas,
      exists (select 1 from public.rs_eventos e where e.empresa_id = p_empresa and e.vaga_id = v.id and e.tipo = 'vaga_pausada_prazo'
               and e.criado_em > pg_catalog.now() - interval '24 hours') as pausada_prazo,
      (select q.membro_id from public.rs_vaga_equipe q join public.rs_membros m on m.id = q.membro_id
        where q.vaga_id = v.id and q.papel_na_vaga = 'responsavel' and m.empresa_id = p_empresa and m.removido_em is null
          and m.usuario_id is not null and m.papel in ('administrador', 'recrutador') limit 1) as responsavel
      from public.rs_vagas v where v.empresa_id = p_empresa
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(b) order by b.titulo), '[]') into v_vagas
    from base b where b.propostas + b.revisoes + b.paradas > 0 or b.pausada_prazo;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', m.id, 'papel', m.papel, 'todas_areas', m.todas_areas,
           'areas', coalesce((select pg_catalog.jsonb_agg(a.area_id) from public.rs_membro_areas a where a.membro_id = m.id), '[]'),
           'email', u.email, 'nome', u.nome)), '[]') into v_membros
    from public.rs_membros m join public.rs_usuarios u on u.id = m.usuario_id
   where m.empresa_id = p_empresa and m.removido_em is null and m.papel in ('administrador', 'recrutador') and u.suspenso_em is null;
  return pg_catalog.jsonb_build_object('vagas', v_vagas, 'membros', v_membros);
end $$;

-- ---------------------------------------------------------------- resumo semanal (11.31)
-- Vagas publicadas ou pausadas cujo dono é pessoa sem acesso (sem membro), com recebe_resumo e não
-- arquivada, de empresa ativa: contagens por tipo de etapa das em andamento, encerradas na semana,
-- se alguém foi contratado e quem conduz. Sem nomes de candidatos. Recebe: o lote. Devolve a lista.
create function public.rs_fn_resumo_donos(p_lote integer) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_agg(r), '[]') from (
    select v.id as vaga_id, v.titulo, v.empresa_id, e.nome as empresa, e.slug, e.cor_destaque, e.logo_path, e.email_contato,
           p.id as pessoa_id, p.nome, p.email,
           (select count(*) from public.rs_candidaturas c join public.rs_etapas t on t.id = c.etapa_id
             where c.vaga_id = v.id and c.situacao = 'ativa' and c.recebida_em is not null and t.tipo = 'triagem')::int as em_analise,
           (select count(*) from public.rs_candidaturas c join public.rs_etapas t on t.id = c.etapa_id
             where c.vaga_id = v.id and c.situacao = 'ativa' and c.recebida_em is not null and t.tipo = 'entrevista')::int as entrevistas,
           (select count(*) from public.rs_candidaturas c join public.rs_etapas t on t.id = c.etapa_id
             where c.vaga_id = v.id and c.situacao = 'ativa' and c.recebida_em is not null and t.tipo in ('avaliacao', 'proposta'))::int as fase_final,
           (select count(*) from public.rs_candidaturas c where c.vaga_id = v.id and c.recebida_em is not null
             and c.encerrada_em > pg_catalog.now() - interval '7 days')::int as encerradas_semana,
           exists (select 1 from public.rs_candidaturas c where c.vaga_id = v.id and c.situacao = 'contratada') as contratada,
           (select u.nome from public.rs_vaga_equipe q join public.rs_membros m on m.id = q.membro_id join public.rs_usuarios u on u.id = m.usuario_id
             where q.vaga_id = v.id and q.papel_na_vaga = 'responsavel' and m.removido_em is null limit 1) as recrutador
      from public.rs_vagas v
      join public.rs_pessoas p on p.id = v.dono_pessoa_id
      join public.rs_empresas e on e.id = v.empresa_id
     where v.status in ('publicada', 'pausada') and p.membro_id is null and p.recebe_resumo and p.arquivada_em is null
       and e.excluida_em is null and e.suspensa_em is null
     order by v.empresa_id, v.id limit greatest(p_lote, 0)
  ) r $$;

-- ---------------------------------------------------------------- pedir acesso (11.31)
-- O dono de vaga sem acesso pede acesso pelo resumo: só registra (acesso_pedido) e devolve quem
-- avisar; não cria convite. Recebe: empresa e pessoa. Devolve {nome, administradores: [{id, email}]}.
create function public.rs_fn_pede_acesso(p_empresa uuid, p_pessoa uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare p public.rs_pessoas;
begin
  select * into p from public.rs_pessoas where id = p_pessoa and empresa_id = p_empresa;
  if p.id is null or p.membro_id is not null or p.arquivada_em is not null
     or not exists (select 1 from public.rs_empresas where id = p_empresa and excluida_em is null and suspensa_em is null) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  perform public.rs_fn_registra_evento(p_empresa, null, null, 'acesso_pedido', '{"tipo":"sistema","origem":"publico"}', 'publico',
    pg_catalog.jsonb_build_object('pessoa_id', p_pessoa));
  return pg_catalog.jsonb_build_object('nome', p.nome, 'administradores', coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', m.id, 'email', u.email))
      from public.rs_membros m join public.rs_usuarios u on u.id = m.usuario_id
     where m.empresa_id = p_empresa and m.papel = 'administrador' and m.removido_em is null and u.suspenso_em is null), '[]'));
end $$;

-- A mensagem guarda de qual notificação saiu; apagar a notificação velha (7.4) só esquece o vínculo.
alter table public.rs_mensagens alter column notificacao_id drop not null;
alter table public.rs_mensagens drop constraint rs_mensagens_notificacao_id_fkey;
alter table public.rs_mensagens add constraint rs_mensagens_notificacao_id_fkey
  foreign key (notificacao_id) references public.rs_notificacoes (id) on delete set null;

-- ---------------------------------------------------------------- expurgo da empresa (7.4)
-- Apaga a empresa e tudo dela, 7 dias depois de excluida_em (os arquivos já saíram do bucket). Em
-- ordem explícita: as chaves estrangeiras "no action" entre tabelas da empresa (nota → credencial,
-- avaliação → membro, pessoa → membro) são conferidas a cada passo da cascata, então apagar só a
-- empresa falhava quando havia nota de integração ou avaliação (achado do 8.10).
create or replace function public.rs_fn_expurga_empresa(p_empresa uuid) returns void
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.rs_empresas where id = p_empresa
                 and excluida_em <= pg_catalog.now() - interval '7 days') then
    raise exception 'empresa_nao_expurgavel' using errcode = 'P0001';
  end if;
  perform pg_catalog.set_config('rs.expurgo_empresa', p_empresa::text, true);
  delete from public.rs_entregas_webhook where empresa_id = p_empresa;
  delete from public.rs_eventos where empresa_id = p_empresa;
  delete from public.rs_candidaturas where empresa_id = p_empresa;
  delete from public.rs_notificacoes where empresa_id = p_empresa;
  delete from public.rs_decisoes where empresa_id = p_empresa;
  delete from public.rs_convites_talento where empresa_id = p_empresa;
  delete from public.rs_vagas where empresa_id = p_empresa;
  delete from public.rs_oauth_codigos where empresa_id = p_empresa;
  delete from public.rs_credenciais where empresa_id = p_empresa;
  update public.rs_areas set responsavel_pessoa_id = null where empresa_id = p_empresa;
  delete from public.rs_pessoas where empresa_id = p_empresa;
  delete from public.rs_membros where empresa_id = p_empresa;
  delete from public.rs_empresas where id = p_empresa;
  perform pg_catalog.set_config('rs.expurgo_empresa', '', true);
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
