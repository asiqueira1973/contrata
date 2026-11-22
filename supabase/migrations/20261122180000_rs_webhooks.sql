-- Contrata — épico 8.8, webhooks e trilha (spec.md v0.4.9; 11.6, 11.17, 12.4, 13.4, 15.3).
-- Convenções do 8.1: plpgsql, search_path = '', EXECUTE só para service_role, evento na mesma
-- transação, erro P0001 = código. A entrega nasce no banco, junto com o evento (trigger em
-- rs_eventos), para nenhum caminho esquecer de avisar; o corpo não leva nome, e-mail nem telefone.

-- ---------------------------------------------------------------- catálogo (15.3, v0.4.9)
-- Mudanças de webhook entram na trilha: é configuração de segurança (para onde os dados vão).
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
  'candidaturas_exportadas', 'webhook_criado', 'webhook_editado', 'webhook_removido'));

-- Catálogo de webhooks (13.4): o que um webhook pode assinar.
alter table public.rs_webhooks add constraint rs_webhooks_eventos_catalogo check (eventos <@ array[
  'vaga.publicada', 'vaga.pausada', 'vaga.encerrada', 'candidatura.criada', 'candidatura.etapa_alterada',
  'candidatura.reprovada', 'candidatura.contratada', 'candidatura.desistiu', 'candidatura.encerrada_vaga',
  'candidatura.reaberta', 'candidatura.anonimizada', 'decisao.proposta', 'decisao.confirmada', 'decisao.descartada',
  'revisao.pedida']::text[]);
alter table public.rs_webhooks add constraint rs_webhooks_url_tamanho check (char_length(url) <= 500);
create index rs_entregas_webhook_id on public.rs_entregas_webhook (webhook_id);

-- ---------------------------------------------------------------- mapa da trilha para o catálogo
-- Tipo do evento da trilha → tipo do webhook (13.4); null quando o evento não vira webhook.
create function public.rs_fn_tipo_webhook(p_tipo text) returns text
language sql immutable set search_path = '' as $$
  select case p_tipo
    when 'vaga_publicada' then 'vaga.publicada'
    when 'vaga_pausada' then 'vaga.pausada'
    when 'vaga_pausada_prazo' then 'vaga.pausada'
    when 'vaga_encerrada' then 'vaga.encerrada'
    when 'candidatura_criada' then 'candidatura.criada'
    when 'etapa_alterada' then 'candidatura.etapa_alterada'
    when 'candidatura_reprovada' then 'candidatura.reprovada'
    when 'candidatura_contratada' then 'candidatura.contratada'
    when 'candidatura_desistiu' then 'candidatura.desistiu'
    when 'candidatura_encerrada_vaga' then 'candidatura.encerrada_vaga'
    when 'candidatura_reaberta' then 'candidatura.reaberta'
    when 'candidatura_anonimizada' then 'candidatura.anonimizada'
    when 'dados_excluidos' then 'candidatura.anonimizada'
    when 'decisao_proposta' then 'decisao.proposta'
    when 'decisao_confirmada' then 'decisao.confirmada'
    when 'decisao_descartada' then 'decisao.descartada'
    when 'revisao_pedida' then 'revisao.pedida'
  end $$;

-- ---------------------------------------------------------------- corpo (13.4)
-- {id, tipo, criado_em, empresa_id, dados}: dados = os do evento + o resumo da vaga, da candidatura
-- e da decisão, no momento do evento. Sem nome, e-mail, telefone ou texto (quem integra busca a
-- candidatura pela API v1 com a chave). Recebe: o evento e o tipo do webhook. Devolve o corpo.
create function public.rs_fn_corpo_webhook(p_evento public.rs_eventos, p_tipo text) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_dados jsonb := coalesce(p_evento.dados, '{}');
  v_cand uuid := coalesce(p_evento.candidatura_id, nullif(p_evento.dados ->> 'candidatura_id', '')::uuid);
  v_vaga uuid := p_evento.vaga_id;
  v_decisao uuid := nullif(p_evento.dados ->> 'decisao_id', '')::uuid;
  v_obj jsonb;
