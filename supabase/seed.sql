-- Seed só local (seção 7.6): "Padaria Exemplo" para testes manuais e screenshots.
-- No 8.1: duas áreas (Loja, Administrativo), quatro pessoas (duas sem acesso) e três membros
-- (administradora, recrutador limitado à Loja, avaliador). Vagas e candidaturas entram no 8.3/8.4.
-- Usuários fictícios: o login de verdade é pelo Google; em dev, scripts/dev-session.mjs abre a sessão.
do $$
declare
  v_carla uuid; v_ana uuid; v_bruno uuid; v_empresa uuid; v_m_carla uuid; v_loja uuid; v_adm uuid;
  v_dora uuid; v_eva uuid; v_ator jsonb;
begin
  insert into public.rs_usuarios (email, nome, google_sub, termos_aceitos_em) values
    ('carla@padaria.exemplo', 'Carla Souza', 'seed-carla', now()) returning id into v_carla;
  insert into public.rs_usuarios (email, nome, google_sub, termos_aceitos_em) values
    ('ana@padaria.exemplo', 'Ana Lima', 'seed-ana', now()) returning id into v_ana;
  insert into public.rs_usuarios (email, nome, google_sub, termos_aceitos_em) values
    ('bruno@padaria.exemplo', 'Bruno Costa', 'seed-bruno', now()) returning id into v_bruno;

  v_empresa := public.rs_fn_cria_empresa(v_carla, 'padaria-exemplo', 'Padaria Exemplo', 'rh@padaria.exemplo');
  select id into v_m_carla from public.rs_membros where empresa_id = v_empresa and usuario_id = v_carla;
  v_ator := jsonb_build_object('tipo', 'membro', 'membro_id', v_m_carla);

  v_dora := public.rs_fn_salva_pessoa(v_empresa, null, 'Dora Martins', 'dora@padaria.exemplo', 'Gerente da loja', null, true, v_ator);
  v_eva := public.rs_fn_salva_pessoa(v_empresa, null, 'Eva Rocha', 'eva@padaria.exemplo', 'Coordenadora financeira', null, true, v_ator);
  v_loja := public.rs_fn_salva_area(v_empresa, null, 'Loja', v_dora, v_ator);
  v_adm := public.rs_fn_salva_area(v_empresa, null, 'Administrativo', v_eva, v_ator);
  perform public.rs_fn_salva_pessoa(v_empresa, v_dora, 'Dora Martins', 'dora@padaria.exemplo', 'Gerente da loja', v_loja, true, v_ator);
  perform public.rs_fn_salva_pessoa(v_empresa, v_eva, 'Eva Rocha', 'eva@padaria.exemplo', 'Coordenadora financeira', v_adm, true, v_ator);

  perform public.rs_fn_aceita_convite(public.rs_fn_convida_membro(v_empresa, 'ana@padaria.exemplo', 'recrutador', false,
    array[v_loja], 'seed-convite-ana', now() + interval '7 days', 50, v_ator), v_ana);
  perform public.rs_fn_aceita_convite(public.rs_fn_convida_membro(v_empresa, 'bruno@padaria.exemplo', 'avaliador', true,
    '{}', 'seed-convite-bruno', now() + interval '7 days', 50, v_ator), v_bruno);
  -- Um convite pendente, para a tela Equipe mostrar o estado.
  perform public.rs_fn_convida_membro(v_empresa, 'fabio@padaria.exemplo', 'avaliador', true, '{}',
    'seed-convite-fabio', now() + interval '7 days', 50, v_ator);
end $$;
