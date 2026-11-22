# Vaga Aberta

**O sistema de recrutamento e seleção para agentes.** É um ATS de código aberto e gratuito, sem painel: quem recruta opera pelo Claude ou pelo ChatGPT com o conector do Vaga Aberta. Consultas são em linguagem natural; cadastro e decisões abrem um formulário dentro do chat, que a pessoa confere e confirma. Candidatos usam páginas web simples. Para automação, há API REST e webhooks.

**Clone e use:** cada empresa hospeda a própria instância; não há serviço aberto a terceiros. O nome é **Vaga Aberta** (vagaaberta.app.br, spec 25.1); "contrata" segue só nos nomes internos (repositório, pasta, prefixos de evento e cabeçalhos de webhook). Licença MIT.

A especificação completa está em [`spec.md`](spec.md); os planos de cada épico, em [`plans/`](plans/); o que existe de fato, em [`DOCUMENTACAO-TECNICA.md`](DOCUMENTACAO-TECNICA.md).

## Estado
Em implementação. Prontos: guardrails (8.0), fundação (8.1), o conector (8.2: OAuth, servidor MCP com consultas e formulários no chat, chaves de API, API v1) e **vagas e página de carreiras (8.3)**: pelo chat, criar, editar, publicar, pausar e encerrar vagas, com etapas, perguntas e equipe; a vaga publicada aparece em `/{empresa}` e `/{empresa}/vagas/{slug}` (com JSON-LD para o Google), no feed `/{empresa}/vagas.xml`, no `sitemap.xml` e na API pública; e **candidatura (8.4)**: a pessoa se candidata pela página da vaga, com o currículo subindo direto para o bucket, e acompanha pelo link `/c/{token}` que recebe por e-mail (retirar, baixar e excluir os dados); a empresa também inclui candidatos pelo chat ou pela API v1; e o **funil (8.5)**: listar, buscar, ler currículos, anotar, mover de etapa e exportar o CSV pelo chat ou pela API, com cada avaliador registrando a própria avaliação pelo formulário. **Decisões e mensagens (8.6):** reprovar, contratar, encerrar a vaga e reabrir pelo formulário de decisões (com a devolutiva que cada pessoa recebe); integrações e clientes sem formulário criam propostas que a equipe confirma; mensagens com modelos editáveis; o candidato pode pedir revisão pelo link. **Banco de talentos (8.7):** só quem consentiu e com prazo; a equipe busca e convida para vagas novas (o convite leva à candidatura), e a pessoa entra, renova ou sai pelo link de acompanhamento. **Webhooks e trilha (8.8):** avisos assinados para o n8n ou outro sistema (vaga publicada, candidatura recebida, mudou de etapa, contratada…), configurados pelo formulário `webhooks` no chat, e a trilha completa por `GET /api/v1/eventos?desde=`. **Empresa (8.9):** logo, cor, descrição, retenção, banco de talentos e aviso de privacidade pelo formulário `empresa`; excluir a empresa (sem candidaturas em andamento) com 7 dias para desfazer pelo conector. O guia completo de auto-hospedagem entra no épico 8.12.

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
- `MCP_PREVIEW_SECRET`: `openssl rand -base64 32` (assina as prévias do conector para clientes sem formulário);
- `PREVIA_PAGINA_SECRET`: `openssl rand -base64 32` (link de pré-visualização da página de carreiras ainda não publicada);
- `LINK_CANDIDATO_SECRET`: `openssl rand -base64 32` (deriva o link de acompanhamento do candidato; trocar invalida todos os links já enviados);
- `CRON_SECRET`: `openssl rand -base64 32` (protege a faxina diária, `/api/cron/diario`; na Vercel, o `vercel.json` já agenda 1×/dia);
- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`: veja abaixo;
- `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`: o bucket dos currículos (Cloudflare R2: `S3_ENDPOINT=https://<conta>.r2.cloudflarestorage.com` e `S3_REGION=auto`; configure no bucket um CORS que libere `PUT` vindo do endereço do site). **Vazias, os arquivos ficam em `.armazenamento-local/`**, o que só serve para desenvolvimento.

```bash
npm run dev               # http://localhost:3050
```

Sem `RESEND_API_KEY`, os e-mails vão para `.caixa-de-saida-local/`.

## Conectar no Claude ou no ChatGPT
O endereço do conector é `{NEXT_PUBLIC_SITE_URL}/mcp` — em produção, `https://vagaaberta.app.br/mcp`. O Claude e o ChatGPT só alcançam HTTPS público, então para usar de verdade a instância precisa estar publicada (ou atrás de um túnel).
- **Claude:** Configurações › Conectores › Adicionar conector personalizado.
- **ChatGPT:** Configurações › Aplicativos e conectores › Criar (modo desenvolvedor).

