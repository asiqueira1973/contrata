-- Seed só local (seção 7.6): "Padaria Exemplo" para testes manuais e screenshots.
-- No 8.1: duas áreas (Loja, Administrativo), quatro pessoas (duas sem acesso) e três membros
-- (administradora, recrutador limitado à Loja, avaliador). No 8.3: página de carreiras publicada e
-- quatro vagas (publicada presencial com salário, publicada remota, rascunho e pausada). Candidaturas: 8.4.
-- Usuários fictícios: o login de verdade é pelo Google; em dev, scripts/dev-session.mjs abre a sessão.
do $$
declare
  v_carla uuid; v_ana uuid; v_bruno uuid; v_empresa uuid; v_m_carla uuid; v_loja uuid; v_adm uuid;
  v_dora uuid; v_eva uuid; v_ator jsonb; v_vaga uuid; v_etapas jsonb;
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

  -- Página de carreiras e vagas (8.3)
  update public.rs_empresas set pagina_publicada = true,
    descricao = 'Padaria de bairro em Campinas desde 1998. Pão quente às 6h e gente boa no balcão.',
    site_url = 'https://padaria.exemplo' where id = v_empresa;
  v_etapas := '[{"nome":"Triagem","tipo":"triagem"},{"nome":"Entrevista com RH","tipo":"entrevista"},{"nome":"Entrevista com a gestão","tipo":"entrevista"},{"nome":"Proposta","tipo":"proposta"}]';
  v_vaga := (public.rs_fn_cria_vaga(v_empresa, jsonb_build_object(
    'titulo', 'Atendente de padaria', 'area_id', v_loja, 'modelo_trabalho', 'presencial', 'cidade', 'Campinas', 'uf', 'SP',
    'regime', 'clt', 'salario_min', 2800, 'salario_max', 3200, 'salario_periodo', 'mes', 'mostrar_salario', true,
    'descricao', E'Atender quem chega ao balcão com simpatia, montar a vitrine pela manhã e apoiar o caixa.\n\n- Escala 6x1, das 6h às 14h\n- Vale-transporte e refeição no local',
    'requisitos', E'Ensino médio completo.\n\nExperiência com atendimento é bem-vinda, mas não obrigatória.',
    'etapas', v_etapas,
    'perguntas', '[{"texto":"Pode trabalhar aos sábados?","tipo":"sim_nao","resposta_esperada":"sim"}]'::jsonb),
    '{"tipo":"todas"}', v_ator) ->> 'id')::uuid;
  perform public.rs_fn_transicao_vaga(v_vaga, v_empresa, 'publicada', null, '{"tipo":"todas"}', v_ator, 50);
  v_vaga := (public.rs_fn_cria_vaga(v_empresa, jsonb_build_object(
    'titulo', 'Analista financeiro', 'area_id', v_adm, 'modelo_trabalho', 'remoto', 'regime', 'pj',
    'descricao', E'Cuidar das contas a pagar e a receber, conciliar extratos e fechar o mês com a contabilidade externa.',
    'etapas', v_etapas), '{"tipo":"todas"}', v_ator) ->> 'id')::uuid;
  perform public.rs_fn_transicao_vaga(v_vaga, v_empresa, 'publicada', null, '{"tipo":"todas"}', v_ator, 50);
  perform public.rs_fn_cria_vaga(v_empresa, jsonb_build_object(
    'titulo', 'Confeiteiro', 'area_id', v_loja, 'modelo_trabalho', 'presencial', 'cidade', 'Campinas', 'uf', 'SP',
    'regime', 'clt', 'etapas', v_etapas), '{"tipo":"todas"}', v_ator);
  v_vaga := (public.rs_fn_cria_vaga(v_empresa, jsonb_build_object(
    'titulo', 'Auxiliar de limpeza', 'area_id', v_loja, 'modelo_trabalho', 'presencial', 'cidade', 'Campinas', 'uf', 'SP',
    'regime', 'clt', 'descricao', E'Manter a loja e a cozinha limpas e organizadas ao longo do turno, seguindo o plano de higiene.',
    'etapas', v_etapas), '{"tipo":"todas"}', v_ator) ->> 'id')::uuid;
  perform public.rs_fn_transicao_vaga(v_vaga, v_empresa, 'publicada', null, '{"tipo":"todas"}', v_ator, 50);
  perform public.rs_fn_transicao_vaga(v_vaga, v_empresa, 'pausada', null, '{"tipo":"todas"}', v_ator, 50);
end $$;
