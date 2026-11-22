-- Contrata — épico 8.8, correções do verifier (spec.md v0.4.9; 11.17, 12.4): as vencidas deixam
-- de fora webhook desligado, empresa suspensa ou excluída e entrega no máximo de tentativas (senão
-- travam a fila das outras); a faxina desiste também da que morreu no meio com o máximo de
-- tentativas; a exclusão a pedido do titular não gera um segundo candidatura.anonimizada (cada
-- candidatura já gera o seu).

-- ---------------------------------------------------------------- mapa (13.4)
create or replace function public.rs_fn_tipo_webhook(p_tipo text) returns text
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
    when 'decisao_proposta' then 'decisao.proposta'
    when 'decisao_confirmada' then 'decisao.confirmada'
    when 'decisao_descartada' then 'decisao.descartada'
    when 'revisao_pedida' then 'revisao.pedida'
  end $$;

-- ---------------------------------------------------------------- vencidas (11.17)
-- Entregas que dá para tentar agora, pelo relógio do banco: pendentes ou que falharam, na hora
-- delas, sem reserva válida, abaixo de p_max tentativas, de webhook ligado e empresa ativa.
-- Recebe: a empresa (nula = todas), o lote e o máximo. Devolve: os ids, das mais velhas.
drop function public.rs_fn_entregas_vencidas(uuid, integer);
create function public.rs_fn_entregas_vencidas(p_empresa uuid, p_lote integer, p_max integer) returns setof uuid
language sql stable set search_path = '' as $$
  select d.id from public.rs_entregas_webhook d
    join public.rs_webhooks w on w.id = d.webhook_id and w.ativo
    join public.rs_empresas e on e.id = d.empresa_id and e.excluida_em is null and e.suspensa_em is null
   where d.status in ('pendente', 'falhou') and d.proxima_tentativa_em <= pg_catalog.now() and d.tentativas < p_max
     and (d.reservada_em is null or d.reservada_em < pg_catalog.now() - interval '2 minutes')
     and (p_empresa is null or d.empresa_id = p_empresa)
   order by d.criado_em limit greatest(p_lote, 0) $$;

-- Faxina (11.17): desiste das pendentes mais velhas que p_desiste (webhook desligado, empresa
-- suspensa) e das que chegaram a p_max tentativas sem resultado (o envio morreu no meio). Devolve quantas.
drop function public.rs_fn_desiste_entregas(interval);
create function public.rs_fn_desiste_entregas(p_desiste interval, p_max integer) returns integer
language plpgsql set search_path = '' as $$
declare v_n integer;
begin
  update public.rs_entregas_webhook set status = 'desistiu', reservada_em = null
   where status in ('pendente', 'falhou')
     and (criado_em < pg_catalog.now() - p_desiste
          or (tentativas >= p_max and (reservada_em is null or reservada_em < pg_catalog.now() - interval '2 minutes')));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke execute on function public.rs_fn_tipo_webhook(text) from public, anon, authenticated;
grant execute on function public.rs_fn_tipo_webhook(text) to service_role;
revoke execute on function public.rs_fn_entregas_vencidas(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.rs_fn_entregas_vencidas(uuid, integer, integer) to service_role;
revoke execute on function public.rs_fn_desiste_entregas(interval, integer) from public, anon, authenticated;
grant execute on function public.rs_fn_desiste_entregas(interval, integer) to service_role;