Ao conectar, você entra com o Google, aceita os Termos, escolhe (ou cria) a empresa e os escopos. Depois é conversar: "quem sou eu?", "convide a Ana como recrutadora da Loja". Toda escrita abre um formulário no chat, já preenchido, e só grava quando você clica.

Para automação, crie uma chave de API pelo conector ("crie uma chave de API para o n8n") e use `Authorization: Bearer rsk_…` na API v1 (documento em `/api/v1/openapi.json`).

### Login com Google (obrigatório)
O Vaga Aberta só aceita login pelo Google (spec 6.1). No [Google Cloud Console](https://console.cloud.google.com/):
1. Crie um projeto (ex.: "Vaga Aberta") e configure a tela de consentimento OAuth com os escopos básicos `openid`, `email` e `profile`.
2. Em **Credenciais → Criar credenciais → ID do cliente OAuth**, tipo "Aplicativo da Web".
3. Em **URIs de redirecionamento autorizados**, inclua `{NEXT_PUBLIC_SITE_URL}/api/auth/google/callback` (em produção, `https://vagaaberta.app.br/api/auth/google/callback`; em desenvolvimento, `http://localhost:3050/api/auth/google/callback`).
4. Copie o ID e a chave secreta para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.

Quem usa Microsoft 365 pode criar uma conta Google com o mesmo e-mail corporativo (não precisa ser Gmail).

### Sem cliente Google, só em desenvolvimento
O seed cria a "Padaria Exemplo" com usuários fictícios. Para entrar como um deles (no consentimento do conector ou num convite):

```bash
node scripts/dev-session.mjs carla@padaria.exemplo
```

O comando imprime um cookie `rs_sessao=…` para colar no navegador em `localhost:3050`. Ele recusa rodar contra um banco que não seja o local.

### Página de carreiras
Com o seed, `http://localhost:3050/padaria-exemplo` mostra a página da Padaria Exemplo com duas vagas publicadas. A página só aparece depois que um administrador a publica (peça ao Claude: "publique a página de carreiras"); antes disso, o formulário devolve um link de pré-visualização que vale 10 minutos.

### Candidatura
Com a página publicada, abra uma vaga e clique em "Candidatar-me". O e-mail com o link de acompanhamento cai em `.caixa-de-saida-local/`; em `/c/{token}` dá para retirar a candidatura, baixar e excluir os dados (o código de exclusão também chega pela caixa local). Quem perdeu o link pede de novo em `/c`.

### Ver os formulários sem o Claude
Com `npm run dev`, abra `http://localhost:3050/dev/formularios`. É um host de MCP Apps que só existe em desenvolvimento: cole um token `rsm_` local, escolha a ferramenta (`abrir_formulario_convite`, `abrir_formulario_avaliacao`…) e os argumentos, e o formulário abre como abriria no chat, em tema claro ou escuro.

### Webhooks
O administrador cria o webhook pelo chat ("crie um webhook para https://…/gancho com candidatura contratada"): o formulário abre, a pessoa confere e confirma, e o segredo `whsec_…` aparece **uma vez**. Cada aviso é um `POST` JSON `{id, tipo, criado_em, empresa_id, dados}` com ids e o resumo da vaga ou da candidatura (sem nome, e-mail ou telefone: busque a pessoa em `GET /api/v1/candidaturas/{id}`), e os cabeçalhos `X-Contrata-Evento`, `X-Contrata-Entrega` e `X-Contrata-Assinatura: t={unix},v1={hex}`. Responda 2xx; senão há nova tentativa em 1 min, 10 min, 1 h e depois uma por dia, por até 3 dias. Só endereços `https` públicos (sem IP interno, sem redirecionamento). Para conferir:

```js
import { createHmac, timingSafeEqual } from "node:crypto";
// corpo: o texto cru da requisição; cabecalho: X-Contrata-Assinatura; segredo: whsec_…
function confere(corpo, cabecalho, segredo) {
  const { t, v1 } = Object.fromEntries(cabecalho.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const esperado = createHmac("sha256", segredo).update(`${t}.${corpo}`).digest("hex");
  return v1.length === esperado.length && timingSafeEqual(Buffer.from(v1), Buffer.from(esperado));
}
```

`CHAVES_ENC_KEY` (32 bytes em base64) cifra os segredos no banco; sem ela, criar webhook falha.

## Testes

```bash
npm run verify            # typecheck, lint, guardrails, pgTAP, Vitest, build e npm audit
```

## Para quem contribui
- As regras de código e as pegadinhas estão em [`CLAUDE.md`](CLAUDE.md); as instruções de revisão, em [`REVIEW.md`](REVIEW.md).
- `./scripts/test-guardrails.sh` testa os hooks de `.claude/hooks/`; `./scripts/check-guardrails-diff.sh` passa o repositório inteiro por eles.
