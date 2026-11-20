# Contrata

**O sistema de recrutamento e seleção para agentes.** É um ATS de código aberto e gratuito, sem painel: quem recruta opera pelo Claude ou pelo ChatGPT com o conector do Contrata. Consultas são em linguagem natural; cadastro e decisões abrem um formulário dentro do chat, que a pessoa confere e confirma. Candidatos usam páginas web simples. Para automação, há API REST e webhooks.

**Clone e use:** cada empresa hospeda a própria instância; não há serviço aberto a terceiros. "Contrata" é nome de trabalho (spec, pergunta 25.1). Licença MIT.

A especificação completa está em [`spec.md`](spec.md); os planos de cada épico, em [`plans/`](plans/); o que existe de fato, em [`DOCUMENTACAO-TECNICA.md`](DOCUMENTACAO-TECNICA.md).

## Estado
Em implementação. Prontos: guardrails (8.0) e fundação (8.1): banco, login com Google e o domínio de empresa, equipe, convites, áreas e pessoas. As telas web provisórias do 8.1 saem no 8.2, quando o conector MCP com formulários chegar. O guia completo de auto-hospedagem entra no épico 8.12.

## Rodar localmente

Requisitos: Node 22, Docker, [Supabase CLI](https://supabase.com/docs/guides/cli), `jq`.

```bash
npm install
supabase start            # Supabase local nas portas 557xx; aplica migrations e o seed
cp .env.example .env.local
```

Preencha o `.env.local`:
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: saem de `supabase status`;
- `SESSION_SECRET`: `openssl rand -base64 32`;
- `CRIACAO_EMPRESA_EMAILS`: os e-mails (ou `@seudominio.com.br`) que podem criar empresa. **Vazia, ninguém cria**;
- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`: veja abaixo.

```bash
npm run dev               # http://localhost:3050
```

Sem `RESEND_API_KEY`, os e-mails vão para `.caixa-de-saida-local/`.

### Login com Google (obrigatório)
O Contrata só aceita login pelo Google (spec 6.1). No [Google Cloud Console](https://console.cloud.google.com/):
1. Crie um projeto (ex.: "Contrata") e configure a tela de consentimento OAuth com os escopos básicos `openid`, `email` e `profile`.
2. Em **Credenciais → Criar credenciais → ID do cliente OAuth**, tipo "Aplicativo da Web".
3. Em **URIs de redirecionamento autorizados**, inclua `{NEXT_PUBLIC_SITE_URL}/api/auth/google/callback` (em desenvolvimento, `http://localhost:3050/api/auth/google/callback`).
4. Copie o ID e a chave secreta para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.

Quem usa Microsoft 365 pode criar uma conta Google com o mesmo e-mail corporativo (não precisa ser Gmail).

### Sem cliente Google, só em desenvolvimento
O seed cria a "Padaria Exemplo" com usuários fictícios. Para ver o painel como um deles:

```bash
node scripts/dev-session.mjs carla@padaria.exemplo
```

O comando imprime um cookie `rs_sessao=…` para colar no navegador em `localhost:3050`. Ele recusa rodar contra um banco que não seja o local.

## Testes

```bash
npm run verify            # typecheck, lint, guardrails, pgTAP, Vitest, build e npm audit
```

## Para quem contribui
- As regras de código e as pegadinhas estão em [`CLAUDE.md`](CLAUDE.md); as instruções de revisão, em [`REVIEW.md`](REVIEW.md).
- `./scripts/test-guardrails.sh` testa os hooks de `.claude/hooks/`; `./scripts/check-guardrails-diff.sh` passa o repositório inteiro por eles.
