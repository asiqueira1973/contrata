-- Contrata — épico 8.4, candidatura e link de acompanhamento (spec.md v0.4.4, seções 6.2, 7.3–7.5,
-- 11.2–11.5, 11.10, 11.12–11.14, 12.2 e 20.3). Convenções do 8.1: plpgsql, SECURITY INVOKER,
-- search_path = '', EXECUTE só para service_role, evento na mesma transação, erro P0001 = código.
-- O servidor valida antes com o schema zod da 11.2 (src/lib/schemas/applications.ts); aqui ficam
-- as invariantes: vaga aberta, uma candidatura por pessoa e vaga, perguntas da vaga, concluir uma
-- vez só, máquina 12.2, devolutiva obrigatória, código de exclusão e anonimização (7.4).

-- ---------------------------------------------------------------- colunas e tabela novas (v0.4.4)
-- recebida_em: nula até concluir (upload terminado ou vaga sem currículo). A empresa só vê as
-- recebidas (9.4). Código de exclusão (11.13): 6 dígitos, só o hash, 10 min, 5 tentativas,
-- 5 códigos por hora.
alter table public.rs_candidaturas
  add column recebida_em timestamptz,
  add column exclusao_codigo_hash text,
  add column exclusao_expira_em timestamptz,
  add column exclusao_tentativas smallint not null default 0,
  add column exclusao_codigos_hora smallint not null default 0,
  add column exclusao_janela_desde timestamptz;
create index rs_candidaturas_nao_recebidas on public.rs_candidaturas (criado_em) where recebida_em is null;

-- Tentativas públicas para os limites por IP (11.14), janela deslizante. Nunca o IP: só o HMAC
-- dele (o servidor calcula com SESSION_SECRET). A faxina apaga o que tem mais de 24 h.
create table public.rs_tentativas_publicas (
  id bigint generated always as identity primary key,
  chave_hash text not null constraint rs_tentativas_chave check (char_length(chave_hash) between 16 and 128),
  tipo text not null constraint rs_tentativas_tipo check (tipo in ('candidatura', 'links', 'links_email')),
  criado_em timestamptz not null default now()
);
create index rs_tentativas_janela on public.rs_tentativas_publicas (tipo, chave_hash, criado_em);
create index rs_tentativas_idade on public.rs_tentativas_publicas (criado_em);
alter table public.rs_tentativas_publicas enable row level security;
revoke all on table public.rs_tentativas_publicas from anon, authenticated;
revoke all on sequence public.rs_tentativas_publicas_id_seq from anon, authenticated;

-- ---------------------------------------------------------------- limite por IP (11.14)
-- Conta uma tentativa na janela deslizante. Recebe: chave (HMAC), tipo, limite e janela em
-- segundos. Devolve true se cabe (e registra) ou false (não registra). Serializa por chave.
create function public.rs_fn_conta_tentativa(p_chave text, p_tipo text, p_limite integer, p_janela_s integer)
returns boolean
language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_tipo || ':' || p_chave));
  if (select count(*) from public.rs_tentativas_publicas
      where tipo = p_tipo and chave_hash = p_chave
        and criado_em > pg_catalog.now() - pg_catalog.make_interval(secs => p_janela_s)) >= p_limite then
    return false;
  end if;
  insert into public.rs_tentativas_publicas (chave_hash, tipo) values (p_chave, p_tipo);
  return true;
end $$;

