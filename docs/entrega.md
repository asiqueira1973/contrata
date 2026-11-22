# Entrega (spec 26 e 27)

O código cumpre os critérios de 8.0 a 8.12 no local, com `npm run verify` verde e as migrations aplicadas no remoto. O que falta depende de contas reais e fica com o Alexandre. Cada item tem o roteiro para fechar.

## 1. Publicar a instância oficial
- [ ] Repositório público no GitHub (`asiqueira1973/contrata`, ou o nome definitivo; se mudar, troque `URL_CODIGO` em `src/lib/copy.ts` e o `git clone` do README).
- [ ] Projeto na Vercel ligado ao repositório, com o domínio `vagaaberta.app.br` (DNS apontado e HTTPS emitido).
- [ ] Variáveis de Production, todas as da tabela do README. Na instância oficial: `NEXT_PUBLIC_SITE_URL=https://vagaaberta.app.br`, `EMAIL_REMETENTE=naoresponda@vagaaberta.app.br`, `OPERADOR_NOME` (DabLab, razão social do `LICENSE`), `OPERADOR_CONTATO`, `CRIACAO_EMPRESA_EMAILS` com o seu e-mail e `CHAVES_ENC_KEY` gerada na hora.
- [ ] Cliente OAuth do Google com o redirect `https://vagaaberta.app.br/api/auth/google/callback`.
- [ ] Bucket R2 privado, token restrito ao bucket e CORS de `PUT` para `https://vagaaberta.app.br`.
- [ ] Domínio verificado no Resend (SPF, DKIM, DMARC).
- [ ] O cron aparece em **Vercel → Settings → Cron Jobs** e a primeira rodada deixa `faxina_diaria` no log.
- [ ] Opcional: `VISAO_INGEST_URL` e `VISAO_API_KEY` do projeto "Contrata" no Visão do Produto.

## 2. Fluxos reais (spec 9)
- [ ] **9.1 no claude.ai:** conectar `https://vagaaberta.app.br/mcp`, criar a empresa fictícia, áreas, pessoas, convite, vaga, publicação, candidaturas pelo celular (com currículo), resumo, notas, mover, reprovar com devolutiva (e-mails reais), avaliação, contratar e encerrar.
- [ ] **9.1 no ChatGPT:** o mesmo, com o Bruno avaliando pelo ChatGPT do celular.
- [ ] **9.2 por `curl`:** `GET /api/publico/{empresa}/vagas`, `POST …/candidaturas`, `PUT` no `upload_url`, `POST …/concluir`; o e-mail com o link chega.
- [ ] **9.3:** webhook recebido num endpoint real (n8n ou webhook.site), com a assinatura conferida pelo trecho do README.

## 3. Conferências
- [ ] JSON-LD de uma vaga publicada aprovado no [Teste de Pesquisa Aprimorada](https://search.google.com/test/rich-results).
- [ ] Modo escuro em todos os formulários no Claude e no ChatGPT, e nas páginas web da 10.1 (estas também a 375 px).
- [ ] Uma auto-hospedagem do zero seguindo só o README, num projeto Supabase e numa conta Vercel separados. Anote o que faltou e corrija o README.
- [ ] Revisão jurídica de `/privacidade`, `/termos` e do aviso de privacidade da candidatura.
