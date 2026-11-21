-- Contrata — épico 8.6, decisões, devolutivas e mensagens (spec.md v0.4.7, seções 11.4, 11.5,
-- 11.7, 11.8, 11.13, 11.23, 12.2 e 12.3). Convenções do 8.1: plpgsql, search_path = '', EXECUTE só
-- para service_role, evento na mesma transação, erro P0001 = código. Decisão só executa por
-- rs_fn_decide ou rs_fn_confirma_decisao, com um membro como ator (o clique no formulário).

-- ---------------------------------------------------------------- colunas (v0.4.7)
-- link_versao: o token /c é derivado de candidatura + versão (decisão 1 do 8.6); girar o link sobe
-- a versão. revisao_texto: o texto opcional do pedido de revisão (11.13), apagado na anonimização.
alter table public.rs_candidaturas
  add column link_versao integer not null default 0,
  add column revisao_texto text constraint rs_candidaturas_revisao_texto check (char_length(revisao_texto) <= 1000);

-- ---------------------------------------------------------------- redefinidas
-- rs_fn_cria_candidatura: a duplicada não troca mais o token (o servidor gira pela rs_fn_troca_link).
-- rs_fn_encerra_candidatura: devolutiva de 20 a 3.000 caracteres conferida aqui (11.5).
-- rs_fn_anonimiza_candidatura: apaga também o texto do pedido de revisão.
create or replace function public.rs_fn_cria_candidatura(
  p_empresa uuid, p_vaga uuid, p_candidato jsonb, p_respostas jsonb, p_origem public.rs_origem_candidatura,
  p_ator jsonb, p_consentimento text, p_talentos boolean, p_token_hash text, p_max_por_vaga integer
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
  select id into v_etapa from public.rs_etapas where vaga_id = p_vaga order by ordem limit 1;
  insert into public.rs_candidaturas (empresa_id, vaga_id, candidato_id, etapa_id, origem, token_hash,
                                      consentimento_versao, consentimento_em, talentos_pedido)
  values (p_empresa, p_vaga, v_candidato, v_etapa, p_origem, p_token_hash, p_consentimento, pg_catalog.now(), coalesce(p_talentos, false))
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
  if p_origem <> 'manual' and exists (
    select 1 from public.rs_perguntas p where p.vaga_id = p_vaga and p.obrigatoria
       and not exists (select 1 from public.rs_respostas r where r.candidatura_id = v_id and r.pergunta_id = p.id)
  ) then
    raise exception 'resposta_obrigatoria' using errcode = 'P0001';
  end if;
  update public.rs_candidaturas set sinalizada = v_sinalizada where id = v_id;
  return pg_catalog.jsonb_build_object('id', v_id, 'existente', false, 'recebida', false);
end $$;

create or replace function public.rs_fn_encerra_candidatura(p_candidatura uuid, p_empresa uuid, p_situacao public.rs_situacao_candidatura,
  p_ator jsonb, p_motivo public.rs_motivo_reprovacao, p_mensagem jsonb, p_dados jsonb default '{}') returns jsonb
language plpgsql set search_path = '' as $$
declare
  v public.rs_candidaturas;
  v_retencao smallint;
  v_notificacao uuid;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa for update;
  if v.id is null or v.recebida_em is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_candidatos where id = v.candidato_id and anonimizado_em is not null) then
    raise exception 'candidatura_anonimizada' using errcode = 'P0001';
  end if;
  if v.situacao <> 'ativa' or p_situacao = 'ativa' then
    raise exception 'transicao_proibida' using errcode = 'P0001';
  end if;
  -- 11.5: reprovar e encerrar com a vaga exigem devolutiva de 20 a 3.000 caracteres, em todo caminho.
  if p_situacao in ('reprovada', 'encerrada_vaga') and (p_mensagem is null
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_mensagem ->> 'corpo', ''))) not between 20 and 3000) then
    raise exception 'devolutiva_obrigatoria' using errcode = 'P0001';
  end if;
  select retencao_dias into v_retencao from public.rs_empresas where id = p_empresa;
  perform pg_catalog.set_config('rs.transicao', 'on', true);
  update public.rs_candidaturas set situacao = p_situacao, encerrada_em = pg_catalog.now(),
         expurgar_em = pg_catalog.now() + pg_catalog.make_interval(days => v_retencao),
         motivo_reprovacao = case when p_situacao = 'reprovada' then p_motivo end
   where id = p_candidatura;
  perform pg_catalog.set_config('rs.transicao', 'off', true);
  if p_mensagem is not null then
    insert into public.rs_notificacoes (empresa_id, candidatura_id, tipo, destinatario, chave_idempotencia, assunto, html, texto, reply_to)
    values (p_empresa, p_candidatura, (p_mensagem -> 'notificacao' ->> 'tipo')::public.rs_tipo_notificacao,
            p_mensagem -> 'notificacao' ->> 'destinatario', p_mensagem -> 'notificacao' ->> 'chave',
            p_mensagem -> 'notificacao' ->> 'assunto', p_mensagem -> 'notificacao' ->> 'html', p_mensagem -> 'notificacao' ->> 'texto',
            nullif(p_mensagem -> 'notificacao' ->> 'reply_to', ''))
    returning id into v_notificacao;
    insert into public.rs_mensagens (empresa_id, candidatura_id, tipo, assunto, corpo, ator_tipo, membro_id, credencial_id, notificacao_id)
    values (p_empresa, p_candidatura, (p_mensagem ->> 'tipo')::public.rs_tipo_mensagem, p_mensagem ->> 'assunto', p_mensagem ->> 'corpo',
            (p_ator ->> 'tipo')::public.rs_tipo_ator, (p_ator ->> 'membro_id')::uuid, (p_ator ->> 'credencial_id')::uuid, v_notificacao);
  end if;
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'candidatura_' || p_situacao::text, p_ator, 'publico',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura) || coalesce(p_dados, '{}'));
  return pg_catalog.jsonb_build_object('notificacao_id', v_notificacao);