-- ---------------------------------------------------------------- criar (11.2, 11.3, 11.10)
-- Cria a candidatura (ainda não recebida). Recebe: empresa, vaga, candidato {nome, email,
-- telefone?, linkedin_url?, cidade?}, respostas [{pergunta_id, valor}], origem, ator, versão do
-- aviso aceito, consentimento de talentos, hash do token novo e o limite por vaga (limits.ts).
-- Duplicada (mesmo e-mail na vaga): troca o token (para reenviar o link) e devolve a existente.
-- Devolve {id, existente, recebida}.
create function public.rs_fn_cria_candidatura(
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
      -- 11.3: não cria outra nem muda a candidatura; só troca o token para o link ser reenviado.
      update public.rs_candidaturas set token_hash = p_token_hash where id = v_existente.id;
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
  else
    -- A pessoa manda os dados mais novos; campos opcionais vazios não apagam o que já existe.
    update public.rs_candidatos set nome = p_candidato ->> 'nome',
           telefone = coalesce(nullif(p_candidato ->> 'telefone', ''), telefone),
           linkedin_url = coalesce(nullif(p_candidato ->> 'linkedin_url', ''), linkedin_url),
           cidade = coalesce(nullif(p_candidato ->> 'cidade', ''), cidade)
     where id = v_candidato;
  end if;
  if p_talentos then
    update public.rs_candidatos set talentos_consentido_em = pg_catalog.now(),
           talentos_expira_em = pg_catalog.now() + pg_catalog.make_interval(months => v_empresa.talentos_meses)
     where id = v_candidato;
  end if;
  select id into v_etapa from public.rs_etapas where vaga_id = p_vaga order by ordem limit 1;
  insert into public.rs_candidaturas (empresa_id, vaga_id, candidato_id, etapa_id, origem, token_hash,
                                      consentimento_versao, consentimento_em)
  values (p_empresa, p_vaga, v_candidato, v_etapa, p_origem, p_token_hash, p_consentimento, pg_catalog.now())
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
  if p_talentos then
    perform public.rs_fn_registra_evento(p_empresa, p_vaga, v_id, 'talentos_consentido', p_ator, 'publico',
      pg_catalog.jsonb_build_object('candidatura_id', v_id));
  end if;
  return pg_catalog.jsonb_build_object('id', v_id, 'existente', false, 'recebida', false);
end $$;

-- ---------------------------------------------------------------- busca (11.28)
-- Recalcula o texto de busca: nome, e-mail, cidade, respostas e o texto do currículo.
create function public.rs_fn_atualiza_busca(p_candidatura uuid) returns void
language plpgsql set search_path = '' as $$
begin
  update public.rs_candidaturas c set texto_busca = pg_catalog.to_tsvector('pg_catalog.portuguese', extensions.unaccent(
    coalesce(k.nome, '') || ' ' || coalesce(k.email::text, '') || ' ' || coalesce(k.cidade, '') || ' ' ||
    coalesce((select pg_catalog.string_agg(r.valor, ' ') from public.rs_respostas r where r.candidatura_id = c.id), '') || ' ' ||
    coalesce((select a.texto_extraido from public.rs_arquivos a where a.candidatura_id = c.id and a.tipo = 'curriculo'), '')))
    from public.rs_candidatos k
   where c.id = p_candidatura and k.id = c.candidato_id;
end $$;

-- ---------------------------------------------------------------- concluir (9.2)
-- Conclui a candidatura: confirma o currículo (se houver), marca recebida, grava a mensagem de
-- confirmação (o corpo guarda {{link_acompanhamento}}, nunca o link, 20.3) e a notificação que
-- leva o link (apagada depois do envio), e o evento candidatura_criada. Uma vez só.
-- Recebe: candidatura, empresa, arquivo {path, nome_original, mime, bytes, sha256} ou nulo,
-- mensagem {assunto, corpo}, notificação {tipo, destinatario, chave, assunto, html, texto, reply_to}
-- e o ator. Devolve {notificacao_id, arquivo_id} (ou {ja_recebida: true}).
create function public.rs_fn_conclui_candidatura(p_candidatura uuid, p_empresa uuid, p_arquivo jsonb,
  p_mensagem jsonb, p_notificacao jsonb, p_ator jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v public.rs_candidaturas;
  v_obrigatorio boolean;
  v_arquivo uuid;
  v_notificacao uuid;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa for update;
  if v.id is null then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  if v.recebida_em is not null then
    return pg_catalog.jsonb_build_object('ja_recebida', true);
  end if;
  select curriculo_obrigatorio into v_obrigatorio from public.rs_vagas where id = v.vaga_id;
  if v_obrigatorio and p_arquivo is null then
    raise exception 'curriculo_obrigatorio' using errcode = 'P0001';
  end if;
  if p_arquivo is not null then
    delete from public.rs_arquivos where candidatura_id = p_candidatura and tipo = 'curriculo';
    insert into public.rs_arquivos (empresa_id, candidatura_id, tipo, path, nome_original, mime, bytes, sha256, confirmado_em)
    values (p_empresa, p_candidatura, 'curriculo', p_arquivo ->> 'path', p_arquivo ->> 'nome_original', p_arquivo ->> 'mime',
            (p_arquivo ->> 'bytes')::integer, p_arquivo ->> 'sha256', pg_catalog.now())
    returning id into v_arquivo;
  end if;
  update public.rs_candidaturas set recebida_em = pg_catalog.now(), movida_em = pg_catalog.now() where id = p_candidatura;
  insert into public.rs_notificacoes (empresa_id, candidatura_id, tipo, destinatario, chave_idempotencia, assunto, html, texto, reply_to)
  values (p_empresa, p_candidatura, (p_notificacao ->> 'tipo')::public.rs_tipo_notificacao, p_notificacao ->> 'destinatario',
          p_notificacao ->> 'chave', p_notificacao ->> 'assunto', p_notificacao ->> 'html', p_notificacao ->> 'texto',
          nullif(p_notificacao ->> 'reply_to', ''))
  returning id into v_notificacao;
  insert into public.rs_mensagens (empresa_id, candidatura_id, tipo, assunto, corpo, ator_tipo, notificacao_id)
  values (p_empresa, p_candidatura, 'confirmacao', p_mensagem ->> 'assunto', p_mensagem ->> 'corpo', 'sistema', v_notificacao);
  perform public.rs_fn_atualiza_busca(p_candidatura);
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'candidatura_criada', p_ator, 'publico',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura, 'origem', v.origem, 'com_curriculo', p_arquivo is not null,
      'sinalizada', v.sinalizada));
  return pg_catalog.jsonb_build_object('notificacao_id', v_notificacao, 'arquivo_id', v_arquivo);