begin
  if v_cand is not null then
    select pg_catalog.jsonb_build_object('id', c.id, 'vaga_id', c.vaga_id,
             'etapa', case when e.id is null then null else pg_catalog.jsonb_build_object('id', e.id, 'nome', e.nome) end,
             'situacao', c.situacao, 'origem', c.origem, 'sinalizada', c.sinalizada,
             'recebida_em', c.recebida_em, 'encerrada_em', c.encerrada_em), c.vaga_id
      into v_obj, v_vaga
      from public.rs_candidaturas c left join public.rs_etapas e on e.id = c.etapa_id
     where c.id = v_cand and c.empresa_id = p_evento.empresa_id;
    if v_obj is not null then v_dados := v_dados || pg_catalog.jsonb_build_object('candidatura', v_obj); end if;
  end if;
  if v_vaga is not null then
    select pg_catalog.jsonb_build_object('id', v.id, 'titulo', v.titulo, 'slug', v.slug, 'status', v.status, 'area_id', v.area_id)
      into v_obj from public.rs_vagas v where v.id = v_vaga and v.empresa_id = p_evento.empresa_id;
    if v_obj is not null then v_dados := v_dados || pg_catalog.jsonb_build_object('vaga', v_obj); end if;
  end if;
  if v_decisao is not null then
    select pg_catalog.jsonb_build_object('id', d.id, 'tipo', d.tipo, 'status', d.status, 'candidatura_id', d.candidatura_id, 'vaga_id', d.vaga_id)
      into v_obj from public.rs_decisoes d where d.id = v_decisao and d.empresa_id = p_evento.empresa_id;
    if v_obj is not null then v_dados := v_dados || pg_catalog.jsonb_build_object('decisao', v_obj); end if;
  end if;
  if p_evento.tipo = 'dados_excluidos' then
    v_dados := v_dados || '{"motivo":"titular"}';
  end if;
  return pg_catalog.jsonb_build_object('id', p_evento.id::text, 'tipo', p_tipo, 'criado_em', p_evento.criado_em,
    'empresa_id', p_evento.empresa_id, 'dados', v_dados);
end $$;

-- ---------------------------------------------------------------- entrega nasce com o evento (11.17)
-- Depois de cada evento: se ele vira webhook, uma entrega por webhook ativo da empresa que assina
-- o tipo. Empresa suspensa ou excluída não gera entrega.
create function public.rs_tg_eventos_webhook() returns trigger
language plpgsql set search_path = '' as $$
declare v_tipo text := public.rs_fn_tipo_webhook(new.tipo);
begin
  if v_tipo is null or not exists (select 1 from public.rs_webhooks w where w.empresa_id = new.empresa_id and w.ativo and v_tipo = any (w.eventos))
     or not exists (select 1 from public.rs_empresas e where e.id = new.empresa_id and e.excluida_em is null and e.suspensa_em is null) then
    return null;
  end if;
  insert into public.rs_entregas_webhook (empresa_id, webhook_id, evento_id, tipo, corpo)
  select new.empresa_id, w.id, new.id, v_tipo, public.rs_fn_corpo_webhook(new, v_tipo)
    from public.rs_webhooks w where w.empresa_id = new.empresa_id and w.ativo and v_tipo = any (w.eventos)
  on conflict on constraint rs_entregas_unica do nothing;
  return null;
end $$;
create trigger rs_tg_eventos_webhook after insert on public.rs_eventos
  for each row execute function public.rs_tg_eventos_webhook();

-- ---------------------------------------------------------------- configurar (8.8)
-- Só administrador ativo da empresa configura webhook (matriz da seção 5), mesmo chamada direto.
create function public.rs_fn_exige_administrador(p_empresa uuid, p_ator jsonb) returns void
language plpgsql stable set search_path = '' as $$
begin
  if not exists (select 1 from public.rs_membros m where m.id = nullif(p_ator ->> 'membro_id', '')::uuid and m.empresa_id = p_empresa
                   and m.papel = 'administrador' and m.aceito_em is not null and m.removido_em is null) then
    raise exception 'papel_insuficiente' using errcode = 'P0001';
  end if;
end $$;