end $$;

create or replace function public.rs_fn_anonimiza_candidatura(p_candidatura uuid, p_empresa uuid) returns text[]
language plpgsql set search_path = '' as $$
declare
  v_paths text[];
  v public.rs_candidaturas;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa for update;
  if v.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  select coalesce(pg_catalog.array_agg(path), '{}') into v_paths from public.rs_arquivos where candidatura_id = p_candidatura;
  delete from public.rs_arquivos where candidatura_id = p_candidatura;
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

-- ---------------------------------------------------------------- link derivado (11.4, decisão 1 do 8.6)
-- Gira o link do candidato: sobe a versão e grava o hash do token novo, só se a versão ainda for a
-- esperada (o servidor deriva o token de candidatura + versão com LINK_CANDIDATO_SECRET; no banco,
-- só o hash). Recebe: candidatura, empresa, versão lida e o hash do token da versão seguinte.
-- Devolve: true se trocou (false: outra troca chegou antes; o servidor lê de novo e tenta outra vez).
create function public.rs_fn_troca_link(p_candidatura uuid, p_empresa uuid, p_versao integer, p_hash text) returns boolean
language plpgsql set search_path = '' as $$
begin
  update public.rs_candidaturas set link_versao = p_versao + 1, token_hash = p_hash
   where id = p_candidatura and empresa_id = p_empresa and link_versao = p_versao
     and token_hash not like 'anonimizada:%';
  return found;
end $$;

-- ---------------------------------------------------------------- mensagens (11.8, 11.29)
-- Envia uma mensagem a uma candidatura (rs_fn_envia_mensagem): grava rs_mensagens (o corpo guarda
-- {{link_acompanhamento}}, nunca o link, 20.3), a notificação idempotente e o evento
-- mensagem_enviada. Recebe: candidatura, empresa, tipo, mensagem {assunto, corpo, notificacao},
-- ator, decisão (se veio de proposta) e a cota diária de chaves de API (só no envio direto pela
-- API). Devolve o id da mensagem.
create function public.rs_fn_envia_mensagem(p_candidatura uuid, p_empresa uuid, p_tipo public.rs_tipo_mensagem, p_mensagem jsonb,
  p_ator jsonb, p_decisao uuid, p_cota integer) returns uuid