end $$;

-- Grava o resultado da extração do currículo (8.4, em segundo plano) e recalcula a busca.
create function public.rs_fn_grava_extracao(p_arquivo uuid, p_status public.rs_status_extracao, p_texto text) returns void
language plpgsql set search_path = '' as $$
declare v_candidatura uuid;
begin
  update public.rs_arquivos set extracao_status = p_status, texto_extraido = pg_catalog.left(p_texto, 100000)
   where id = p_arquivo returning candidatura_id into v_candidatura;
  if v_candidatura is not null then
    perform public.rs_fn_atualiza_busca(v_candidatura);
  end if;
end $$;

-- ---------------------------------------------------------------- encerrar (12.2, 11.5, 11.12)
-- Tira a candidatura de ativa (rs_fn_encerra_candidatura, 7.5): situação final, encerrada_em,
-- expurgar_em pela retenção da empresa, mensagem e notificação na mesma transação, evento.
-- Reprovada e encerrada_vaga exigem a devolutiva (11.5; épico 8.6). Candidatura de pessoa
-- anonimizada não transita mais. Recebe: candidatura, empresa, situação, ator, motivo interno,
-- mensagem {tipo, assunto, corpo, notificacao: {...}} ou nulo, e dados extras do evento.
create function public.rs_fn_encerra_candidatura(p_candidatura uuid, p_empresa uuid, p_situacao public.rs_situacao_candidatura,
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
  if p_situacao in ('reprovada', 'encerrada_vaga') and p_mensagem is null then
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

-- ---------------------------------------------------------------- anonimizar e excluir (7.4, 11.13)
-- Anonimiza uma candidatura: apaga arquivos (devolve os caminhos para o servidor apagar no
-- armazenamento depois do commit), respostas e notas; avaliações ficam com o comentário vazio;
-- mensagens ficam sem assunto e corpo; notificações pendentes são descartadas; o link deixa de
-- valer. Fica a linha (vaga, etapa, datas, origem, situação). Devolve: os caminhos.
create function public.rs_fn_anonimiza_candidatura(p_candidatura uuid, p_empresa uuid) returns text[]
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
  update public.rs_candidaturas set texto_busca = null, sinalizada = false, exclusao_codigo_hash = null,
         token_hash = 'anonimizada:' || id::text
   where id = p_candidatura;
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'candidatura_anonimizada',
    pg_catalog.jsonb_build_object('tipo', 'sistema'), 'publico', pg_catalog.jsonb_build_object('candidatura_id', p_candidatura));
  return v_paths;