-- Cria (p_id nulo; URL, eventos e segredo obrigatórios) ou edita um webhook (o que vier nulo fica
-- como está). Até p_max por empresa. Evento webhook_criado / webhook_editado só com ids e o host.
-- Recebe: empresa, id, url, eventos, ativo, segredo cifrado, máximo e ator. Devolve o id.
create function public.rs_fn_salva_webhook(p_empresa uuid, p_id uuid, p_url text, p_eventos text[], p_ativo boolean,
  p_segredo_cifrado text, p_max integer, p_ator jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  v public.rs_webhooks;
begin
  perform public.rs_fn_exige_administrador(p_empresa, p_ator);
  if p_id is null then
    if p_url is null or p_eventos is null or p_segredo_cifrado is null then
      raise exception 'dados_invalidos' using errcode = 'P0001';
    end if;
    if (select count(*) from public.rs_webhooks where empresa_id = p_empresa) >= p_max then
      raise exception 'limite_webhooks' using errcode = 'P0001';
    end if;
    insert into public.rs_webhooks (empresa_id, url, segredo_cifrado, eventos, ativo)
    values (p_empresa, p_url, p_segredo_cifrado, p_eventos, coalesce(p_ativo, true)) returning * into v;
    perform public.rs_fn_registra_evento(p_empresa, null, null, 'webhook_criado', p_ator, 'web',
      pg_catalog.jsonb_build_object('webhook_id', v.id, 'host', pg_catalog.substring(v.url, '^https://([^/:?#]+)'), 'eventos', v.eventos));
    return v.id;
  end if;
  update public.rs_webhooks set url = coalesce(p_url, url), eventos = coalesce(p_eventos, eventos), ativo = coalesce(p_ativo, ativo),
         segredo_cifrado = coalesce(p_segredo_cifrado, segredo_cifrado)
   where id = p_id and empresa_id = p_empresa returning * into v;
  if v.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  perform public.rs_fn_registra_evento(p_empresa, null, null, 'webhook_editado', p_ator, 'web',
    pg_catalog.jsonb_build_object('webhook_id', v.id, 'host', pg_catalog.substring(v.url, '^https://([^/:?#]+)'), 'eventos', v.eventos,
      'ativo', v.ativo, 'url_trocada', p_url is not null, 'segredo_trocado', p_segredo_cifrado is not null));
  return v.id;
end $$;

-- Remove o webhook (as entregas dele saem junto). Recebe: empresa, id e ator.
create function public.rs_fn_remove_webhook(p_empresa uuid, p_id uuid, p_ator jsonb) returns void
language plpgsql set search_path = '' as $$
declare v public.rs_webhooks;
begin
  perform public.rs_fn_exige_administrador(p_empresa, p_ator);
  delete from public.rs_webhooks where id = p_id and empresa_id = p_empresa returning * into v;
  if v.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  perform public.rs_fn_registra_evento(p_empresa, null, null, 'webhook_removido', p_ator, 'web',
    pg_catalog.jsonb_build_object('webhook_id', v.id, 'host', pg_catalog.substring(v.url, '^https://([^/:?#]+)')));
end $$;

-- ---------------------------------------------------------------- entregar (11.17, 12.4)
-- Reserva uma entrega vencida por 2 min e conta a tentativa (só um envio por vez). Recusa a já
-- entregue, a que desistiu, a que passou de p_max e a que ainda não venceu. Devolve se reservou.
create function public.rs_fn_reserva_entrega(p_id uuid, p_max integer) returns boolean
language plpgsql set search_path = '' as $$
begin
  update public.rs_entregas_webhook set reservada_em = pg_catalog.now(), tentativas = tentativas + 1
   where id = p_id and status in ('pendente', 'falhou') and tentativas < p_max and proxima_tentativa_em <= pg_catalog.now()
     and (reservada_em is null or reservada_em < pg_catalog.now() - interval '2 minutes');
  return found;
end $$;

-- Grava o resultado de uma tentativa: 2xx = entregue; senão falhou com a próxima tentativa em
-- p_espera, ou desistiu (p_max tentativas ou mais velha que p_desiste). Recebe: entrega, status HTTP
-- (0 sem resposta), espera, máximo e prazo. Devolve o status final.
create function public.rs_fn_resultado_entrega(p_id uuid, p_status_http integer, p_espera interval, p_max integer, p_desiste interval)
returns public.rs_status_entrega
language plpgsql set search_path = '' as $$
declare v public.rs_entregas_webhook;
begin
  select * into v from public.rs_entregas_webhook where id = p_id for update;
  if v.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if p_status_http between 200 and 299 then
    update public.rs_entregas_webhook set status = 'entregue', ultimo_status_http = p_status_http, entregue_em = pg_catalog.now(), reservada_em = null
     where id = p_id;
    return 'entregue';
  end if;
  if v.tentativas >= p_max or v.criado_em < pg_catalog.now() - p_desiste then
    update public.rs_entregas_webhook set status = 'desistiu', ultimo_status_http = nullif(p_status_http, 0), reservada_em = null where id = p_id;
    return 'desistiu';
  end if;
  update public.rs_entregas_webhook set status = 'falhou', ultimo_status_http = nullif(p_status_http, 0), reservada_em = null,
         proxima_tentativa_em = pg_catalog.now() + p_espera
   where id = p_id;
  return 'falhou';
end $$;

-- Entregas vencidas (pendentes ou que falharam, na hora delas, sem reserva válida), pelo relógio do
-- banco. Recebe: a empresa (nula = todas) e o lote. Devolve: os ids, das mais velhas.
create function public.rs_fn_entregas_vencidas(p_empresa uuid, p_lote integer) returns setof uuid
language sql stable set search_path = '' as $$
  select id from public.rs_entregas_webhook
   where status in ('pendente', 'falhou') and proxima_tentativa_em <= pg_catalog.now()
     and (reservada_em is null or reservada_em < pg_catalog.now() - interval '2 minutes')
     and (p_empresa is null or empresa_id = p_empresa)
   order by criado_em limit greatest(p_lote, 0) $$;
revoke execute on function public.rs_fn_entregas_vencidas(uuid, integer) from public, anon, authenticated;
grant execute on function public.rs_fn_entregas_vencidas(uuid, integer) to service_role;

-- Faxina (11.17): desiste das entregas pendentes mais velhas que p_desiste (webhook desligado ou
-- empresa suspensa, que o envio pula). Devolve quantas.
create function public.rs_fn_desiste_entregas(p_desiste interval) returns integer
language plpgsql set search_path = '' as $$
declare v_n integer;
begin
  update public.rs_entregas_webhook set status = 'desistiu', reservada_em = null
   where status in ('pendente', 'falhou') and criado_em < pg_catalog.now() - p_desiste;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------------------------------------- GET /eventos (13.2; 11.32)
-- Trilha da empresa depois de p_desde, em ordem crescente, para sincronização incremental. No
-- alcance: evento de vaga só se a vaga estiver no alcance; evento sem vaga (membros, áreas, chaves,
-- webhooks) só para administrador. Recebe: empresa, alcance, se é administrador, desde e limite.
create function public.rs_fn_lista_eventos(p_empresa uuid, p_alcance jsonb, p_admin boolean, p_desde bigint, p_limite integer)
returns setof public.rs_eventos
language plpgsql stable set search_path = '' as $$
begin
  return query
  select e.* from public.rs_eventos e left join public.rs_vagas v on v.id = e.vaga_id
   where e.empresa_id = p_empresa and e.id > coalesce(p_desde, 0)
     and (case when e.vaga_id is null then p_admin else v.id is not null and public.rs_fn_vaga_no_alcance(v.id, v.area_id, p_alcance) end)
   order by e.id limit greatest(p_limite, 0);
end $$;
revoke execute on function public.rs_fn_lista_eventos(uuid, jsonb, boolean, bigint, integer) from public, anon, authenticated;
grant execute on function public.rs_fn_lista_eventos(uuid, jsonb, boolean, bigint, integer) to service_role;

-- ---------------------------------------------------------------- privilégios (6.5)
revoke all on table public.rs_webhooks, public.rs_entregas_webhook from anon, authenticated;
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'rs\_fn\_%' or p.proname like 'rs\_tg\_%') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