language plpgsql set search_path = '' as $$
declare
  v public.rs_candidaturas;
  v_notificacao uuid;
  v_id uuid;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa and recebida_em is not null for update;
  if v.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.rs_candidatos where id = v.candidato_id and anonimizado_em is not null) then
    raise exception 'candidatura_anonimizada' using errcode = 'P0001';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(coalesce(p_mensagem ->> 'corpo', ''))) not between 2 and 5000
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_mensagem ->> 'assunto', ''))) not between 2 and 200 then
    raise exception 'mensagem_invalida' using errcode = 'P0001';
  end if;
  if p_cota is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mensagens_api:' || p_empresa::text));
    if (select count(*) from public.rs_mensagens where empresa_id = p_empresa and ator_tipo = 'api'
         and criado_em > pg_catalog.now() - interval '1 day') >= p_cota then
      raise exception 'limite_mensagens' using errcode = 'P0001';
    end if;
  end if;
  insert into public.rs_notificacoes (empresa_id, candidatura_id, tipo, destinatario, chave_idempotencia, assunto, html, texto, reply_to)
  values (p_empresa, p_candidatura, 'mensagem_candidato', p_mensagem -> 'notificacao' ->> 'destinatario',
          p_mensagem -> 'notificacao' ->> 'chave', p_mensagem -> 'notificacao' ->> 'assunto', p_mensagem -> 'notificacao' ->> 'html',
          p_mensagem -> 'notificacao' ->> 'texto', nullif(p_mensagem -> 'notificacao' ->> 'reply_to', ''))
  returning id into v_notificacao;
  insert into public.rs_mensagens (empresa_id, candidatura_id, tipo, assunto, corpo, ator_tipo, membro_id, credencial_id, decisao_id, notificacao_id)
  values (p_empresa, p_candidatura, p_tipo, p_mensagem ->> 'assunto', p_mensagem ->> 'corpo', (p_ator ->> 'tipo')::public.rs_tipo_ator,
          (p_ator ->> 'membro_id')::uuid, (p_ator ->> 'credencial_id')::uuid, p_decisao, v_notificacao)
  returning id into v_id;
  update public.rs_candidaturas set atualizado_em = pg_catalog.now() where id = p_candidatura;
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'mensagem_enviada', p_ator, 'web',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura, 'mensagem_id', v_id, 'tipo', p_tipo, 'decisao_id', p_decisao));
  return v_id;
end $$;