end $$;

-- Exclui os dados da pessoa na empresa a pedido do titular (rs_fn_exclui_dados_candidato, 11.13):
-- encerra as ativas como desistiu (sem e-mail), retira o consentimento de talentos, anonimiza todas
-- as candidaturas dela na empresa e o cadastro. Recebe: a candidatura do link e a empresa.
-- Devolve: os caminhos de arquivo para apagar.
create function public.rs_fn_exclui_dados_candidato(p_candidatura uuid, p_empresa uuid) returns text[]
language plpgsql set search_path = '' as $$
declare
  v public.rs_candidaturas;
  v_outra record;
  v_paths text[] := '{}';
  v_ator jsonb := pg_catalog.jsonb_build_object('tipo', 'candidato', 'origem', 'publico');
begin
  select * into v from public.rs_candidaturas where id = p_candidatura and empresa_id = p_empresa for update;
  if v.id is null or exists (select 1 from public.rs_candidatos where id = v.candidato_id and anonimizado_em is not null) then
    raise exception 'nao_encontrado' using errcode = 'P0001';
  end if;
  for v_outra in select id from public.rs_candidaturas where candidato_id = v.candidato_id and empresa_id = p_empresa
                 and situacao = 'ativa' and recebida_em is not null loop
    perform public.rs_fn_encerra_candidatura(v_outra.id, p_empresa, 'desistiu', v_ator, null, null,
      pg_catalog.jsonb_build_object('por_exclusao', true));
  end loop;
  perform public.rs_fn_registra_evento(p_empresa, v.vaga_id, p_candidatura, 'dados_excluidos', v_ator, 'publico',
    pg_catalog.jsonb_build_object('candidatura_id', p_candidatura));
  for v_outra in select id from public.rs_candidaturas where candidato_id = v.candidato_id and empresa_id = p_empresa loop
    v_paths := v_paths || public.rs_fn_anonimiza_candidatura(v_outra.id, p_empresa);
  end loop;
  update public.rs_candidatos set nome = 'Pessoa removida', email = null, telefone = null, linkedin_url = null, cidade = null,
         talentos_consentido_em = null, talentos_expira_em = null, anonimizado_em = pg_catalog.now()
   where id = v.candidato_id;
  return v_paths;
end $$;

-- ---------------------------------------------------------------- código de exclusão (11.13)
-- Gera um código novo (o servidor manda o hash). Recebe: candidatura, hash, validade, intervalo
-- mínimo entre códigos e o máximo por hora. Devolve: ok | aguarde | limite_hora | indisponivel.
create function public.rs_fn_novo_codigo_exclusao(p_candidatura uuid, p_codigo_hash text, p_validade_s integer,
  p_intervalo_s integer, p_max_hora integer) returns text
language plpgsql set search_path = '' as $$
declare v public.rs_candidaturas;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura for update;
  if v.id is null or exists (select 1 from public.rs_candidatos where id = v.candidato_id and anonimizado_em is not null) then
    return 'indisponivel';
  end if;
  if v.exclusao_janela_desde is null or v.exclusao_janela_desde < pg_catalog.now() - interval '1 hour' then
    v.exclusao_janela_desde := pg_catalog.now();
    v.exclusao_codigos_hora := 0;
  end if;
  if v.exclusao_codigos_hora >= p_max_hora then
    return 'limite_hora';
  end if;
  if v.exclusao_expira_em is not null
     and v.exclusao_expira_em - pg_catalog.make_interval(secs => p_validade_s) + pg_catalog.make_interval(secs => p_intervalo_s) > pg_catalog.now() then
    return 'aguarde';
  end if;
  update public.rs_candidaturas set exclusao_codigo_hash = p_codigo_hash,
         exclusao_expira_em = pg_catalog.now() + pg_catalog.make_interval(secs => p_validade_s),
         exclusao_tentativas = 0, exclusao_codigos_hora = v.exclusao_codigos_hora + 1, exclusao_janela_desde = v.exclusao_janela_desde
   where id = p_candidatura;
  return 'ok';
