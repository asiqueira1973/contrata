# Entrega (spec 26 e 27)

O código cumpre os critérios de 8.0 a 8.12 no local, com `npm run verify` verde e as migrations aplicadas no remoto. O que falta depende de contas reais e fica com o Alexandre. Cada item tem o roteiro para fechar.

## 1. Publicar a instância oficial
Em 23/11/2026: repositório `asiqueira1973/contrata` público, projeto `vaga-aberta` na Vercel com deploy de produção no ar em https://vagaaberta.app.br (páginas, `/mcp` com OAuth, `/api/v1/openapi.json` e login pelo Google respondendo). Variáveis de produção já postas: segredos gerados, Supabase, Google, `CRIACAO_EMPRESA_EMAILS`, `ADMIN_EMAIL`, `OPERADOR_NOME`, `EMAIL_REMETENTE`, `S3_REGION` e `S3_BUCKET`. R2 e Resend configurados no mesmo dia: candidatura com currículo, leitura do currículo pelo Claude, confirmação e devolutiva por e-mail conferidas em produção.

- [x] Repositório público no GitHub (`asiqueira1973/contrata`, ou o nome definitivo; se mudar, troque `URL_CODIGO` em `src/lib/copy.ts` e o `git clone` do README).
- [x] Projeto na Vercel ligado ao repositório, com o domínio `vagaaberta.app.br` (DNS apontado e HTTPS emitido).
- [ ] Variáveis de Production, todas as da tabela do README. Na instância oficial: `NEXT_PUBLIC_SITE_URL=https://vagaaberta.app.br`, `EMAIL_REMETENTE=naoresponda@vagaaberta.app.br`, `OPERADOR_NOME` (DabLab, razão social do `LICENSE`), `OPERADOR_CONTATO`, `CRIACAO_EMPRESA_EMAILS` com o seu e-mail e `*` (instância aberta desde 23/11/2026), `CHAVES_ENC_KEY` gerada na hora, `ADMIN_EMAIL` (recebe os alertas da instância) e, se o plano do Supabase não for o gratuito, `ALERTA_BANCO_LIMITE_MB` com o tamanho do plano (no projeto compartilhado, o banco inteiro conta).
- [x] Cliente OAuth do Google com o redirect `https://vagaaberta.app.br/api/auth/google/callback`.
- [x] Bucket R2 privado, token restrito ao bucket e CORS de `PUT` para `https://vagaaberta.app.br`.
- [x] Domínio verificado no Resend (SPF, DKIM, DMARC).
- [ ] O cron aparece em **Vercel → Settings → Cron Jobs** e a primeira rodada deixa `faxina_diaria` no log.
- [x] **Product analytics (23/11/2026):** eventos renomeados para `vaga_aberta_*` (antes do primeiro envio) e `VISAO_INGEST_URL` e `VISAO_API_KEY` (Sensitive) postas na Vercel; a chave foi aceita pelo ingest (202). Conferir no Visão que os eventos chegam depois do primeiro uso.

- [ ] **Uso pelo `/mcp` (v0.4.20, 28/11/2026):** depois do deploy, quando aparecer um 400 no `/mcp`, abrir os logs da Vercel na mesma hora (o Hobby guarda 1 hora) e ler o `mcp_rejeitado`: método, `versao` e `erro`. O SDK v2 responde `server/discover` na 2026-07-28 quando o pedido traz o envelope `_meta` e o cabeçalho `Mcp-Method`; se o 400 for do `server/discover`, o `erro` diz o que faltou, e o caso segue aberto. Conferir também no Visão do Produto que `vaga_aberta_api_chamada` com `porta: mcp` some quando ninguém usa.

## 2. Fluxos reais (spec 9)
- [ ] **9.1 no claude.ai:** conectar `https://vagaaberta.app.br/mcp`, criar a empresa fictícia, áreas, pessoas, convite, vaga, publicação, candidaturas pelo celular (com currículo), resumo, notas, mover, reprovar com devolutiva (e-mails reais), avaliação, contratar e encerrar.
- [ ] **9.1 no ChatGPT:** o mesmo, com o Bruno avaliando pelo ChatGPT do celular.
- [ ] **9.2 por `curl`:** `GET /api/publico/{empresa}/vagas`, `POST …/candidaturas`, `PUT` no `upload_url`, `POST …/concluir`; o e-mail com o link chega.
- [ ] **9.3 (adiado em 23/11/2026, a pedido do Alexandre):** webhook recebido num endpoint real (n8n ou webhook.site), com a assinatura conferida pelo trecho do README.

## 3. Conferências
- [x] JSON-LD de uma vaga publicada aprovado no [Teste de Pesquisa Aprimorada](https://search.google.com/test/rich-results). (23/11/2026: 1 item válido de Job Postings, com avisos não críticos: salário oculto, sem endereço completo e sem logo.)
- [ ] Modo escuro em todos os formulários no Claude e no ChatGPT, e nas páginas web da 10.1 (estas também a 375 px).
- [ ] Uma auto-hospedagem do zero seguindo só o README, num projeto Supabase e numa conta Vercel separados. Anote o que faltou e corrija o README.
- [ ] Revisão jurídica de `/privacidade`, `/termos` e do aviso de privacidade da candidatura.