-- ---------------------------------------------------------------- reabrir (11.23)
-- Volta uma candidatura encerrada para ativa (é decisão: só pelo formulário). Só antes do expurgo,
-- com a vaga publicada ou pausada, pessoa não anonimizada; volta para a última etapa (ou a primeira).
-- Não manda e-mail. Recebe: candidatura, empresa, alcance e ator.
create function public.rs_fn_reabre_candidatura(p_candidatura uuid, p_empresa uuid, p_alcance jsonb, p_ator jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  v public.rs_candidaturas;
  v_vaga public.rs_vagas;
  v_etapa uuid;
begin
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

-- ---------------------------------------------------------------- executar decisão (11.5, 11.7)
-- Executa uma decisão já confirmada por uma pessoa (o clique no formulário): é chamada só por
-- rs_fn_decide e rs_fn_confirma_decisao, nunca pelo servidor direto. Recebe: empresa, tipo,
-- candidatura, vaga, payload {motivo?, motivo_encerramento?}, mensagens (por candidatura:
-- {tipo, assunto, corpo, notificacao}), ator (o membro, com autorizado_por) e a decisão.
-- Devolve: quantas candidaturas mudaram.
create function public.rs_fn_executa_decisao(p_empresa uuid, p_tipo public.rs_tipo_decisao, p_candidatura uuid, p_vaga uuid,
  p_payload jsonb, p_mensagens jsonb, p_ator jsonb, p_decisao uuid) returns integer
language plpgsql set search_path = '' as $$
declare
  v_c record;
  v_n integer := 0;
  v_dados jsonb := pg_catalog.jsonb_build_object('decisao_id', p_decisao);
begin
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

-- Confere se o alvo de uma decisão ainda permite a ação. Devolve null (pode) ou o motivo
-- (candidatura_encerrada, vaga_encerrada, vaga_sem_ativas, nao_encontrado).
create function public.rs_fn_alvo_da_decisao(p_empresa uuid, p_tipo public.rs_tipo_decisao, p_candidatura uuid, p_vaga uuid, p_alcance jsonb)
returns text
language plpgsql stable set search_path = '' as $$
declare
  v public.rs_candidaturas;
  v_vaga public.rs_vagas;
begin
  if p_tipo = 'encerrar_vaga' then
    select * into v_vaga from public.rs_vagas where id = p_vaga and empresa_id = p_empresa;
    if v_vaga.id is null or not public.rs_fn_vaga_no_alcance(v_vaga.id, v_vaga.area_id, p_alcance) then return 'nao_encontrado'; end if;
    if v_vaga.status = 'encerrada' then return 'vaga_encerrada'; end if;
    return null;
  end if;
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa and recebida_em is not null;
  select * into v_vaga from public.rs_vagas where id = v.vaga_id;
  if v.id is null or not public.rs_fn_vaga_no_alcance(v_vaga.id, v_vaga.area_id, p_alcance) then return 'nao_encontrado'; end if;
  if exists (select 1 from public.rs_candidatos where id = v.candidato_id and anonimizado_em is not null) then return 'candidatura_encerrada'; end if;
  if p_tipo <> 'enviar_mensagem' and v.situacao <> 'ativa' then return 'candidatura_encerrada'; end if;
  return null;
end $$;

-- Decide na hora, pelo formulário de decisões (rs_fn_decide): o membro que clicou é o ator.
-- Confere o alvo e executa. Recebe: empresa, tipo, candidatura, vaga, payload, mensagens, alcance e
-- ator. Devolve: quantas candidaturas mudaram.
create function public.rs_fn_decide(p_empresa uuid, p_tipo public.rs_tipo_decisao, p_candidatura uuid, p_vaga uuid,
  p_payload jsonb, p_mensagens jsonb, p_alcance jsonb, p_ator jsonb) returns integer
language plpgsql set search_path = '' as $$
declare v_motivo text;
begin
  if p_ator ->> 'tipo' <> 'membro' then
    raise exception 'decisao_so_por_pessoa' using errcode = 'P0001';
  end if;
  v_motivo := public.rs_fn_alvo_da_decisao(p_empresa, p_tipo, p_candidatura, p_vaga, p_alcance);
  if v_motivo is not null then
    raise exception '%', case when v_motivo = 'nao_encontrado' then 'nao_encontrado' else 'transicao_proibida' end using errcode = 'P0001';
  end if;
  return public.rs_fn_executa_decisao(p_empresa, p_tipo, p_candidatura, p_vaga, p_payload, p_mensagens, p_ator, null);
end $$;

-- ---------------------------------------------------------------- propostas (11.7, 12.3)
-- Cria uma proposta pendente (API v1 com escopo decisao, ou propor_decisao sem formulário). Nunca
-- executa. Uma pendente por alvo (índice). Recebe: empresa, tipo, candidatura, vaga, payload,
-- justificativa, ator (api ou agente, com a credencial) e alcance. Devolve o id.
create function public.rs_fn_propoe_decisao(p_empresa uuid, p_tipo public.rs_tipo_decisao, p_candidatura uuid, p_vaga uuid,
  p_payload jsonb, p_justificativa text, p_ator jsonb, p_alcance jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  v_id uuid;
  v_vaga uuid := p_vaga;
  v_motivo text;
begin
  if p_ator ->> 'tipo' not in ('api', 'agente') or p_ator ->> 'credencial_id' is null then
    raise exception 'ator_invalido' using errcode = 'P0001';
  end if;
  v_motivo := public.rs_fn_alvo_da_decisao(p_empresa, p_tipo, p_candidatura, p_vaga, p_alcance);
  if v_motivo is not null then
    raise exception '%', case when v_motivo = 'nao_encontrado' then 'nao_encontrado' else 'transicao_proibida' end using errcode = 'P0001';
  end if;
  if p_tipo = 'encerrar_vaga' then p_candidatura := null;
  else select vaga_id into v_vaga from public.rs_candidaturas where id = p_candidatura; end if;
  begin
    insert into public.rs_decisoes (empresa_id, tipo, candidatura_id, vaga_id, payload, justificativa, proposta_por_tipo,
                                    proposta_por_membro_id, credencial_id)
    values (p_empresa, p_tipo, p_candidatura, case when p_tipo = 'encerrar_vaga' then p_vaga else v_vaga end, coalesce(p_payload, '{}'),
            nullif(pg_catalog.btrim(coalesce(p_justificativa, '')), ''), (p_ator ->> 'tipo')::public.rs_tipo_ator,
            (p_ator ->> 'membro_id')::uuid, (p_ator ->> 'credencial_id')::uuid)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'proposta_existente' using errcode = 'P0001';
  end;
  perform public.rs_fn_registra_evento(p_empresa, v_vaga, p_candidatura, 'decisao_proposta', p_ator, 'web',
    pg_catalog.jsonb_build_object('decisao_id', v_id, 'tipo', p_tipo));
  return v_id;
end $$;

-- Confirma uma proposta pelo clique de um membro (rs_fn_confirma_decisao). Vencida ou com o alvo
-- mudado vira expirada e não executa; senão executa com o texto editado, tudo na mesma transação.
-- Recebe: decisão, empresa, alcance, payload editado, mensagens e ator (o membro). Devolve
-- {status, motivo?}.
create function public.rs_fn_confirma_decisao(p_decisao uuid, p_empresa uuid, p_alcance jsonb, p_payload jsonb, p_mensagens jsonb, p_ator jsonb)
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
  if d.id is null then
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

-- Descarta uma proposta (12.3), com motivo opcional. Recebe: decisão, empresa, alcance, motivo e ator.
create function public.rs_fn_descarta_decisao(p_decisao uuid, p_empresa uuid, p_alcance jsonb, p_motivo text, p_ator jsonb) returns void
language plpgsql set search_path = '' as $$
declare d public.rs_decisoes;
begin
  if p_ator ->> 'tipo' <> 'membro' then
    raise exception 'decisao_so_por_pessoa' using errcode = 'P0001';
  end if;
  select * into d from public.rs_decisoes where id = p_decisao and empresa_id = p_empresa for update;
  if d.id is null or public.rs_fn_alvo_da_decisao(p_empresa, d.tipo, d.candidatura_id, d.vaga_id, p_alcance) = 'nao_encontrado' then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if d.status <> 'pendente' then
    raise exception 'proposta_invalida' using errcode = 'P0001';
  end if;
  update public.rs_decisoes set status = 'descartada', decidida_por_membro_id = (p_ator ->> 'membro_id')::uuid, decidida_em = pg_catalog.now()
   where id = d.id;
  perform public.rs_fn_registra_evento(p_empresa, d.vaga_id, d.candidatura_id, 'decisao_descartada', p_ator, 'web',
    pg_catalog.jsonb_build_object('decisao_id', d.id, 'tipo', d.tipo));
end $$;

-- Faxina (12.3): propostas pendentes vencidas viram expiradas, em lote. Devolve quantas.
create function public.rs_fn_faxina_decisoes(p_lote integer) returns integer
language plpgsql set search_path = '' as $$
declare
  d record;
  v_n integer := 0;
begin
  for d in select id, empresa_id, vaga_id, candidatura_id from public.rs_decisoes
            where status = 'pendente' and expira_em <= pg_catalog.now() order by expira_em limit p_lote for update skip locked loop
    update public.rs_decisoes set status = 'expirada', decidida_em = pg_catalog.now() where id = d.id;
    perform public.rs_fn_registra_evento(d.empresa_id, d.vaga_id, d.candidatura_id, 'decisao_expirada',
      '{"tipo":"sistema","origem":"cron"}', 'cron', pg_catalog.jsonb_build_object('decisao_id', d.id, 'motivo', 'venceu'));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ---------------------------------------------------------------- revisão (11.13)
-- Pedido de revisão do candidato: uma vez, só para reprovada ou encerrada_vaga ainda não expurgada,
-- texto opcional de até 1.000. Recebe: candidatura e texto. Devolve a vaga (para avisar o responsável).
create function public.rs_fn_pede_revisao(p_candidatura uuid, p_texto text) returns uuid
language plpgsql set search_path = '' as $$
declare v public.rs_candidaturas;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura for update;
  if v.id is null or exists (select 1 from public.rs_candidatos where id = v.candidato_id and anonimizado_em is not null) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if v.situacao not in ('reprovada', 'encerrada_vaga') or v.revisao_pedida_em is not null
     or (v.expurgar_em is not null and v.expurgar_em <= pg_catalog.now()) then
    raise exception 'revisao_indisponivel' using errcode = 'P0001';
  end if;
  if pg_catalog.char_length(coalesce(p_texto, '')) > 1000 then
    raise exception 'revisao_texto_longo' using errcode = 'P0001';
  end if;
  update public.rs_candidaturas set revisao_pedida_em = pg_catalog.now(), revisao_texto = nullif(pg_catalog.btrim(coalesce(p_texto, '')), '')
   where id = p_candidatura;
  perform public.rs_fn_registra_evento(v.empresa_id, v.vaga_id, p_candidatura, 'revisao_pedida',
    '{"tipo":"candidato","origem":"publico"}', 'publico', pg_catalog.jsonb_build_object('candidatura_id', p_candidatura));
  return v.vaga_id;
end $$;

-- Resposta da empresa ao pedido de revisão: mensagem resposta_revisao e, se pedido, a reabertura
-- (é decisão: o servidor só manda reabrir quando veio do formulário). Recebe: candidatura, empresa,
-- alcance, mensagem, se reabre e o ator.
create function public.rs_fn_responde_revisao(p_candidatura uuid, p_empresa uuid, p_alcance jsonb, p_mensagem jsonb, p_reabrir boolean, p_ator jsonb)
returns void
language plpgsql set search_path = '' as $$
declare
  v public.rs_candidaturas;
  v_vaga public.rs_vagas;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa for update;
  select * into v_vaga from public.rs_vagas where id = v.vaga_id;
  if v.id is null or not public.rs_fn_vaga_no_alcance(v_vaga.id, v_vaga.area_id, p_alcance) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if v.revisao_pedida_em is null or v.revisao_respondida_em is not null then
    raise exception 'revisao_indisponivel' using errcode = 'P0001';
  end if;
  if p_reabrir and p_ator ->> 'tipo' <> 'membro' then
    raise exception 'decisao_so_por_pessoa' using errcode = 'P0001';
  end if;
  perform public.rs_fn_envia_mensagem(p_candidatura, p_empresa, 'resposta_revisao', p_mensagem, p_ator, null, null);
  update public.rs_candidaturas set revisao_respondida_em = pg_catalog.now() where id = p_candidatura;
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'revisao_respondida', p_ator, 'web',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura, 'reaberta', coalesce(p_reabrir, false)));
  if p_reabrir then
    perform public.rs_fn_reabre_candidatura(p_candidatura, p_empresa, p_alcance, p_ator);
  end if;
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