end $$;

-- Confere o código. Recebe: candidatura, hash do código digitado e o máximo de tentativas.
-- Devolve: ok (e apaga o código) | errado:{restantes} | bloqueado | expirado | sem_codigo.
-- Não levanta erro: a tentativa errada precisa ficar gravada.
create function public.rs_fn_valida_codigo_exclusao(p_candidatura uuid, p_codigo_hash text, p_max_tentativas integer) returns text
language plpgsql set search_path = '' as $$
declare v public.rs_candidaturas;
begin
  select * into v from public.rs_candidaturas where id = p_candidatura for update;
  if v.id is null or v.exclusao_codigo_hash is null then
    return 'sem_codigo';
  end if;
  if v.exclusao_expira_em < pg_catalog.now() then
    return 'expirado';
  end if;
  if v.exclusao_tentativas >= p_max_tentativas then
    return 'bloqueado';
  end if;
  if v.exclusao_codigo_hash <> p_codigo_hash then
    update public.rs_candidaturas set exclusao_tentativas = exclusao_tentativas + 1,
           exclusao_codigo_hash = case when exclusao_tentativas + 1 >= p_max_tentativas then null else exclusao_codigo_hash end
     where id = p_candidatura;
    if v.exclusao_tentativas + 1 >= p_max_tentativas then
      return 'bloqueado';
    end if;
    return 'errado:' || (p_max_tentativas - v.exclusao_tentativas - 1)::text;
  end if;
  update public.rs_candidaturas set exclusao_codigo_hash = null, exclusao_expira_em = null where id = p_candidatura;
  return 'ok';
end $$;

-- ---------------------------------------------------------------- faxina (9.4)
-- Apaga candidaturas não recebidas com mais de 24 h (o upload não terminou), em lote, e o cadastro
-- que ficou sem candidatura e sem consentimento de talentos; e as tentativas com mais de 24 h.
-- Devolve: os prefixos {empresa}/{candidatura}/ para apagar no armazenamento.
create function public.rs_fn_faxina_candidaturas_abandonadas(p_lote integer) returns text[]
language plpgsql set search_path = '' as $$
declare
  v record;
  v_prefixos text[] := '{}';
begin
  for v in select id, empresa_id, candidato_id from public.rs_candidaturas
            where recebida_em is null and criado_em < pg_catalog.now() - interval '24 hours'
            order by criado_em limit p_lote for update skip locked loop
    v_prefixos := v_prefixos || (v.empresa_id::text || '/' || v.id::text || '/');
    delete from public.rs_candidaturas where id = v.id;
    delete from public.rs_candidatos k where k.id = v.candidato_id and k.talentos_consentido_em is null
       and not exists (select 1 from public.rs_candidaturas c where c.candidato_id = k.id);
  end loop;
  delete from public.rs_tentativas_publicas where criado_em < pg_catalog.now() - interval '24 hours';
  return v_prefixos;
end $$;

-- ---------------------------------------------------------------- máquina 12.1 com a trava (pendência do 8.3)
-- Igual à do 8.3, mais: trava a empresa antes de contar as publicadas (duas publicações ao mesmo
-- tempo não passam de 50, 11.14) e só candidatura recebida impede encerrar.
create or replace function public.rs_fn_transicao_vaga(p_vaga uuid, p_empresa uuid, p_para public.rs_status_vaga,
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
    perform 1 from public.rs_empresas where id = p_empresa for update;
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
    if exists (select 1 from public.rs_candidaturas where vaga_id = p_vaga and situacao = 'ativa' and recebida_em is not null) then
      raise exception 'vaga_com_ativas' using errcode = 'P0001';
    end if;
    update public.rs_vagas set status = 'encerrada', encerrada_em = pg_catalog.now(), motivo_encerramento = p_motivo
     where id = p_vaga;
    perform public.rs_fn_registra_evento(p_empresa, p_vaga, null, 'vaga_encerrada', p_ator, 'web',
      pg_catalog.jsonb_build_object('vaga_id', p_vaga, 'motivo', p_motivo));
  end if;
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
