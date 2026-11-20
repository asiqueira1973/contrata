# Contrata — Especificação (SDD)

| Campo | Valor |
|---|---|
| Versão | 0.2 (20/11/2026: perguntas 25.2, 25.5, 25.6 e 25.7 respondidas. Instância hospedada só por convite, com pedido de convite no site aprovado pelo Alexandre (regra 11.33, tabela `rs_pedidos_convite`, tela `/admin/convites`); é vitrine de portfólio, não serviço para uso em produção; Resend gratuito; licença MIT; SMTP fica para a v2) · 0.1 (20/11/2026: primeira versão. ATS aberto e gratuito, só de recrutamento e seleção, para várias empresas, com API e MCP como portas principais do lado de quem recruta. Login sempre pelo Google; administração da empresa com convites, papéis, áreas e cadastro de pessoas, incluindo donos de vaga que não acessam o sistema) |
| Responsável de produto | Alexandre Siqueira (DabLab) |
| Status | pronto para revisão |
| Data | 20/11/2026 |
| Nome do produto | **Contrata** é nome de trabalho. O nome definitivo e o domínio estão em aberto (pergunta 25.1). O prefixo do banco (`rs_`, de "recrutamento e seleção") e os prefixos das chaves (`rsk_`, `rsm_`) **não dependem do nome** e não mudam quando ele for escolhido |

## Como usar este documento

Este documento é a fonte única de verdade do Contrata, um sistema de recrutamento e seleção (ATS) de código aberto e gratuito. A ideia de partida é um "Gupy aberto": o miolo que uma empresa usa para abrir vagas, receber candidaturas, conduzir o processo e responder a quem se candidatou, sem os módulos de admissão, treinamento e desempenho, e sem custo. O Claude Code vai usá-lo para implementar o app do zero.

**Antes de gerar qualquer código, revise a seção 24 (Assunções).** Uma assunção que ninguém revisou vira verdade no minuto em que o agente começa a codar. Diante de qualquer item da seção 25 (Perguntas abertas), o agente **para e pergunta**.

As referências são citadas por número ("regra 11.5", "seção 7.3"), e a numeração é estável.

**Onde trocar o nome quando ele for decidido:** título deste documento, `NEXT_PUBLIC_SITE_URL`, `EMAIL_REMETENTE`, nome do bucket, `src/lib/copy.ts` (constante `NOME_PRODUTO`), projeto no Visão do Produto e prefixo dos eventos de analytics (seção 21). Nada no banco muda.

**Projeto de referência (padrão técnico e visual, não de produto):**

| Projeto | O que se reaproveita |
|---|---|
| `~/assina` (**Assina**, `assina.app.br`, GitHub `asiqueira1973/assina`) | Stack, banco compartilhado com prefixo, login Google próprio com sessão em cookie JWT, Cloudflare R2 com URL pré-assinada, Resend com fila idempotente, cron diário, API REST com chave, webhooks com HMAC, MCP em `/mcp` com OAuth 2.1 próprio, analytics pelo servidor, guardrails do Anexo B e loop de verificação. **A identidade visual é a mesma família** (seção 16). O agente lê o código do Assina antes de reinventar qualquer uma dessas peças |

O que **não** se herda do Assina: o modelo de uma conta por pessoa (aqui há empresas com vários membros, seção 5), a chave de API única e cifrada (aqui são várias chaves com escopo, mostradas uma vez, seção 6.3) e o anti-escopo de "sem equipes".

---

## 0. Princípios não-negociáveis

1. **Tudo que o painel faz, a API e o MCP fazem.** Cada ação de quem recruta existe primeiro como função de domínio em `src/server/`, depois como rota da API v1 e ferramenta do MCP, e só então ganha tela. O painel é um cliente como os outros, sem atalho próprio para o banco. Quando uma ação não tiver porta de API ou MCP, a omissão está escrita na seção 13 com o motivo. As exceções de propósito são poucas: confirmar decisões, gerir membros e criar chaves.
2. **Quem decide sobre uma pessoa é outra pessoa.** Reprovar, marcar como contratado e encerrar uma vaga com candidatos ativos são **decisões**. Quando chegam pela API ou pelo MCP, viram **proposta** e só valem depois que um membro humano confirma no painel (regra 11.7). Nenhuma regra, pergunta, nota ou IA reprova alguém sozinha. Em todos os casos, o candidato pode pedir revisão humana (regra 11.13).
3. **Toda candidatura recebe resposta.** Uma candidatura não sai de "ativa" para "reprovada" ou "encerrada" sem uma devolutiva escrita, que é enviada por e-mail na mesma transação da mudança (regra 11.5). Vaga encerrada encerra as candidaturas com devolutiva. A pessoa vê a situação dela num link próprio, sem conta e sem senha.
4. **Candidatar-se leva menos de três minutos.** Sem cadastro, senha, teste ou formulário que repita o currículo. Pedimos nome, e-mail, currículo e no máximo 10 perguntas da vaga, tudo numa tela.
5. **Dado de candidato tem prazo.** A retenção é aplicada pelo próprio sistema (regra 11.12), não depende de alguém lembrar. O banco de talentos só guarda quem consentiu, com validade. Os candidatos de uma empresa nunca aparecem para outra.

---

## 1. Visão e problema

Empresas pequenas e médias que contratam algumas vezes por ano hoje escolhem entre três caminhos. Um é a planilha com e-mail, em que se perde candidato e ninguém recebe resposta. Outro é um ATS pago, como a Gupy (a partir de cerca de R$ 730/mês com contrato anual e módulos à parte), do qual usam uma fração. O terceiro são ATS abertos antigos ou feitos para equipes técnicas. Do lado do candidato, as queixas se repetem: falta de devolutiva, cadastros longos, testes demorados e desconfiança de triagem por IA.

O Contrata é o miolo de recrutamento e seleção, aberto e gratuito, com três diferenças:

1. **Headless do lado de quem recruta.** Cada ação existe na API REST e como ferramenta MCP. A empresa conduz o processo pelo Claude ("quais candidaturas da vaga de analista fiscal estão paradas há mais de uma semana?", "resuma os currículos da triagem frente aos requisitos", "mova a Ana para a entrevista com o gestor"), por automação (n8n, webhooks) ou pelo painel. O painel é a referência, não a única porta.
2. **Respeito ao candidato de fábrica.** Candidatura curta, link de acompanhamento, devolutiva obrigatória, pedido de revisão humana e exclusão dos próprios dados em um clique.
3. **LGPD aplicada pelo sistema.** Retenção automática, banco de talentos só com consentimento e trilha de quem fez o quê, incluindo agentes e quem os autorizou.

Funciona como **instância hospedada** pela DabLab, aberta a várias empresas, e como código que qualquer empresa pode hospedar por conta própria (seção 4.2).

**Anti-escopo:** o Contrata não é um sistema de admissão (documentos admissionais, eSocial, contrato), nem de treinamento, desempenho, folha ou ponto. Não aplica testes, jogos ou vídeo-entrevista, não roda IA própria para pontuar ou ranquear candidatos, não lê a caixa de entrada de ninguém (as respostas dos candidatos chegam no e-mail de contato da empresa, não no sistema), não publica vagas pagas em LinkedIn ou Indeed e não cobra de ninguém.

---

## 2. Personas e cenários de uso

| Persona | Contexto | Momento mais difícil |
|---|---|---|
| **Recrutador(a)** (RH de empresa pequena, ou dono que contrata) | Abre 2 a 10 vagas por ano, recebe de dezenas a centenas de candidaturas por vaga e faz o resto do trabalho em paralelo. Usa o Claude no dia a dia. | Dar conta da triagem sem deixar ninguém sem resposta, e lembrar onde cada pessoa parou. |
| **Administrador(a) da empresa** (dono, RH ou TI) | Configura uma vez: convida a equipe, cria as áreas, cadastra os gestores e liga as integrações. Volta quando alguém entra ou sai. | Dar acesso só ao que cada pessoa precisa, e tirar o acesso de quem saiu da empresa no mesmo dia. |
| **Gestor(a) da vaga / entrevistador(a)** | Participa de uma ou duas vagas, entra pouco no sistema, responde do celular. Pode ser membro (avaliador) ou só estar no cadastro de pessoas. | Registrar a avaliação logo depois da entrevista, sem ver a opinião dos outros antes. Se não tem acesso, saber como a vaga dele anda sem pedir ao RH. |
| **Candidato(a)** | Está procurando emprego, muitas vezes pelo celular, candidatando-se a várias vagas. Não conhece o Contrata. | Saber se a candidatura foi recebida e em que pé está, e ter uma resposta no fim. |
| **Agente ou integração** (Claude via MCP, n8n, script da empresa) | Age em nome de um membro ou da empresa, com escopo limitado. | Fazer tudo que é operacional sem conseguir, sozinho, decidir sobre uma pessoa. |
| **Quem hospeda** (TI da empresa ou desenvolvedor) | Quer rodar a própria instância. | Subir com Supabase, R2 e Resend próprios seguindo o README, sem ler o código. |

---

## 3. Escopo do MVP

### Dentro
- **Empresas e administração:** qualquer pessoa cria uma empresa (com os limites da regra 11.14) e vira administradora. O administrador:
  - convida membros por e-mail e define o papel de cada um (administrador, recrutador ou avaliador);
  - limita recrutadores a algumas **áreas** ou deixa com acesso a todas (regra 11.32);
  - cadastra as **áreas** (departamentos) da empresa, cada uma com um responsável;
  - mantém o cadastro de **pessoas** da empresa: gestores, entrevistadores e donos de vaga, **com ou sem acesso ao sistema** (regra 11.31).

  Uma pessoa pode estar em várias empresas.
- **Login sempre pelo Google** (`openid email profile`), para membros. Convite aceito só com a conta Google do mesmo e-mail (regra 11.24). O candidato nunca faz login.
- **Vagas:** título, descrição, requisitos, local e modelo de trabalho, regime, faixa salarial opcional, data-limite opcional, etapas próprias (modelo padrão copiado ao criar), até 10 perguntas, equipe da vaga (responsável e avaliadores). Estados: rascunho, publicada, pausada e encerrada.
- **Página de carreiras** pública por empresa (`/{empresa}`), com logo, descrição e vagas publicadas, e página de cada vaga com marcação **JobPosting** para o Google for Jobs. Também um feed XML de vagas e uma API pública de leitura para a empresa montar a própria página.
- **Candidatura sem cadastro:** nome, e-mail, telefone opcional, LinkedIn opcional, currículo (PDF ou DOCX), respostas, aviso de privacidade e consentimento separado e opcional para o banco de talentos. Também entra pela API pública e manualmente (indicação).
- **Link de acompanhamento** do candidato: situação em linguagem simples, devolutiva, retirar candidatura, baixar os próprios dados, excluir os próprios dados, pedir revisão humana e gerenciar o banco de talentos.
- **Funil:** mover entre etapas, avaliação por etapa (recomendação mais comentário, oculta até o avaliador registrar a dele, regra 11.9), notas internas, sinalização de requisito declarado não atendido (regra 11.10), busca no texto do currículo.
- **Decisões em dois passos** (princípio 2): reprovar, contratar e encerrar vaga com candidatos ativos. Propostas pela API ou pelo MCP vão para "Para confirmar" no painel.
- **Devolutiva obrigatória** e **mensagens** ao candidato por modelos editáveis por empresa, enviadas pelo Resend com `reply-to` no e-mail de contato da empresa.
- **Banco de talentos:** busca entre quem consentiu e convite para candidatar-se a uma vaga nova.
- **API REST v1** com chaves por empresa e escopos (`leitura`, `escrita`, `decisao`), **webhooks** com HMAC e documentação OpenAPI.
- **Servidor MCP** remoto (Streamable HTTP) com OAuth 2.1 próprio. O token age **em nome de um membro**, numa empresa, com os escopos escolhidos na tela de consentimento.
- **Trilha de eventos** só de inserção, com tipo de ator (membro, candidato, sistema, integração, agente), credencial e quem autorizou.
- **Retenção LGPD automática** e faxina diária (expurgo, alertas de candidatura parada, vagas vencidas, retentativas de e-mail e webhook).
- **Analytics** no Visão do Produto, pelo servidor e **opcional** (desligado se as variáveis não existirem, para quem hospeda).
- **Instância hospedada por convite** (regra 11.33): a página inicial tem "Pedir convite" (nome, e-mail, empresa, para que vai usar). O pedido chega por e-mail ao administrador da instância, que aprova ou recusa numa tela própria. Aprovado, a pessoa recebe o link para entrar com o Google desse e-mail e criar **uma** empresa. Membros convidados por uma empresa já criada não passam por isso.
- Página inicial, Política de privacidade, Termos de uso, documentação da API e guia de auto-hospedagem.

### Fora
| Item | Destino | Motivo / dependência |
|---|---|---|
| Admissão, documentos admissionais, eSocial | Descartado | Fora do escopo pedido (só R&S). Integração com outro sistema pelo webhook `candidatura.contratada` |
| Testes, jogos, provas, vídeo-entrevista | Descartado | São a maior queixa dos candidatos e um produto à parte |
| IA própria no servidor para pontuar, ranquear ou resumir | Descartado no MVP | A IA é a do recrutador, pelo MCP (princípio 2, seção 20.4). Sem custo de modelo para quem hospeda |
| Agendamento de entrevistas | v2 | Exige calendário. No MVP, o modelo de mensagem aceita a variável `{{link_agenda}}` do membro (qualquer ferramenta de agenda) |
| Ler respostas dos candidatos por e-mail (caixa de entrada) | Descartado | Exige integração com o provedor de e-mail da empresa. As respostas vão para o `email_contato` |
| Publicação paga ou integração oficial com LinkedIn e Indeed | v2 / pergunta 25.4 | O LinkedIn exige parceria de ATS para o feed; o Indeed mudou as regras de feed em 2026. No MVP: Google for Jobs, feed XML genérico e página pública indexável |
| Quadro arrastável (kanban) | v2 | O MVP usa lista por etapa com abas (seção 16). Funciona no celular e sai mais barato |
| Importação de candidatos de outro ATS (CSV) | v2 | Exige base legal declarada por linha. Pela API, um por vez com aviso ao candidato |
| Campos de diversidade e vagas afirmativas com coleta de dado sensível | Descartado no MVP | Dado sensível (LGPD art. 11) exige base e cuidado próprios. A vaga pode dizer em texto que é afirmativa |
| SMS e WhatsApp | v2 | Custo por mensagem |
| Interface em inglês | v2 | Copy centralizada em `copy.ts` |
| Docker Compose para auto-hospedagem fora da Vercel | v2 | O MVP documenta Vercel + Supabase + R2 (ou S3 compatível) + Resend |
| Confirmação de decisão dentro do chat (elicitação do MCP) | pergunta 25.3 | Depende do suporte dos clientes e de como garantir que é a pessoa, não o agente, que confirma |
| Cobrança, planos, níveis | Descartado | Produto gratuito |
| Login sem Google (código por e-mail, Microsoft, SSO SAML) | Descartado no MVP | Decisão do Alexandre (20/11/2026): OAuth sempre Google. Empresa que usa Microsoft 365 precisa de uma conta Google com o mesmo e-mail (é possível criar conta Google com e-mail não Gmail). Microsoft na v2 se houver pedido |
| Entrada automática por domínio (qualquer `@empresa.com.br` entra como avaliador) | v2 | Precisa de verificação de posse do domínio |
| Organograma, hierarquia de áreas, centro de custo, aprovação de abertura de vaga (requisição) | v2 | Só R&S no MVP; a área tem um nível e um responsável |

---

## 4. Arquitetura

| Camada | Escolha | Por quê | Alternativa descartada |
|---|---|---|---|
| Framework | **Next.js 16** (16.4.x, App Router, Cache Components, `proxy.ts`), React 19, TypeScript | Mesmo do Assina; reaproveita guardrails e aprendizados | Outro framework: stack novo sem ganho |
| Banco (instância hospedada) | **Supabase Postgres, projeto compartilhado "BANCO DE TESTE"** (`jeesdmfcrmhyufwzwzwt`), tabelas com **prefixo `rs_`** (livre em 20/11/2026) | Custo zero e o mesmo arranjo do Assina | Projeto próprio: melhor isolamento; vira o caminho quando o volume justificar (risco 23.1) |
| Banco (auto-hospedagem) | Qualquer projeto Supabase (ou Postgres 15+ com as mesmas extensões), mesmas migrations e mesmo prefixo | Um código só para as duas formas | Prefixo configurável: complica as migrations sem ganho |
| Arquivos | **Cloudflare R2**, bucket **privado** `contrata-arquivos`, pela API S3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`), só por URL pré-assinada. Atrás da interface `ArquivoStorage` (seção 18), que aceita qualquer S3 compatível (MinIO, AWS) por `S3_ENDPOINT` | Mesmo do Assina: 10 GB grátis e saída grátis. Quem hospeda pode usar outro S3 | Supabase Storage: 1 GB dividido no projeto compartilhado |
| Acesso ao banco | **Só pelo servidor**, service role, em `src/server/db/`. RLS **ligada sem nenhuma política** em todas as `rs_*`, `REVOKE ALL` de `anon` e `authenticated` | Mesmo do Assina | Supabase Auth com RLS por `auth.uid()`: mexeria na Auth do projeto compartilhado |
| Login de membros | **Sempre OAuth do Google próprio** (`openid email profile`). Sessão em cookie `HttpOnly` com JWT HS256 (`jose`) | Decisão do Alexandre (20/11/2026). Escopos não sensíveis, sem senha para guardar e o mesmo login do OAuth do MCP | Código por e-mail: mais uma superfície de ataque e de suporte; Supabase Auth: mexeria na Auth do projeto compartilhado |
| Candidato | Sem conta. Link de acompanhamento com token de 32 bytes (só o hash no banco) | Princípio 4 | Conta de candidato: é exatamente a fricção que se quer evitar |
| Extração de texto do currículo | `unpdf` (PDF) e `mammoth` (DOCX), no servidor, depois do upload | O texto alimenta a busca (regra 11.28) e o MCP (`ler_curriculo`), para a IA do recrutador ler sem baixar o arquivo | OCR: pesado; PDF escaneado fica sem texto e o MCP avisa |
| E-mail | **Resend**, remetente `naoresponda@{dominio}`, nome de exibição "{Empresa} via Contrata", `reply-to` = `email_contato` da empresa. Fila idempotente em `rs_notificacoes` | Mesmo do Assina | SMTP genérico: v2, para quem hospeda (pergunta 25.5) |
| MCP | Rota `/mcp` no próprio Next (Streamable HTTP, `@modelcontextprotocol/sdk`, protocolo `2026-07-28` compatível com clientes de 2025) | Um deploy só; chama `src/server/` direto (princípio 1) | Servidor separado: duplicaria o domínio |
| OAuth do MCP | O **site é o servidor de autorização** (DCR RFC 7591, PKCE S256, RFC 8414 e 9728), como no Assina, **mais** a escolha de empresa e de escopos na tela de consentimento (seção 6.4) | Padrão que já funciona com Claude e ChatGPT | Só chave: não serve como conector no claude.ai |
| Busca | Postgres full-text (`to_tsvector('portuguese', …)`), coluna gerada e índice GIN | Sem serviço extra | Busca semântica com embeddings: v2 |
| Datas | `date-fns` v4 + `@date-fns/tz`, exibição em `America/Sao_Paulo` | Mesmo do Assina | — |
| Validação | `zod` 4; os mesmos schemas para painel, API, MCP e API pública | Princípio 1 | — |
| Markdown da vaga | `marked` com sanitização (`sanitize-html`), lista fechada de tags | Descrição rica sem HTML arbitrário | Editor rich text: pesado |
| Analytics | **Visão do Produto**, do servidor, **opcional** | Os eventos nascem nas três portas | SDK no navegador |
| Hospedagem | **Vercel**; domínio na pergunta 25.1 | Mesmo do Assina | — |
| Cron | Vercel Cron **1×/dia** → `/api/cron/diario` | Plano Hobby | `pg_cron` com HTTP: lógica espalhada |
| Repositório | `~/contrata` (renomeia com o nome definitivo), GitHub **público**, licença **MIT** (assunção 24.10) | Mesmo padrão dos outros projetos abertos | AGPL-3.0: protege contra SaaS fechado em cima do código (pergunta 25.6) |

**Premissas a validar no épico 8.1:**
- (a) Nenhum objeto `rs_*` existe no remoto, e `pgcrypto`, `citext` e `unaccent` estão instaladas (instalar o que faltar pela migration, em `extensions`).
- (b) A camada gratuita do R2 ainda vale (como no Assina, premissa (b)).
- (c) `unpdf` e `mammoth` rodam no runtime Node da Vercel sem módulo nativo e extraem um currículo de 5 MB em menos de 10 s.
- (d) As regras atuais do Google para JobPosting (campos obrigatórios e recomendados) batem com a regra 11.20. Conferir na documentação oficial antes do 8.3.

### 4.1 Fluxos principais

```
Recrutador (Claude/MCP) ─criar_vaga─▶ domínio: vaga em rascunho, etapas do modelo padrão
                        ─publicar_vaga─▶ vaga publicada → página /{empresa}/vagas/{slug} com JobPosting, feed, sitemap
Candidato → /{empresa}/vagas/{slug} → "Candidatar-me" → formulário único
          ─POST /api/publico/.../candidaturas─▶ cria candidato + candidatura (situação ativa, 1ª etapa)
          navegador ─PUT currículo─▶ R2 (contrata-arquivos/{empresa}/{candidatura}/curriculo.pdf)
          ─POST .../concluir─▶ extração de texto + e-mail "Recebemos sua candidatura" com o link /c/{token}
          webhook candidatura.criada
Recrutador ─listar_candidaturas / ler_curriculo / mover_etapa / adicionar_nota─▶ domínio (direto)
           ─reprovar_candidatura (MCP)─▶ rs_decisoes pendente ─▶ painel "Para confirmar" ─▶ membro confirma
           ─▶ candidatura reprovada + devolutiva enfileirada (mesma transação) ─▶ e-mail ao candidato, webhook
Candidato → /c/{token}: "Encerrada" + devolutiva → "Pedir revisão" (opcional) → aviso ao responsável
Faxina diária → expurga o que venceu (11.12), alerta candidaturas paradas (11.11), pausa vagas vencidas
```

### 4.2 Instância hospedada e auto-hospedagem

| | Instância hospedada (DabLab) | Auto-hospedagem |
|---|---|---|
| Finalidade | **vitrine de portfólio** do projeto de código aberto (decisão de 20/11/2026): demonstração para quem foi convidado, sem promessa de disponibilidade nem de suporte. A página inicial e os Termos dizem isso | uso real da empresa que hospeda |
| Empresas | várias, **só por convite** (`CRIACAO_EMPRESA=convite`, regra 11.33): pedido de convite no site, aprovação pelo administrador da instância (`ADMIN_INSTANCIA_EMAILS`, o Alexandre) | normalmente uma; `CRIACAO_EMPRESA=aberta` deixa qualquer conta Google criar empresa, ou `convite` com o mesmo fluxo de pedido |
| E-mail | Resend no plano gratuito (100 por dia), da DabLab | conta Resend própria de quem hospeda (README) |
| Controlador dos dados dos candidatos | cada empresa | a empresa |
| Operador | DabLab | quem hospeda |
| Banco | projeto compartilhado, prefixo `rs_` | projeto próprio, mesmo prefixo |
| Analytics | Visão do Produto | desligado (variáveis vazias) |
| Login Google | cliente OAuth da DabLab | cliente OAuth próprio (obrigatório; o README explica como criar) |

O código não tem nenhum `if (hospedada)`. O comportamento muda só por variáveis de ambiente (seção 18).

---

## 5. Perfis de usuário e matriz de permissões

Perfis:

- **administrador:** membro que gere a empresa (dados, página de carreiras, membros, retenção, integrações) e faz tudo que o recrutador faz;
- **recrutador:** membro que conduz as vagas da empresa: **todas** ou só as das **áreas** que o administrador marcou (regra 11.32);
- **avaliador:** membro que só enxerga as vagas em que está na equipe e registra avaliações;
- **integração:** chave de API da empresa, limitada pelos escopos dela;
- **agente:** token do MCP, que age **como o membro que o autorizou**, limitado pela interseção entre o papel desse membro e os escopos escolhidos (regra 11.16);
- **pessoa sem acesso:** gestor ou dono de vaga cadastrado em `rs_pessoas` sem membro ligado. Não entra no sistema; recebe por e-mail só o que a regra 11.31 permite;
- **candidato:** anônimo, com o token do link de acompanhamento;
- **público:** qualquer pessoa na página de carreiras e na API pública.

| Ação | Administrador | Recrutador | Avaliador | Integração (API) | Agente (MCP) | Candidato | Público |
|---|---|---|---|---|---|---|---|
| Criar empresa | ✅ quem tem pedido de convite aprovado e não usado, ou está em `ADMIN_INSTANCIA_EMAILS` (com `CRIACAO_EMPRESA=aberta`: qualquer pessoa logada), com os limites 11.14; vira administrador | — | — | ❌ | ❌ | ❌ | ❌ |
| Editar dados da empresa, página de carreiras, retenção | ✅ só a própria empresa | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Convidar, mudar papel e áreas, remover membro | ✅ (não remove o último administrador, 11.26) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Criar, editar e arquivar áreas | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Cadastrar, editar e arquivar pessoas; dar acesso a uma pessoa (vira convite) | ✅ | ✅ cadastrar e editar pessoas (gestores das vagas que conduz); dar acesso, não | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ver áreas e pessoas | ✅ | ✅ | ✅ só nome e área | ✅ `leitura` | ✅ `leitura` | ❌ | ❌ |
| Criar e revogar chaves de API, configurar webhooks | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Ver e revogar conexões MCP | ✅ todas da empresa | ✅ só as próprias | ✅ só as próprias | ❌ | ❌ | ❌ | ❌ |
| Criar e editar vaga, etapas, perguntas, área, dono e equipe | ✅ qualquer vaga da empresa | ✅ vagas das áreas dele (ou todas) | ❌ | ✅ com `escrita` | ✅ com `escrita` e papel ≥ recrutador | ❌ | ❌ |
| Publicar e pausar vaga | ✅ | ✅ | ❌ | ✅ `escrita` | ✅ `escrita`, papel ≥ recrutador | ❌ | ❌ |
| Encerrar vaga | ✅ direto (com confirmação na tela) | ✅ idem | ❌ | ✅ `decisao`: **vira proposta** se houver candidatura ativa (11.7) | ✅ `decisao`: idem | ❌ | ❌ |
| Ver candidaturas, currículos e respostas | ✅ todas | ✅ das vagas das áreas dele (ou todas) | ✅ **só das vagas em que está na equipe** | ✅ `leitura` | ✅ `leitura`, no alcance do papel do membro | ✅ **só a própria**, pelo token | ❌ |
| Mover entre etapas, adicionar nota | ✅ | ✅ | ❌ (só avalia) | ✅ `escrita` | ✅ `escrita`, papel ≥ recrutador | ❌ | ❌ |
| Registrar avaliação | ✅ | ✅ | ✅ nas vagas da equipe | ❌ (avaliação é de pessoa) | ❌ (idem; o agente usa nota) | ❌ | ❌ |
| Ver avaliações dos outros | ✅ sempre | ✅ sempre | ✅ só depois de registrar a dele na etapa (11.9) | ✅ `leitura` | ✅ conforme o papel do membro | ❌ | ❌ |
| Propor reprovar ou contratar | — (no painel decide direto) | — | ❌ | ✅ `decisao` | ✅ `decisao`, papel ≥ recrutador | ❌ | ❌ |
| **Confirmar** decisão proposta | ✅ | ✅ | ❌ | ❌ **nunca** | ❌ **nunca** | ❌ | ❌ |
| Reprovar ou contratar direto | ✅ no painel, com devolutiva | ✅ idem | ❌ | ❌ | ❌ | ❌ | ❌ |
| Enviar mensagem ao candidato | ✅ | ✅ | ❌ | ✅ `escrita` (sujeito à 11.8) | ✅ `escrita` (sujeito à 11.8) | ❌ | ❌ |
| Reabrir candidatura | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Buscar e convidar do banco de talentos | ✅ | ✅ | ❌ | ✅ `leitura` / `escrita` | ✅ idem | ❌ | ❌ |
| Ver a trilha de eventos | ✅ toda | ✅ toda | ✅ das candidaturas que vê | ✅ `leitura` | ✅ `leitura` | ❌ (vê o próprio histórico simplificado) | ❌ |
| Candidatar-se | — | — | — | ✅ pela API pública ou pela rota com `escrita` (origem `api`) | ✅ `escrita` (origem `manual`, com aviso ao candidato, 11.2) | ✅ | ✅ |
| Retirar candidatura, baixar e excluir os próprios dados, pedir revisão | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ só a própria | ❌ |
| Ver vagas publicadas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Excluir a empresa | ✅ (exige digitar o slug) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Administrador da instância:** não é papel de empresa. São os e-mails de `ADMIN_INSTANCIA_EMAILS` (na instância hospedada, o Alexandre). Eles aprovam ou recusam pedidos de convite em `/admin/convites` e podem criar empresas sem pedido. Não veem dados de nenhuma empresa por causa disso: para ver, precisam ser membros dela como qualquer pessoa. Guardião: `requireAdminInstancia()`.

**Primeiro administrador:** não há seed. Quem cria a empresa vira administrador dela.

**Escopo de dados:** sempre `empresa_id`; para recrutador limitado, também as áreas dele (`rs_membro_areas`); para avaliador, a equipe da vaga (`rs_vaga_equipe`). Administrador vê tudo. Daqui em diante, "recrutador" na matriz quer dizer "no alcance dele". Cada porta tem seu guardião na primeira linha:

| Porta | Guardião | Devolve |
|---|---|---|
| Rota do painel | `requireMembro(empresaSlug, papelMinimo)` | `{ usuario, membro, empresa, alcance }` (relê o vínculo a cada requisição) |
| API v1 | `requireCredencial('api', escopo)` | `{ empresa, credencial, ator, alcance: todas }` |
| MCP | `requireCredencial('mcp' \| 'api', escopo)` | `{ empresa, credencial, membro?, ator, alcance }` |
| Link do candidato | `requireCandidaturaPorToken()` | `{ candidatura, empresa }` |
| API pública | `requireEmpresaPublica(slug)` | `{ empresa }` (só com `pagina_publicada = true`) |

As funções de domínio recebem sempre um objeto `Ator` (seção 7.3, `rs_eventos`) e um `empresaId`. Funções que leem ou escrevem vagas e candidaturas recebem também o `alcance` (`todas`, `areas:[ids]` ou `equipe:{membro_id}`) calculado pelo guardião. Nenhum helper de `src/server/db/` aceita consulta a tabela `rs_*` com dado de empresa sem `empresaId`.

---

## 6. Autenticação e identidade

### 6.1 Membros

- **Só Google.** Não existe outro jeito de entrar no painel (decisão de 20/11/2026).
- **Identificador:** `google_sub`, guardado em `rs_usuarios`. O e-mail pode mudar no Google: a cada login, `email` é atualizado se o novo não pertencer a outro usuário (se pertencer, o login é recusado com a mensagem da seção 15 e um alerta ao `ADMIN_EMAIL`).
- **Entrar:** igual ao Assina (6.1 de lá): `state` e PKCE, `scope=openid email profile`, `prompt=select_account`, sem `access_type=offline`, `email_verified = true` obrigatório.
- **Convite:** o link do convite (`/convite/{token}`) mostra empresa, papel e quem convidou e o botão "Entrar com Google para aceitar". O convite só é aceito se o e-mail da conta Google for igual ao convidado (regra 11.24); se não for, a tela diz qual e-mail foi convidado e oferece "Entrar com outra conta".
- **Retorno, nesta ordem:** proteções (bloqueados, suspensos, limite diário de usuários novos da 11.14) → cria ou atualiza `rs_usuarios` → aceita convites pendentes para esse e-mail (11.24) → abre a sessão → redireciona para `volta`, para a única empresa do usuário ou para `/painel` (escolha de empresa).
- **Sessão:** cookie `rs_sessao`, JWT HS256 (`SESSION_SECRET`), `HttpOnly`, `Secure`, `SameSite=Lax`, 30 dias com renovação depois de 7. Conteúdo: `usuario_id`, `iat`. **A empresa não vai na sessão:** vem da URL (`/painel/{empresa}/…`) e é conferida em cada requisição pelo `requireMembro`.
- **Termos:** usuário com `termos_aceitos_em` nulo vê só as boas-vindas.
- **Sair:** `POST /sair` por formulário.
- **Recuperação de senha:** não existe senha. Quem perdeu a conta Google pede ao administrador da empresa um convite para o e-mail novo; o administrador remove o membro antigo.
- **Saída de alguém da empresa:** o administrador remove o membro (sessão e tokens MCP perdem efeito na próxima requisição, porque o guardião confere o vínculo a cada chamada). A pessoa continua no cadastro de pessoas, sem acesso, enquanto for dona de vaga.

### 6.2 Candidato

- Ao candidatar-se, recebe por e-mail o link `/c/{token}` (32 bytes base64url; o banco guarda só o SHA-256 em `rs_candidaturas.token_hash`). O link é a credencial: não expira enquanto a candidatura existir.
- Ações que destroem algo (retirar, excluir dados) pedem confirmação na tela. **Excluir os dados** pede também um código de 6 dígitos enviado ao e-mail da candidatura (regra 11.13), porque o link pode ter sido encaminhado.
- "Perdi o link": na página da vaga e em `/c`, o candidato informa o e-mail e recebe de novo os links das candidaturas **daquela empresa** (resposta sempre igual, exista ou não).
- `Referrer-Policy: no-referrer` e `noindex` em `/c/*`.

### 6.3 Credenciais de máquina

Vivem em `rs_credenciais`, separadas pelo enum `rs_tipo_credencial`.

- **Chave de API (`api`):** criada por um administrador em Integrações, com **nome** ("n8n", "Site institucional") e **escopos** (`leitura`, `escrita`, `decisao`; `escrita` implica `leitura`, `decisao` implica as duas). Formato `rsk_` + 32 bytes base64url. **Mostrada uma única vez**; o banco guarda só `valor_hash` (SHA-256) e `prefixo` (os 8 primeiros caracteres, para identificar na lista). Até 10 ativas por empresa. Age como **integração** da empresa: alcance de todas as vagas, ator `api`.
- **Token MCP (`mcp`):** criado pelo OAuth (6.4). Formato `rsm_` + 32 bytes, só hash. Pertence a **um membro em uma empresa**. Escopos escolhidos no consentimento, limitados pelo papel (11.16). Não expira; é revogado na tela Integrações, ao remover o membro ou quando o papel dele muda (o papel novo vale para tokens novos; os antigos são revogados na mesma transação).
- **A chave de API também funciona no `/mcp`** como Bearer, para clientes configurados por arquivo. Nesse caso o ator é `api` e não há membro.
- **Validação:** hash do Bearer → `rs_credenciais` com `revogada_em is null` → empresa não suspensa nem excluída → membro ativo (para `mcp`) → escopo exigido presente. Falha de credencial: `401 {"codigo":"credencial_invalida"}`. Falta de escopo: `403 {"codigo":"escopo_insuficiente","escopo":"decisao"}`.
- `ultimo_uso_em` atualizado no máximo uma vez por minuto por credencial.

### 6.4 OAuth 2.1 do MCP

O mesmo desenho do Assina (6.4 de lá), com duas diferenças na tela de consentimento (`GET /oauth/autorizar`):

1. **Empresa:** se o usuário for membro de mais de uma empresa, escolhe uma. O token vale só para ela (para outra empresa, conecta de novo).
2. **Escopos:** três caixas, "Ler vagas e candidaturas" (`leitura`, sempre marcada), "Criar e mover" (`escrita`) e "Propor decisões" (`decisao`). As duas últimas aparecem **só se o papel do membro permitir** (11.16) e vêm marcadas por padrão para recrutador e administrador. A tela diz em texto o que o agente **não** consegue: confirmar decisões, gerir membros e chaves, ver outras empresas.

`rs_oauth_codigos` guarda `empresa_id`, `membro_id` e `escopos` escolhidos. O `/oauth/token` cria a credencial `mcp` com esses valores. As URLs dos metadados vêm de `NEXT_PUBLIC_SITE_URL`, nunca do `Host`.

### 6.5 Autorização no banco

Todas as tabelas `rs_*` têm `ENABLE ROW LEVEL SECURITY`, **nenhuma política** e `REVOKE ALL` de `anon` e `authenticated`. O bucket do R2 é privado e só o servidor tem a credencial (token restrito ao bucket). A service role ignora RLS, então **toda consulta do servidor filtra por `empresa_id`** (e por equipe, para avaliador) ou por `token_hash`, garantido pelos helpers de `src/server/db/` e testado nas cinco portas (seção 22).

---
## 7. Modelo de dados

Banco em português, `snake_case`, prefixo `rs_`. Datas em `timestamptz` (UTC). Chaves `uuid` com `gen_random_uuid()`, exceto `rs_eventos` (`bigint identity`). E-mails em `citext`. Este é o texto-fonte do `modelo-contrata.dbml`.

### 7.1 Diagrama

```
rs_usuarios 1─N rs_membros N─1 rs_empresas
rs_pedidos_convite 0..1─1 rs_empresas (empresa criada com o convite)
rs_membros 1─N rs_membro_areas N─1 rs_areas
rs_empresas 1─N rs_areas N─1 rs_pessoas (responsável)
rs_empresas 1─N rs_pessoas 0..1─1 rs_membros (pessoa com acesso)
rs_empresas 1─N rs_credenciais ─N─1 rs_membros (só mcp)
rs_empresas 1─N rs_oauth_codigos N─1 rs_oauth_clientes
rs_empresas 1─N rs_vagas 1─N rs_etapas
                rs_vagas N─1 rs_areas (opcional), N─1 rs_pessoas (dono, opcional)
                rs_vagas 1─N rs_perguntas
                rs_vagas 1─N rs_vaga_equipe N─1 rs_membros
rs_empresas 1─N rs_candidatos 1─N rs_candidaturas N─1 rs_vagas
                                   rs_candidaturas N─1 rs_etapas (etapa atual, nula se encerrada antes da 1ª)
                                   rs_candidaturas 1─N rs_respostas N─1 rs_perguntas
                                   rs_candidaturas 1─N rs_arquivos
                                   rs_candidaturas 1─N rs_avaliacoes N─1 rs_membros, N─1 rs_etapas
                                   rs_candidaturas 1─N rs_notas
                                   rs_candidaturas 1─N rs_mensagens
rs_empresas 1─N rs_decisoes (candidatura ou vaga)
rs_empresas 1─N rs_modelos_mensagem
rs_empresas 1─N rs_eventos, rs_notificacoes, rs_webhooks 1─N rs_entregas_webhook
```

### 7.2 Enums

| Enum | Valores |
|---|---|
| `rs_papel_membro` | `administrador`, `recrutador`, `avaliador` |
| `rs_tipo_credencial` | `api`, `mcp` |
| `rs_escopo` | `leitura`, `escrita`, `decisao` |
| `rs_status_vaga` | `rascunho`, `publicada`, `pausada`, `encerrada` |
| `rs_motivo_encerramento_vaga` | `preenchida`, `cancelada`, `outro` |
| `rs_modelo_trabalho` | `presencial`, `hibrido`, `remoto` |
| `rs_regime` | `clt`, `pj`, `estagio`, `temporario`, `aprendiz`, `trainee`, `freelancer`, `outro` |
| `rs_tipo_etapa` | `triagem`, `entrevista`, `avaliacao`, `proposta` |
| `rs_papel_na_vaga` | `responsavel`, `avaliador` |
| `rs_tipo_pergunta` | `texto_curto`, `texto_longo`, `sim_nao`, `escolha_unica`, `numero` |
| `rs_situacao_candidatura` | `ativa`, `reprovada`, `desistiu`, `contratada`, `encerrada_vaga` |
| `rs_motivo_reprovacao` | `requisitos`, `experiencia`, `perfil`, `pretensao_salarial`, `localizacao`, `outro_candidato`, `sem_retorno`, `outro` (interno; nunca mostrado ao candidato) |
| `rs_origem_candidatura` | `pagina`, `api_publica`, `integracao`, `manual`, `banco_talentos` |
| `rs_tipo_arquivo` | `curriculo`, `anexo`, `logo` |
| `rs_status_extracao` | `pendente`, `ok`, `sem_texto`, `falhou` |
| `rs_recomendacao` | `forte_sim`, `sim`, `nao`, `forte_nao` |
| `rs_tipo_decisao` | `reprovar`, `contratar`, `encerrar_vaga`, `enviar_mensagem` |
| `rs_status_decisao` | `pendente`, `confirmada`, `descartada`, `expirada` |
| `rs_tipo_ator` | `membro`, `candidato`, `sistema`, `api`, `agente` |
| `rs_origem_evento` | `painel`, `api`, `mcp`, `publico`, `cron` |
| `rs_tipo_mensagem` | `confirmacao`, `devolutiva`, `contato`, `convite_vaga`, `desistencia`, `resposta_revisao` |
| `rs_mensagens_agente` | `confirmar`, `direto` |
| `rs_tipo_notificacao` | `pedido_convite_recebido`, `pedido_convite_admin`, `pedido_convite_aprovado`, `pedido_convite_recusado`, `convite_membro`, `candidatura_recebida`, `mensagem_candidato`, `links_reenviados`, `codigo_exclusao`, `resumo_diario`, `decisoes_pendentes`, `revisao_pedida`, `talentos_expirando`, `resumo_dono_vaga` |
| `rs_status_notificacao` | `pendente`, `enviada`, `falhou`, `descartada` |
| `rs_status_entrega` | `pendente`, `entregue`, `falhou`, `desistiu` |
| `rs_status_pedido_convite` | `pendente`, `aprovado`, `recusado`, `usado`, `vencido` |

### 7.3 Tabelas

**`rs_usuarios`** — pessoa que entra no painel.

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `email` | citext | não | — | único |
| `nome` | text | não | — | do Google |
| `google_sub` | text | não | — | único; identificador do login (6.1) |
| `foto_url` | text | sim | — | `picture` do Google; nulo se não vier |
| `termos_aceitos_em` | timestamptz | sim | — | nulo até aceitar as boas-vindas |
| `suspenso_em` | timestamptz | sim | — | nulo = ativo. Só o admin da instância suspende (SQL no MVP) |
| `ultimo_acesso_em` | timestamptz | sim | — | atualizado no login |
| `criado_em` | timestamptz | não | `now()` | |

**`rs_pedidos_convite`** — pedidos de convite para criar empresa na instância (regra 11.33).

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `email` | citext | não | — | conta Google que vai criar a empresa; um pedido `pendente` por e-mail (índice parcial) |
| `nome` | text | não | — | 2–120 |
| `empresa_nome` | text | não | — | 2–80, sugestão de nome da empresa |
| `uso` | text | sim | — | "Para que você quer usar?", até 500. Nulo = não respondeu |
| `status` | `rs_status_pedido_convite` | não | `pendente` | |
| `decidido_por_usuario_id` | uuid | sim | — | administrador da instância que aprovou ou recusou |
| `decidido_em` | timestamptz | sim | — | |
| `aprovado_ate` | timestamptz | sim | — | aprovação + 30 dias; depois disso vira `vencido` |
| `empresa_id` | uuid | sim | — | empresa criada com este convite (`usado`) |
| `ip_hash` | text | sim | — | HMAC do IP com `SESSION_SECRET`, só para o limite 11.14; apagado com o pedido |
| `criado_em` | timestamptz | não | `now()` | |

**`rs_empresas`** — o inquilino. Todo dado de recrutamento pertence a uma.

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `slug` | text | não | — | único, `^[a-z0-9](-?[a-z0-9])*$`, 3–40, fora da lista reservada (11.20) |
| `nome` | text | não | — | 2–80 |
| `descricao` | text | sim | — | markdown curto (até 2.000) para a página de carreiras. Nulo = página sem texto |
| `site_url` | text | sim | — | `https://` |
| `logo_path` | text | sim | — | caminho no R2. Nulo = iniciais do nome |
| `cor_destaque` | text | sim | — | `#rrggbb` com contraste AA sobre branco (11.20). Nulo = azul do produto |
| `email_contato` | citext | não | — | `reply-to` de todos os e-mails a candidatos. Padrão: e-mail de quem criou |
| `pagina_publicada` | boolean | não | `false` | página de carreiras e API pública só respondem com `true` |
| `retencao_dias` | smallint | não | 180 | 90–365 (11.12) |
| `talentos_meses` | smallint | não | 12 | 6–24 (11.12) |
| `mensagens_agente` | `rs_mensagens_agente` | não | `confirmar` | 11.8 |
| `aviso_privacidade_extra` | text | sim | — | texto da empresa que aparece abaixo do aviso padrão (até 1.000). Nulo = só o padrão |
| `criada_por_usuario_id` | uuid | não | — | FK `rs_usuarios` |
| `suspensa_em` | timestamptz | sim | — | admin da instância |
| `excluida_em` | timestamptz | sim | — | exclusão agendada (7.4) |
| `criado_em`, `atualizado_em` | timestamptz | não | `now()` | |

**`rs_membros`** — vínculo pessoa × empresa, incluindo convites pendentes.

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `empresa_id` | uuid | não | — | FK |
| `usuario_id` | uuid | sim | — | FK. **Nulo enquanto o convite não foi aceito** |
| `email` | citext | não | — | e-mail convidado; único por empresa entre os não removidos |
| `papel` | `rs_papel_membro` | não | — | |
| `todas_areas` | boolean | não | `true` | só vale para `recrutador`: `false` limita às áreas de `rs_membro_areas` (11.32). Administrador sempre vê tudo; avaliador sempre só a equipe |
| `link_agenda` | text | sim | — | `https://`, variável `{{link_agenda}}` das mensagens. Nulo = variável vazia |
| `convite_token_hash` | text | sim | — | nulo depois de aceito |
| `convite_expira_em` | timestamptz | sim | — | criação + 7 dias; nulo depois de aceito |
| `convidado_por_membro_id` | uuid | sim | — | nulo só para o criador da empresa |
| `aceito_em` | timestamptz | sim | — | |
| `removido_em` | timestamptz | sim | — | soft delete |
| `criado_em` | timestamptz | não | `now()` | |

Índice único parcial (`empresa_id`, `email`) where `removido_em is null`.

**`rs_membro_areas`** — PK (`membro_id`, `area_id`), `criado_em`. Só tem linhas para recrutadores com `todas_areas = false`; um recrutador limitado precisa de pelo menos uma área (checado na função).

**`rs_areas`** — departamentos da empresa (um nível, sem hierarquia).

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `empresa_id` | uuid | não | — | FK |
| `nome` | text | não | — | 2–60; único por empresa entre as não arquivadas (sem diferenciar maiúsculas) |
| `responsavel_pessoa_id` | uuid | sim | — | FK `rs_pessoas`. Vira o dono padrão das vagas novas da área. Nulo = sem responsável |
| `arquivada_em` | timestamptz | sim | — | soft delete; vagas antigas mantêm a área |
| `criado_em`, `atualizado_em` | timestamptz | não | `now()` | |

**`rs_pessoas`** — cadastro de pessoas da empresa que participam do recrutamento: gestores, donos de vaga, entrevistadores. **Não é cadastro de funcionários** nem de candidatos.

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `empresa_id` | uuid | não | — | FK |
| `nome` | text | não | — | 2–120 |
| `email` | citext | não | — | único por empresa entre as não arquivadas |
| `cargo` | text | sim | — | livre ("Gerente financeiro"); nulo = não informado |
| `area_id` | uuid | sim | — | FK `rs_areas`; nulo = sem área |
| `membro_id` | uuid | sim | — | FK `rs_membros`, único. **Nulo = pessoa sem acesso ao sistema.** Preenchido quando a pessoa aceita um convite com o mesmo e-mail (o vínculo é feito por e-mail, na função de entrada) |
| `recebe_resumo` | boolean | não | `true` | só vale para pessoa sem acesso que é dona de vaga: recebe o resumo semanal da 11.31 |
| `arquivada_em` | timestamptz | sim | — | soft delete; vagas antigas mantêm a pessoa |
| `criado_em`, `atualizado_em` | timestamptz | não | `now()` | |

Todo membro tem uma linha em `rs_pessoas` (criada ou ligada quando ele aceita o convite), para que qualquer membro possa ser dono de vaga. O cadastro de pessoas é a lista única de gente da empresa; `rs_membros` diz só quem tem acesso e com que papel.

**`rs_credenciais`** — chaves de API e tokens MCP.

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `empresa_id` | uuid | não | — | FK |
| `tipo` | `rs_tipo_credencial` | não | — | |
| `nome` | text | não | — | dado pelo administrador (`api`) ou `client_name` do OAuth (`mcp`) |
| `prefixo` | text | não | — | 8 primeiros caracteres, para exibição |
| `valor_hash` | text | não | — | SHA-256, único |
| `escopos` | `rs_escopo[]` | não | — | não vazio |
| `membro_id` | uuid | sim | — | obrigatório se `tipo = mcp`; nulo se `api` (check) |
| `oauth_cliente_id` | uuid | sim | — | só `mcp` |
| `criada_por_membro_id` | uuid | não | — | quem criou a chave ou autorizou o agente |
| `ultimo_uso_em` | timestamptz | sim | — | |
| `revogada_em` | timestamptz | sim | — | nulo = ativa |
| `criado_em` | timestamptz | não | `now()` | |

**`rs_oauth_clientes`** — como `as_oauth_clientes` do Assina: `id` (uuid, PK, é o `client_id`), `nome` (text, até 100, padrão "Cliente MCP"), `redirect_uris` (text[], 1–5), `criado_em`.

**`rs_oauth_codigos`** — como `as_oauth_codigos`, com três colunas a mais: `codigo_hash` (text, PK), `cliente_id` (uuid, FK), `empresa_id` (uuid, FK), `membro_id` (uuid, FK), `escopos` (`rs_escopo[]`, não vazio), `redirect_uri` (text), `code_challenge` (text), `expira_em` (criação + 10 min), `usado_em` (nulo até ser trocado pelo token).

**`rs_vagas`**

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `empresa_id` | uuid | não | — | FK |
| `slug` | text | não | — | único por empresa; gerado do título, editável até publicar |
| `titulo` | text | não | — | 3–120 |
| `descricao` | text | não | `''` | markdown, até 20.000. Pode ficar vazio só em `rascunho` (11.1) |
| `requisitos` | text | sim | — | markdown, até 5.000. Nulo = sem seção de requisitos |
| `area_id` | uuid | sim | — | FK `rs_areas` (não arquivada ao criar). Nula = "Sem área", visível só para administradores e recrutadores com todas as áreas (11.32) |
| `dono_pessoa_id` | uuid | sim | — | FK `rs_pessoas`: gestor que pediu a vaga e responde por ela na empresa (pode não ter acesso, 11.31). Padrão: o responsável da área. Nulo = sem dono |
| `modelo_trabalho` | `rs_modelo_trabalho` | não | `presencial` | |
| `cidade` | text | sim | — | obrigatória se `presencial` ou `hibrido` (check) |
| `uf` | char(2) | sim | — | idem |
| `regime` | `rs_regime` | não | `clt` | |
| `salario_min`, `salario_max` | numeric(12,2) | sim | — | nulos = não informado; `max ≥ min` |
| `salario_periodo` | text | sim | — | `mes` ou `hora`; obrigatório se houver salário |
| `mostrar_salario` | boolean | não | `false` | |
| `curriculo_obrigatorio` | boolean | não | `true` | |
| `status` | `rs_status_vaga` | não | `rascunho` | só muda por `rs_fn_transicao_vaga` |
| `encerra_em` | date | sim | — | data-limite opcional (11.11). Nula = sem data |
| `publicada_em` | timestamptz | sim | — | **primeira** publicação; não muda ao republicar |
| `encerrada_em` | timestamptz | sim | — | |
| `motivo_encerramento` | `rs_motivo_encerramento_vaga` | sim | — | obrigatório quando `encerrada` |
| `criado_em`, `atualizado_em` | timestamptz | não | `now()` | |

**`rs_etapas`**

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `vaga_id` | uuid | não | — | FK |
| `nome` | text | não | — | 2–40 |
| `tipo` | `rs_tipo_etapa` | não | — | define o texto que o candidato vê (11.21) |
| `ordem` | smallint | não | — | único (`vaga_id`, `ordem`) deferrable |

Modelo padrão copiado ao criar a vaga (constante em `src/lib/limits.ts`, não tabela): Triagem (`triagem`), Entrevista com RH (`entrevista`), Entrevista com a gestão (`entrevista`), Proposta (`proposta`).

**`rs_perguntas`**

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `vaga_id` | uuid | não | — | FK |
| `ordem` | smallint | não | — | |
| `texto` | text | não | — | 3–300 |
| `tipo` | `rs_tipo_pergunta` | não | — | |
| `opcoes` | text[] | sim | — | 2–10 opções, só `escolha_unica` (check) |
| `obrigatoria` | boolean | não | `true` | |
| `resposta_esperada` | text | sim | — | só `sim_nao` e `escolha_unica`. Nula = sem requisito declarado. Resposta diferente sinaliza (11.10), **nunca reprova** |

**`rs_vaga_equipe`** — PK (`vaga_id`, `membro_id`), `papel_na_vaga` (`rs_papel_na_vaga`), `criado_em`. Uma vaga tem no máximo um `responsavel` (índice único parcial), que é o **recrutador** que conduz o processo; o **dono** da vaga é outra coisa (`rs_vagas.dono_pessoa_id`, quem pediu a contratação). O responsável recebe o resumo diário e os avisos de revisão pedida; sem responsável, vão para os recrutadores no alcance da vaga e para os administradores. Se o dono da vaga tiver acesso, ele entra automaticamente na equipe como `avaliador` (se ainda não estiver).

**`rs_candidatos`** — a pessoa, **dentro de uma empresa**.

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `empresa_id` | uuid | não | — | FK |
| `email` | citext | sim | — | único por empresa quando não nulo. **Nulo depois de anonimizado** |
| `nome` | text | não | — | `Pessoa removida` depois de anonimizado |
| `telefone` | text | sim | — | só dígitos, 10–13 |
| `linkedin_url` | text | sim | — | `https://(www.)?linkedin.com/in/...` |
| `cidade` | text | sim | — | |
| `talentos_consentido_em` | timestamptz | sim | — | nulo = não está no banco de talentos |
| `talentos_expira_em` | timestamptz | sim | — | consentimento + `talentos_meses` |
| `anonimizado_em` | timestamptz | sim | — | |
| `criado_em`, `atualizado_em` | timestamptz | não | `now()` | |

**`rs_candidaturas`**

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `empresa_id` | uuid | não | — | FK (redundante com a vaga, para filtrar sem join; check por trigger) |
| `vaga_id` | uuid | não | — | FK |
| `candidato_id` | uuid | não | — | FK; único (`vaga_id`, `candidato_id`) |
| `etapa_id` | uuid | sim | — | etapa atual. Nula só se a candidatura foi encerrada antes de ter etapa (vaga sem etapas não existe, 11.22) |
| `situacao` | `rs_situacao_candidatura` | não | `ativa` | só muda por `rs_fn_encerra_candidatura` / `rs_fn_reabre_candidatura` |
| `origem` | `rs_origem_candidatura` | não | — | |
| `token_hash` | text | não | — | link `/c/{token}`, único |
| `consentimento_versao` | text | não | — | versão do aviso de privacidade aceito (ex.: `2026-11-20`) |
| `consentimento_em` | timestamptz | não | — | |
| `sinalizada` | boolean | não | `false` | alguma resposta diferente da `resposta_esperada` (11.10) |
| `texto_busca` | tsvector | — | gerada | nome + e-mail + respostas de texto + texto do currículo; índice GIN |
| `movida_em` | timestamptz | não | `now()` | última mudança de etapa ou situação (11.11) |
| `motivo_reprovacao` | `rs_motivo_reprovacao` | sim | — | só `reprovada` |
| `encerrada_em` | timestamptz | sim | — | quando saiu de `ativa` |
| `expurgar_em` | timestamptz | sim | — | `encerrada_em + retencao_dias` (11.12); nula enquanto ativa |
| `revisao_pedida_em` | timestamptz | sim | — | 11.13 |
| `revisao_respondida_em` | timestamptz | sim | — | |
| `criado_em` | timestamptz | não | `now()` | |

Índices: (`empresa_id`, `vaga_id`, `situacao`, `etapa_id`), (`empresa_id`, `movida_em`) where `situacao = 'ativa'`, (`expurgar_em`) where `expurgar_em is not null`.

> `texto_busca` não pode ser coluna gerada porque junta tabelas. É uma coluna comum, recalculada por `rs_fn_atualiza_busca(candidatura_id)`, que roda ao concluir a candidatura, ao terminar a extração do currículo e ao anonimizar.

**`rs_respostas`** — PK (`candidatura_id`, `pergunta_id`), `valor` (text; `sim`/`nao` para `sim_nao`, o texto da opção para `escolha_unica`, número em texto para `numero`), `criado_em`.

**`rs_arquivos`**

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `empresa_id` | uuid | não | — | FK |
| `candidatura_id` | uuid | sim | — | nulo só para `logo` |
| `tipo` | `rs_tipo_arquivo` | não | — | um `curriculo` por candidatura (índice parcial) |
| `path` | text | não | — | `{empresa}/{candidatura}/curriculo.{pdf,docx}` ou `{empresa}/logo.{png,jpg,svg}` |
| `nome_original` | text | não | — | |
| `mime` | text | não | — | |
| `bytes` | integer | não | — | |
| `sha256` | text | sim | — | calculado na conclusão do upload |
| `texto_extraido` | text | sim | — | até 100.000 caracteres; nulo até extrair ou se não houver texto |
| `extracao_status` | `rs_status_extracao` | não | `pendente` | |
| `confirmado_em` | timestamptz | sim | — | nulo = upload iniciado e não concluído (faxina apaga após 24 h) |
| `criado_em` | timestamptz | não | `now()` | |

**`rs_avaliacoes`** — único (`candidatura_id`, `etapa_id`, `membro_id`).

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `candidatura_id`, `etapa_id`, `membro_id` | uuid | não | — | FKs |
| `recomendacao` | `rs_recomendacao` | não | — | |
| `comentario` | text | não | — | 10–5.000 |
| `criado_em`, `atualizado_em` | timestamptz | não | `now()` | editável pelo autor enquanto a candidatura está ativa |

**`rs_notas`** — anotações internas, de pessoas ou agentes.

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `candidatura_id` | uuid | não | — | FK |
| `texto` | text | não | — | 1–10.000 |
| `ator_tipo` | `rs_tipo_ator` | não | — | `membro`, `api` ou `agente` |
| `membro_id` | uuid | sim | — | autor (membro) ou dono do token (agente); nulo para `api` |
| `credencial_id` | uuid | sim | — | nulo se escrita no painel |
| `criado_em` | timestamptz | não | `now()` | notas não se editam; apagar só o próprio autor humano, em até 10 min |

**`rs_decisoes`** — propostas que esperam confirmação humana (regra 11.7).

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `empresa_id` | uuid | não | — | FK |
| `tipo` | `rs_tipo_decisao` | não | — | |
| `candidatura_id` | uuid | sim | — | obrigatória para `reprovar`, `contratar`, `enviar_mensagem` (check) |
| `vaga_id` | uuid | sim | — | obrigatória para `encerrar_vaga` |
| `payload` | jsonb | não | — | validado por zod por tipo: `{motivo, devolutiva}`, `{mensagem}`, `{motivo_encerramento, devolutiva}`, `{assunto, corpo, tipo}` |
| `justificativa` | text | sim | — | texto do agente ou da integração explicando a proposta (até 2.000); aparece na tela de confirmação |
| `status` | `rs_status_decisao` | não | `pendente` | |
| `proposta_por_tipo` | `rs_tipo_ator` | não | — | `api` ou `agente` |
| `proposta_por_membro_id` | uuid | sim | — | dono do token, se agente |
| `credencial_id` | uuid | não | — | |
| `decidida_por_membro_id` | uuid | sim | — | quem confirmou ou descartou |
| `decidida_em` | timestamptz | sim | — | |
| `expira_em` | timestamptz | não | — | criação + 7 dias |
| `criado_em` | timestamptz | não | `now()` | índice único parcial: uma `pendente` por (`tipo`, `candidatura_id`) e por (`tipo`, `vaga_id`) |

**`rs_modelos_mensagem`** — personalização por empresa dos modelos padrão (que vivem em `src/lib/copy.ts`). PK `id`, `empresa_id`, `chave` (`confirmacao`, `devolutiva_padrao`, `devolutiva_vaga_preenchida`, `devolutiva_vaga_cancelada`, `convite_entrevista`, `convite_vaga`, `contratacao`, livre para modelos novos da empresa), `nome`, `assunto`, `corpo`, `atualizado_em`. Único (`empresa_id`, `chave`). Sem linha = usa o padrão do código.

**`rs_mensagens`** — tudo que foi enviado a um candidato.

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `empresa_id`, `candidatura_id` | uuid | não | — | FKs |
| `tipo` | `rs_tipo_mensagem` | não | — | |
| `assunto` | text | não | — | já com as variáveis resolvidas |
| `corpo` | text | não | — | idem; texto puro com quebras de linha |
| `ator_tipo`, `membro_id`, `credencial_id` | — | — | — | quem enviou (mesmas regras de `rs_notas`); `sistema` para a confirmação automática |
| `decisao_id` | uuid | sim | — | se veio de proposta confirmada |
| `notificacao_id` | uuid | não | — | FK `rs_notificacoes` |
| `criado_em` | timestamptz | não | `now()` | |

**`rs_eventos`** — trilha, só inserção (regra 11.6).

| Coluna | Tipo | Nulo | Padrão | Nota |
|---|---|---|---|---|
| `id` | bigint identity | não | — | PK |
| `empresa_id` | uuid | não | — | FK |
| `vaga_id` | uuid | sim | — | |
| `candidatura_id` | uuid | sim | — | |
| `tipo` | text | não | — | catálogo fechado da seção 15.3 (check) |
| `ator_tipo` | `rs_tipo_ator` | não | — | |
| `membro_id` | uuid | sim | — | membro que agiu, ou dono do token se `agente` |
| `credencial_id` | uuid | sim | — | |
| `autorizado_por_membro_id` | uuid | sim | — | quem confirmou a decisão (quando o evento nasce de uma proposta) |
| `origem` | `rs_origem_evento` | não | — | |
| `dados` | jsonb | não | `'{}'` | **sem dado pessoal**: ids, de/para, contagens, motivo interno |
| `criado_em` | timestamptz | não | `now()` | índices (`empresa_id`, `candidatura_id`, `id`) e (`empresa_id`, `id`) |

**`rs_notificacoes`** — fila de e-mail idempotente, como `as_notificacoes` do Assina: `id`, `empresa_id` (nulo só nas notificações de pedido de convite), `candidatura_id` (nulo em notificações de membro; usado para descartar as pendentes na anonimização), `tipo` (`rs_tipo_notificacao`), `destinatario` (citext), `chave_idempotencia` (text, única: ex. `devolutiva:{candidatura_id}`), `assunto`, `html`, `texto`, `reply_to`, `status`, `tentativas`, `ultimo_erro` (sem dado pessoal), `enviar_apos`, `enviada_em`, `resend_id`, `criado_em`.

**`rs_webhooks`** — `id`, `empresa_id`, `url` (https), `segredo_cifrado` (AES-256-GCM com `CHAVES_ENC_KEY`), `eventos` (text[] do catálogo 13.4), `ativo`, `criado_em`. Até 5 por empresa.

**`rs_entregas_webhook`** — como `as_entregas_webhook`: `id`, `empresa_id`, `webhook_id` (FK), `evento_id` (bigint, FK `rs_eventos`), `tipo` (text do catálogo 13.4), `corpo` (jsonb), `status` (`rs_status_entrega`), `tentativas` (smallint, máx. 8), `ultimo_status_http` (smallint, nulo antes da 1ª tentativa), `proxima_tentativa_em`, `reservada_em` (nulo fora de envio), `criado_em`, `entregue_em`. Único (`webhook_id`, `evento_id`).

### 7.4 Exclusão

| Entidade | Estratégia | Detalhe |
|---|---|---|
| Usuário | não se exclui no MVP: remove-se das empresas; "Excluir minha conta" só se não for o último administrador de nenhuma empresa → anonimiza `email` (`excluido-{id}@invalid`), `nome` e `google_sub` | |
| Empresa | `excluida_em` + expurgo na faxina **7 dias depois** (dá para desfazer nesse prazo): apaga arquivos no R2 (por prefixo `{empresa}/`), depois todas as linhas da empresa em cascata | Exige digitar o slug. Vagas publicadas saem da página na hora |
| Membro | soft delete (`removido_em`); revoga os tokens MCP dele na mesma transação; a linha em `rs_pessoas` perde o `membro_id` e continua (sem acesso) | Notas, avaliações e eventos continuam com o `membro_id` |
| Área | soft delete (`arquivada_em`); só sem vaga `publicada` ou `pausada` nela; recrutadores limitados que ficariam sem nenhuma área ativa impedem o arquivamento (11.32) | Vagas encerradas mantêm a área |
| Pessoa | soft delete (`arquivada_em`); só se não for membro ativo nem dona de vaga `rascunho`, `publicada` ou `pausada` | Vagas antigas mantêm o dono |
| Vaga | hard delete **só em `rascunho`**; depois disso, só encerrar | |
| Etapa | hard delete só sem candidaturas nela (11.22) | |
| Pergunta | hard delete só se a vaga nunca foi publicada; depois, só desativar não existe no MVP: perguntas ficam congeladas a partir da publicação (11.1) | |
| Candidatura | **anonimização** no expurgo (11.12) ou a pedido do candidato (11.13): apaga arquivos, respostas, notas, avaliações (comentário vira `''`, recomendação fica para as métricas), mensagens (corpo e assunto viram `''`), e anonimiza o candidato se ele não tiver outra candidatura viva nem consentimento de talentos válido | A linha da candidatura fica (vaga, etapa alcançada, datas, origem, situação) para métricas sem dado pessoal |
| Credencial | revogação (`revogada_em`), nunca delete | |
| Pedido de convite | hard delete pela faxina: `recusado` e `vencido` 90 dias depois da decisão; `usado` fica (liga a empresa ao pedido) até a empresa ser excluída | |
| Evento | nunca (trigger) | não contém dado pessoal |
| Notificação | delete das `enviada`/`descartada` com mais de 30 dias (faxina) | o HTML contém dado pessoal |

### 7.5 Lógica no banco

Todas as funções em `plpgsql`, `SECURITY INVOKER`, `search_path=''`, chamadas só pela service role. Cada uma registra seu evento por `rs_fn_registra_evento` **na mesma transação**.

| Nome | Tipo | O que faz |
|---|---|---|
| `rs_fn_registra_evento(empresa, vaga, candidatura, tipo, ator jsonb, origem, dados)` | função | Única porta de escrita em `rs_eventos`. Valida o `tipo` contra o catálogo |
| `rs_tg_eventos_imutaveis` | trigger `before update or delete` em `rs_eventos` | Levanta erro sempre, com uma exceção: o delete em cascata do expurgo de uma empresa excluída (7.4), liberado pela variável de sessão `rs.expurgo_empresa = '{empresa_id}'`, setada só por `rs_fn_expurga_empresa` |
| `rs_fn_expurga_empresa(empresa)` | função | Apaga a empresa e tudo dela, 7 dias depois de `excluida_em` (os arquivos no R2 são apagados antes pelo servidor, por prefixo) |
| `rs_fn_entra_usuario(google_sub, email, nome, foto)` | função | Cria ou atualiza o usuário pelo `google_sub`, aceita convites pendentes do e-mail (11.24), liga o membro à pessoa de mesmo e-mail em cada empresa (cria a pessoa se não houver), devolve usuário e empresas |
| `rs_fn_pede_convite(email, nome, empresa_nome, uso, ip_hash)` | função | Cria o pedido `pendente` (ou devolve o pendente existente do e-mail sem criar outro) e enfileira `pedido_convite_recebido` (ao solicitante) e `pedido_convite_admin` (aos administradores da instância) |
| `rs_fn_decide_convite(pedido, usuario_admin, aprovar)` | função | `pendente` → `aprovado` (com `aprovado_ate`) ou `recusado`; enfileira o e-mail correspondente |
| `rs_fn_cria_empresa(usuario, slug, nome, email_contato, pedido?)` | função | Com `CRIACAO_EMPRESA=convite`, exige pedido `aprovado`, não vencido e do mesmo e-mail do usuário (ou usuário administrador da instância); marca o pedido `usado`. Cria empresa + membro administrador + pessoa dele; evento `empresa_criada` |
| `rs_fn_convida_membro(empresa, email, papel, todas_areas, areas, ator)` | função | Convite com token (7 dias); se já houver pessoa com o e-mail, usa o nome dela |
| `rs_fn_muda_acesso(membro, papel, todas_areas, areas, ator)` | função | Muda papel e áreas; revoga os tokens MCP do membro na mesma transação; recusa deixar a empresa sem administrador (11.26) ou recrutador limitado sem área (11.32) |
| `rs_fn_remove_membro(membro, ator)` | função | Soft delete, revoga tokens, desliga a pessoa do membro; 11.26 |
| `rs_fn_salva_area(empresa, id?, nome, responsavel, ator)` / `rs_fn_arquiva_area` | funções | Cria ou edita área; arquivar segue a 7.4 |
| `rs_fn_salva_pessoa(empresa, id?, dados, ator)` / `rs_fn_arquiva_pessoa` / `rs_fn_da_acesso(pessoa, papel, areas, ator)` | funções | Cadastro de pessoas; "dar acesso" cria o convite para o e-mail da pessoa |
| `rs_fn_cria_vaga(empresa, ator, alcance, dados)` | função | Vaga em rascunho + etapas do modelo padrão; slug único; área precisa estar no alcance do ator; dono padrão = responsável da área; dono com acesso entra na equipe como avaliador |
| `rs_fn_transicao_vaga(vaga, para, ator, origem, motivo, devolutiva)` | função | Aplica a máquina 12.1. Para `encerrada`, chama `rs_fn_encerra_candidatura` para cada ativa com `encerrada_vaga` e a devolutiva |
| `rs_tg_vaga_congelada` | trigger `before update` em `rs_vagas`, `rs_perguntas` | Vaga `encerrada` não muda nada; perguntas de vaga já publicada não mudam (11.1) |
| `rs_fn_cria_candidatura(empresa, vaga, candidato jsonb, respostas jsonb, origem, ator, consentimento)` | função | Upsert do candidato por e-mail na empresa, candidatura na 1ª etapa, respostas, `sinalizada` (11.10), token, consentimento de talentos se marcado. Recusa duplicada (11.3) devolvendo o id existente |
| `rs_fn_conclui_candidatura(candidatura, arquivo)` | função | Marca o arquivo confirmado, enfileira `candidatura_recebida`, evento `candidatura_criada` (o webhook nasce aqui) |
| `rs_fn_move_etapa(candidatura, etapa, ator, origem)` | função | Só em `ativa`, etapa da mesma vaga; `movida_em = now()` |
| `rs_fn_encerra_candidatura(candidatura, situacao, ator, origem, motivo, devolutiva jsonb, decisao)` | função | `ativa` → final. Exige devolutiva para `reprovada` e `encerrada_vaga` (11.5); grava `rs_mensagens` e enfileira o e-mail na mesma transação; calcula `expurgar_em` |
| `rs_fn_reabre_candidatura(candidatura, membro)` | função | Final → `ativa` (11.23); limpa `encerrada_em`, `expurgar_em` e `motivo_reprovacao` |
| `rs_tg_situacao_candidatura` | trigger `before update` em `rs_candidaturas` | Recusa transição fora da tabela 12.2 e mudança de `situacao` sem a variável de sessão `rs.transicao = 'on'` setada pelas duas funções acima |
| `rs_tg_etapa_da_vaga` | trigger | `etapa_id` pertence à mesma vaga; `empresa_id` igual ao da vaga |
| `rs_fn_registra_avaliacao(candidatura, etapa, membro, recomendacao, comentario)` | função | Upsert; recusa avaliador fora da equipe e candidatura não ativa |
| `rs_fn_propoe_decisao(...)` | função | Cria `rs_decisoes` pendente; recusa se já houver uma igual (índice) |
| `rs_fn_confirma_decisao(decisao, membro)` / `rs_fn_descarta_decisao(decisao, membro, motivo)` | funções | Confirmar chama a função de destino (`rs_fn_encerra_candidatura`, `rs_fn_transicao_vaga` ou envio de mensagem) com `autorizado_por = membro`, tudo na mesma transação. Proposta vencida ou cujo alvo mudou (candidatura não está mais ativa) vira `expirada` e não executa |
| `rs_fn_envia_mensagem(candidatura, tipo, assunto, corpo, ator, decisao)` | função | `rs_mensagens` + notificação idempotente |
| `rs_fn_pede_revisao(candidatura)` / `rs_fn_responde_revisao(candidatura, membro, texto)` | funções | 11.13 |
| `rs_fn_anonimiza_candidatura(candidatura, motivo)` | função | Faz o que diz a seção 7.4; devolve os `path` a apagar no R2 (o servidor apaga **depois** do commit e a faxina repassa os que falharem) |
| `rs_fn_exclui_dados_candidato(candidatura)` | função | A pedido do titular: encerra as ativas da pessoa na empresa como `desistiu` (sem e-mail), retira o consentimento de talentos e anonimiza todas as candidaturas da pessoa na empresa |
| `rs_fn_atualiza_busca(candidatura)` | função | Recalcula `texto_busca` |
| `rs_fn_faxina_expurgos()`, `rs_fn_faxina_paradas()`, `rs_fn_faxina_vagas_vencidas()`, `rs_fn_faxina_decisoes()`, `rs_fn_faxina_talentos()` | funções | Devolvem o que a faxina diária (8.10) precisa processar, cada uma em lotes de até 200 |
| `rs_tg_atualizado_em` | trigger | Em todas as tabelas com `atualizado_em` |

### 7.6 Seed e migrations

- Migrations em `supabase/migrations/AAAAMMDDHHMMSS_rs_<assunto>.sql`. Aplicadas **no local e no remoto** pelo MCP `apply_migration` com o mesmo SQL. **Nunca `supabase db push`** no projeto compartilhado.
- Depois de cada DDL: `get_advisors` (security e performance) filtrando `rs_*`, e regenerar `supabase/schema.sql` filtrado a `rs_`.
- Sem seed de produção. `supabase/seed.sql` (só local) cria uma empresa "Padaria Exemplo" com duas áreas (Loja, Administrativo), quatro pessoas (duas sem acesso), três membros (administrador, recrutador limitado à Loja, avaliador), duas vagas e cinco candidaturas fictícias, para os testes manuais e as screenshots.
- O catálogo de tipos de evento (15.3) entra como check constraint; mudar o catálogo é migration nova.

---
## 8. Épicos e critérios de aceite

**Ordem dentro de cada épico (princípio 1):** função de domínio em `src/server/` com testes → rota da API v1 → ferramenta do MCP → tela do painel. Um épico não termina com a tela pronta e a API faltando. O OpenAPI (`/docs/api`) e a lista de ferramentas do MCP crescem a cada épico.

### 8.0 Guardrails
**Objetivo:** instalar o kit do Anexo B antes de qualquer código.
- [ ] `.claude/settings.json`, os hooks e `.claude/agents/verifier.md` do Anexo B instalados e executáveis; `REVIEW.md` na raiz.
- [ ] Cada hook testado uma vez com uma escrita que deveria ser bloqueada (registrar em `plans/8.0.md`).
- [ ] `CLAUDE.md` de uma página criado com "Regra de ouro", "Estado", "Convenções", "Comandos" e "Pegadinhas".

### 8.1 Fundação: projeto, banco, login e administração da empresa
**Objetivo:** app no ar com login Google, criação de empresa e as funções de administrador: equipe, áreas e pessoas.
**Fluxo:** `/entrar` → Google → boas-vindas (aceite dos termos) → "Criar empresa" (nome, endereço da página `/{slug}`, e-mail de contato) → `/painel/{slug}`. Administrador cria as áreas, cadastra as pessoas (gestores com e sem acesso) e convida membros (ou "Dar acesso" numa pessoa) → convidado abre o link → entra com o Google do mesmo e-mail → aparece na empresa, já ligado à pessoa.
- [ ] Premissas (a)–(d) da seção 4 conferidas e registradas no plano.
- [ ] Migrations das tabelas, enums, funções e triggers da seção 7 aplicadas no local e no remoto; advisors sem alerta crítico em `rs_*`.
- [ ] pgTAP: `anon` e `authenticated` não leem nem escrevem nenhuma `rs_*`; `rs_eventos` recusa update e delete; `rs_tg_situacao_candidatura` recusa transição proibida.
- [ ] Login Google funciona; não existe outra forma de entrar; conta Google com `email_verified = false` é recusada.
- [ ] Slug reservado ou em uso é recusado com a mensagem da seção 15; slug válido aparece em tempo real como `{site}/{slug}`.
- [ ] Convite aceito só com a conta Google do mesmo e-mail (11.24); outra conta mostra "Este convite é para {email}" com "Entrar com outra conta"; convite vencido mostra "Convite vencido"; o último administrador não consegue se remover nem mudar o próprio papel (11.26).
- [ ] Equipe: convidar (e-mail, papel, áreas se recrutador), reenviar e cancelar convite, mudar papel e áreas, remover. Remover ou mudar o papel revoga os tokens MCP do membro na mesma transação (teste) e a sessão dele perde o acesso na requisição seguinte.
- [ ] Áreas: criar, renomear, definir responsável, arquivar (com as recusas da 7.4).
- [ ] Pessoas: cadastrar com nome, e-mail, cargo e área; o selo "Com acesso · {papel}" ou "Sem acesso"; "Dar acesso" vira convite; ao aceitar, a pessoa fica ligada ao membro sem duplicar.
- [ ] Recrutador limitado a uma área não vê vagas de outras áreas nem as "Sem área", em nenhuma porta (teste com duas áreas; 11.32).
- [ ] Pedido de convite (11.33): formulário em `/pedir-convite` com honeypot e limite por IP; e-mail de recebimento ao solicitante e aviso aos administradores da instância; `/admin/convites` lista pendentes, aprovados e recusados com "Aprovar" e "Recusar"; aprovado recebe o link; com outro e-mail Google, "Criar empresa" mostra a mensagem da seção 15; pedido usado não cria segunda empresa; usuário sem pedido aprovado vê "Pedir convite" no lugar de "Criar empresa" (teste com `CRIACAO_EMPRESA=convite` e `aberta`).
- [ ] Usuário em duas empresas vê a escolha em `/painel`; usuário em uma vai direto para ela.
- [ ] Menu lateral (seção 16) com a empresa atual e o seletor de empresa no topo.

### 8.2 Credenciais, API v1 e MCP: o esqueleto headless
**Objetivo:** as três portas existem e se autenticam antes de existir produto, para que cada épico seguinte só acrescente rotas e ferramentas.
**Fluxo:** Integrações → "Nova chave" (nome + escopos) → chave mostrada uma vez → `curl -H "Authorization: Bearer rsk_…" /api/v1/empresa` responde. No claude.ai, "Adicionar conector" com `{site}/mcp` → login → escolha de empresa e escopos → "Permitir" → a ferramenta `quem_sou_eu` responde empresa, membro, papel e escopos.
- [ ] `requireCredencial` com as respostas 401/403 da seção 6.3; teste de cada escopo.
- [ ] Chave mostrada uma vez; a lista mostra nome, prefixo, escopos, último uso e "Revogar".
- [ ] OAuth completo (6.4) com DCR, PKCE S256, escolha de empresa e de escopos limitada pelo papel (11.16); avaliador não vê as caixas `escrita` e `decisao`.
- [ ] `GET /api/v1/empresa` e a ferramenta `quem_sou_eu` funcionando; `/docs/api` serve o OpenAPI 3.1 gerado dos schemas zod.
- [ ] Mudar o papel de um membro ou removê-lo revoga os tokens MCP dele na mesma transação (teste).
- [ ] Todas as respostas de erro seguem `{codigo, mensagem}` (13.2) e nenhuma traz dado pessoal.

### 8.3 Vagas e página de carreiras
**Objetivo:** criar, publicar, pausar e encerrar vagas pelas três portas, com página pública indexável.
**Fluxo:** "+ Nova vaga" (ou `criar_vaga`) → área e dono da vaga (o responsável da área vem preenchido) → rascunho com etapas padrão → editar descrição, local, regime, salário, perguntas, etapas, equipe → "Publicar" → aparece em `/{empresa}` e `/{empresa}/vagas/{slug}`, no feed, no sitemap e na API pública.
- [ ] Validação da regra 11.1 igual nas três portas (mesmo schema zod).
- [ ] Área fora do alcance do recrutador é recusada (403 `fora_do_alcance`); trocar a área de uma vaga só para outra área do alcance.
- [ ] Dono da vaga escolhido no cadastro de pessoas (busca por nome); se tiver acesso, entra na equipe como avaliador; se não tiver, aparece "Sem acesso · recebe resumo semanal" (11.31) com o botão "Dar acesso" (administrador).
- [ ] Lista de vagas filtra por área e por dono; a página de carreiras filtra por área (nome da área, nunca o dono).
- [ ] Rascunho: tudo editável. Publicada: perguntas congeladas, o resto editável. Encerrada: nada muda (trigger + teste).
- [ ] Página de carreiras só responde com `pagina_publicada = true`; antes disso, a pré-visualização em `/painel/{empresa}/pagina` mostra como ficará com a faixa "Página ainda não publicada".
- [ ] A página da vaga tem JSON-LD `JobPosting` conforme a regra 11.20, validado em teste contra o schema e manualmente no Teste de Pesquisa Aprimorada do Google (registrar a captura no plano).
- [ ] Vaga pausada ou encerrada: a página responde 200 com "Esta vaga não recebe mais candidaturas" e **sem** JSON-LD; sai do sitemap e do feed.
- [ ] `GET /{empresa}/vagas.xml` (feed) e `GET /api/publico/{empresa}/vagas` (JSON) listam só publicadas.
- [ ] Encerrar pelo painel com candidaturas ativas mostra quantas pessoas vão receber a devolutiva e o texto, antes de confirmar. Pela API/MCP vira proposta (11.7).
- [ ] Data-limite vencida: a faxina pausa a vaga e avisa o responsável (11.11).
- [ ] Ferramentas MCP: `listar_vagas`, `ver_vaga`, `criar_vaga`, `editar_vaga`, `publicar_vaga`, `pausar_vaga`, `encerrar_vaga`.

### 8.4 Candidatura e link de acompanhamento
**Objetivo:** a pessoa se candidata em menos de três minutos e acompanha pelo link.
**Fluxo:** página da vaga → "Candidatar-me" → formulário único (nome, e-mail, telefone, LinkedIn, currículo, perguntas, aviso de privacidade, caixa opcional do banco de talentos) → "Enviar candidatura" → upload direto ao R2 → tela "Candidatura enviada" → e-mail com o link `/c/{token}`.
- [ ] Formulário numa tela só, que funciona em 375 px e com teclado; erros por campo com a copy da seção 15.
- [ ] Currículo PDF ou DOCX até 5 MB (11.2), conferido no navegador e de novo no servidor (tipo real pelos bytes iniciais, não pela extensão).
- [ ] Mesmo e-mail na mesma vaga: não cria outra; mostra "Você já se candidatou a esta vaga. Enviamos o link de acompanhamento de novo para o seu e-mail." (11.3).
- [ ] Extração de texto em segundo plano ao concluir (`after()` do Next); PDF sem texto marca `sem_texto` sem erro para o candidato.
- [ ] Limites anti-abuso da 11.14 (por IP, por vaga) e o campo-armadilha escondido (honeypot) recusam envio automatizado com 429 ou 400 sem revelar o motivo.
- [ ] `/c/{token}` mostra empresa, vaga, data, situação na linguagem da 11.21 e as ações da seção 10; token inválido mostra "Link não encontrado" com "Perdi o link".
- [ ] "Retirar candidatura" → `desistiu` com e-mail de confirmação; "Baixar meus dados" → JSON (14.2); "Excluir meus dados" → código por e-mail → anonimização imediata (11.13).
- [ ] API pública: `POST /api/publico/{empresa}/vagas/{slug}/candidaturas` com o mesmo contrato e os mesmos limites. Com chave `escrita`: `POST /api/v1/candidaturas` (origem `integracao`). Ferramenta MCP `adicionar_candidato` (origem `manual`, 11.2).

### 8.5 Funil: etapas, avaliações, notas e busca
**Objetivo:** conduzir as candidaturas pelas etapas, com a opinião de cada avaliador registrada sem viés.
**Fluxo:** Vaga → abas por etapa com contagem → candidatura → currículo ao lado, respostas, avaliações, notas, histórico → "Mover para…" → "Avaliar" (recomendação + comentário).
- [ ] Lista por etapa com filtros (sinalizadas, paradas há 7+ dias, com avaliação pendente minha) e busca no texto (11.28); ordenação por chegada ou por última movimentação.
- [ ] Mover leva um toque no painel e uma chamada na API/MCP; não move candidatura não ativa.
- [ ] Avaliador só vê as vagas da equipe; só vê as avaliações dos outros depois de registrar a dele na etapa (11.9); recrutador e administrador veem tudo (teste nas três portas).
- [ ] Notas de agente aparecem com o selo "Agente · em nome de {membro}" e notas de integração com "Integração · {nome da chave}".
- [ ] Respostas que não batem com a `resposta_esperada` mostram o selo "Não atende: {pergunta}" e a candidatura aparece em "Sinalizadas"; **nada é movido nem encerrado** por isso (teste).
- [ ] Editar etapas com candidaturas: renomear e reordenar funcionam; excluir etapa com candidatura pede para mover antes (11.22).
- [ ] Ferramentas MCP: `listar_candidaturas`, `ver_candidatura`, `ler_curriculo`, `mover_etapa`, `adicionar_nota`, `buscar_candidaturas`, `resumo_da_vaga`.

### 8.6 Decisões, devolutivas e mensagens
**Objetivo:** encerrar candidaturas sempre com resposta e sempre com uma pessoa decidindo.
**Fluxo (painel):** candidatura → "Reprovar" → motivo interno + devolutiva (pré-preenchida pelo modelo, editável) → "Reprovar e enviar" → e-mail ao candidato. **Fluxo (agente):** `reprovar_candidatura` com motivo, devolutiva e justificativa → resposta "Proposta criada; aguardando confirmação de um recrutador no painel" → painel mostra o contador em "Para confirmar" → membro confirma (uma a uma ou em lote) → executa.
- [ ] Nenhum caminho leva a `reprovada` ou `encerrada_vaga` sem devolutiva com 20+ caracteres (11.5); teste nas três portas e no banco.
- [ ] Pela API e pelo MCP, `reprovar_candidatura`, `marcar_contratada` e `encerrar_vaga` (com ativas) **nunca** executam: criam proposta (teste com chave que tem todos os escopos).
- [ ] "Para confirmar": lista com candidato, vaga, tipo, quem propôs (agente em nome de quem, ou integração), justificativa, texto que o candidato vai receber (editável antes de confirmar) e "Confirmar" / "Descartar". Confirmar em lote até 50 (11.7).
- [ ] Proposta cujo alvo mudou (candidatura já encerrada, vaga já encerrada) vira `expirada` e mostra "Esta proposta não vale mais: {motivo}".
- [ ] Resumo diário por e-mail aos recrutadores com propostas pendentes há mais de 24 h (notificação `decisoes_pendentes`).
- [ ] Mensagens: "Enviar mensagem" com modelo (variáveis da 11.29) ou texto livre; pelo agente, segue `mensagens_agente` (11.8).
- [ ] Modelos editáveis em Empresa → Mensagens, com pré-visualização com dados fictícios e "Voltar ao padrão".
- [ ] "Reabrir candidatura" (11.23) e resposta a pedido de revisão (11.13) funcionam e aparecem no histórico.
- [ ] Ferramentas MCP: `reprovar_candidatura`, `marcar_contratada`, `enviar_mensagem`, `listar_propostas`, `listar_modelos_mensagem`.

### 8.7 Banco de talentos
**Objetivo:** reaproveitar quem consentiu, sem guardar quem não consentiu.
- [ ] Busca só entre candidatos com consentimento válido (`talentos_expira_em > now()`), por texto e por vaga anterior.
- [ ] "Convidar para uma vaga" envia a mensagem `convite_vaga` com o link da vaga publicada; **não cria candidatura**: a pessoa decide se aplica (origem `banco_talentos` quando aplicar pelo link do convite, com `?convite={id}`).
- [ ] 30 dias antes de vencer, o candidato recebe `talentos_expirando` com o link para renovar em `/c/{token}`; ao vencer, sai do banco e entra na regra de expurgo normal (11.12).
- [ ] O candidato liga e desliga o consentimento em `/c/{token}` a qualquer momento.
- [ ] Ferramentas MCP: `buscar_talentos`, `convidar_para_vaga`.

### 8.8 Webhooks e trilha
**Objetivo:** automações reagem a eventos; toda ação tem autor.
- [ ] Webhooks com o catálogo da seção 13.4, HMAC SHA-256 no cabeçalho `X-Contrata-Assinatura`, retentativas e "Enviar teste" na tela (como no Assina).
- [ ] Histórico da candidatura mostra cada evento com rótulo da 15.3 e o ator: "Ana (painel)", "Claude · em nome de Ana", "Integração n8n", "Sistema", "Candidato", e, para decisão confirmada, "proposto por Claude · em nome de Ana · confirmado por Bruno".
- [ ] `GET /api/v1/eventos?desde={id}` para sincronização incremental.

### 8.9 Empresa, LGPD e configurações
**Objetivo:** o administrador configura a página, a retenção e o texto de privacidade.
- [ ] Empresa: nome, logo (PNG, JPG ou SVG sanitizado, até 1 MB), cor de destaque com conferência de contraste (11.20), descrição, site, e-mail de contato, publicar ou despublicar a página.
- [ ] Retenção (90–365 dias) e validade do banco de talentos (6–24 meses), com o texto que explica o efeito; mudar a retenção recalcula `expurgar_em` só das candidaturas encerradas **depois** da mudança (assunção 24.6).
- [ ] Aviso de privacidade: o padrão (seção 15) mais o texto extra da empresa; a versão do aviso muda quando o texto extra muda e é gravada em cada candidatura.
- [ ] "Excluir empresa" com digitação do slug e prazo de 7 dias para desfazer (7.4).

### 8.10 Faxina diária
**Objetivo:** o que depende de tempo acontece sozinho.
- [ ] `/api/cron/diario` protegido por `CRON_SECRET`, idempotente (rodar duas vezes no mesmo dia não duplica e-mail).
- [ ] Na ordem: expira convites de membro vencidos → expira propostas → pausa vagas vencidas → expurga candidaturas e empresas vencidas (e apaga os arquivos) → apaga uploads não confirmados com mais de 24 h → tira do banco de talentos quem venceu e avisa quem vence em 30 dias → resumo diário por responsável (paradas há 14+ dias, revisões pedidas, propostas pendentes) → às segundas, resumo semanal aos donos de vaga sem acesso (11.31) → retenta notificações e webhooks → limpa notificações antigas.
- [ ] Cada passo em lotes de 200 e com tempo total menor que 50 s; o que sobrar fica para o dia seguinte e é registrado no log (contagens, nunca dados pessoais).

### 8.11 Analytics
- [ ] Eventos da seção 21 enviados do servidor quando `VISAO_INGEST_URL` e `VISAO_API_KEY` existem; sem elas, nenhuma chamada e nenhum erro.
- [ ] Teste de compilação do tipo fechado de propriedades.

### 8.12 Página inicial, páginas legais, auto-hospedagem e entrega
- [ ] `/` com o que é, para quem, o que não faz, o aviso de que é uma instância de demonstração, "Pedir convite" (ou "Criar empresa" com `CRIACAO_EMPRESA=aberta`) e "Ver no GitHub"; `/privacidade`, `/termos`, `/docs/api`, `/docs/mcp` (como conectar no Claude, ChatGPT e Claude Code) e `/docs/auto-hospedagem`.
- [ ] README com auto-hospedagem passo a passo: Supabase, R2 (ou S3), Resend (conta própria; o plano gratuito serve para testar), Google (obrigatório), Vercel, variáveis, `CRIACAO_EMPRESA` e `ADMIN_INSTANCIA_EMAILS`, migrations.
- [ ] `robots.txt` e `sitemap.xml` (seção 17), incluindo as páginas de carreiras publicadas e as vagas publicadas.
- [ ] `DOCUMENTACAO-TECNICA.md`, `CLAUDE.md`, `README.md` e `THIRD_PARTY_NOTICES.md` em dia; Definition of Done (seção 26) completo.

---

## 9. Fluxos principais ponta a ponta

### 9.1 Vaga do começo ao fim pelo Claude
0. Antes: Carla (administradora) criou as áreas Financeiro e Loja, cadastrou o gestor Bruno (Financeiro, com acesso como avaliador) e a gerente Dora (Loja, sem acesso), e convidou Ana como recrutadora de todas as áreas.
1. Ana (recrutadora) conecta o Contrata no claude.ai, escolhe a empresa e marca os três escopos.
2. "Abra uma vaga de assistente administrativo no Financeiro, para o Bruno, CLT, presencial em Campinas, 2.800 a 3.200, com estas atividades…" → `listar_areas` + `listar_pessoas` + `criar_vaga` (rascunho, área Financeiro, dono Bruno, que entra na equipe) → o Claude mostra o resumo e o link da pré-visualização → "publique" → `publicar_vaga`.
3. Candidaturas chegam pela página; cada uma gera e-mail de confirmação e o webhook `candidatura.criada`.
4. Três dias depois: "resuma as candidaturas da triagem frente aos requisitos" → `listar_candidaturas` + `ler_curriculo` → o Claude escreve o resumo e, a pedido, `adicionar_nota` em cada uma ("Agente · em nome de Ana").
5. "Mova as 6 que atendem para entrevista com RH" → `mover_etapa` ×6 (direto, não é decisão).
6. "Reprove as que não têm experiência com faturamento, com uma devolutiva gentil" → `reprovar_candidatura` ×N → propostas.
7. Ana abre "Para confirmar" no painel, lê, ajusta uma devolutiva e confirma em lote → candidaturas `reprovada`, e-mails enviados, histórico "proposto por Claude · em nome de Ana · confirmado por Ana".
8. Bruno (gestor, avaliador) entrevista e registra avaliações pelo celular.
9. Ana marca a contratada no painel; propõe encerrar a vaga → confirma no mesmo passo (ela está no painel) → as ativas restantes recebem a devolutiva de vaga preenchida.
10. 180 dias depois, a faxina anonimiza as candidaturas encerradas de quem não está no banco de talentos.

### 9.2 Candidatura pela API pública (página da própria empresa)
1. O site da empresa lista vagas com `GET /api/publico/{empresa}/vagas`.
2. O formulário do site faz `POST …/candidaturas` com os dados e recebe `upload_url`.
3. O navegador envia o currículo para `upload_url` e chama `POST …/candidaturas/{id}/concluir`.
4. O candidato recebe o mesmo e-mail com o link `/c/{token}`; o site da empresa nunca vê o token.

### 9.3 Integração (n8n)
1. Webhook `candidatura.contratada` → n8n cria o pré-cadastro no sistema de admissão da empresa.
2. Toda segunda, n8n chama `GET /api/v1/vagas/{id}/resumo` e posta no canal do time.

### 9.4 Caminhos de exceção
- **Candidato sem currículo em vaga que exige:** botão desabilitado com "Anexe seu currículo para enviar."
- **Upload interrompido:** a candidatura fica sem `confirmado_em` e não aparece para a empresa; a pessoa vê "O envio não terminou" com "Tentar de novo" (a mesma candidatura). A faxina apaga após 24 h.
- **Candidato pede exclusão com candidatura em entrevista:** a candidatura vira `desistiu` sem e-mail, os dados somem e o histórico mostra "Dados excluídos a pedido do titular".
- **Agente propõe reprovar e, antes da confirmação, alguém move a candidatura:** a proposta continua válida (o alvo ainda está ativo); a tela de confirmação mostra a etapa atual.
- **Membro removido com propostas dele pendentes:** continuam; a tela mostra "proposta por Claude · em nome de {nome} (removido)".
- **Dono da vaga sem acesso quer opinar:** o resumo semanal traz o botão "Pedir acesso", que avisa os administradores; até lá, a opinião dele entra como nota do recrutador.
- **Gestor sai da empresa:** o administrador remove o membro; as vagas dele continuam com ele como dono (sem acesso) até alguém trocar o dono; o resumo para de ir se a pessoa for arquivada.
- **E-mail da devolutiva falha:** a candidatura fica encerrada (a decisão aconteceu), a notificação fica `falhou` e é retentada pela faxina; o detalhe mostra "E-mail não entregue · tentar de novo".
- **Vaga encerrada com 400 candidaturas ativas:** a função processa em uma transação; acima de 1.000, recusa no painel com "Encerre em partes: reprove em lote primeiro" (11.7) — risco 23.4.
- **Pedido de revisão sem resposta em 15 dias:** aparece em vermelho no resumo diário até ser respondido.

---

## 10. Inventário de telas

Rotas do painel sob `/painel/{empresa}/…`. Rótulo = quem acessa.

| Tela | Rota | Mostra | Ações | Lê / escreve |
|---|---|---|---|---|
| `[Público]` Página inicial | `/` | o que é, o que não faz, aviso de vitrine de portfólio | Pedir convite (ou Criar empresa, se `aberta`), GitHub | — |
| `[Público]` Pedir convite | `/pedir-convite` | nome, e-mail, empresa, para que vai usar | enviar | `rs_pedidos_convite` |
| `[Admin da instância]` Convites | `/admin/convites` | pedidos por status com data, nome, e-mail, empresa e uso | aprovar, recusar | `rs_pedidos_convite` |
| `[Público]` Entrar | `/entrar` | "Entrar com Google" | entrar | `rs_usuarios` |
| `[Público]` Convite | `/convite/{token}` | empresa, papel, quem convidou | entrar com Google para aceitar | `rs_membros`, `rs_pessoas` |
| `[Membro]` Boas-vindas | `/painel/boas-vindas` | termos | aceitar | `rs_usuarios` |
| `[Membro]` Empresas | `/painel` | empresas do usuário, convites | entrar, criar empresa | `rs_membros`, `rs_empresas` |
| `[Membro]` Criar empresa | `/painel/nova` | nome, slug, e-mail de contato | criar | `rs_empresas`, `rs_membros` |
| `[Recrutador+]` Início | `/painel/{e}` | vagas publicadas com contagem por etapa, "Para confirmar", revisões pedidas, paradas | ir | várias (leitura) |
| `[Todos]` Vagas | `/painel/{e}/vagas` | lista em cartões por status, com filtros de área e dono (no alcance: recrutador limitado vê só as áreas dele; avaliador, só as da equipe) | + Nova vaga | `rs_vagas` |
| `[Recrutador+]` Editar vaga | `/painel/{e}/vagas/{id}/editar` | dados, etapas, perguntas, equipe, pré-visualização | salvar, publicar, pausar, encerrar | `rs_vagas`, `rs_etapas`, `rs_perguntas`, `rs_vaga_equipe` |
| `[Todos]` Funil da vaga | `/painel/{e}/vagas/{id}` | abas por etapa com contagem, filtros, busca, lista de candidaturas; abas finais "Encerradas" | abrir, mover em lote (recrutador+) | `rs_candidaturas`, `rs_etapas` |
| `[Todos]` Candidatura | `/painel/{e}/candidaturas/{id}` | dados, currículo (visualizador), respostas, sinalizações, avaliações, notas, mensagens, histórico | mover, avaliar, nota, mensagem, reprovar, contratar, reabrir, responder revisão | quase todas |
| `[Recrutador+]` Para confirmar | `/painel/{e}/confirmar` | propostas pendentes | confirmar, descartar, editar devolutiva, lote | `rs_decisoes` |
| `[Recrutador+]` Banco de talentos | `/painel/{e}/talentos` | busca entre consentidos | convidar para vaga | `rs_candidatos`, `rs_mensagens` |
| `[Recrutador+]` Mensagens | `/painel/{e}/mensagens` | modelos | editar, pré-visualizar, voltar ao padrão | `rs_modelos_mensagem` |
| `[Admin]` Página de carreiras | `/painel/{e}/pagina` | logo, cor, descrição, site, pré-visualização | salvar, publicar | `rs_empresas`, `rs_arquivos` |
| `[Admin]` Equipe | `/painel/{e}/equipe` | membros (papel, áreas, último acesso) e convites pendentes | convidar, reenviar, cancelar, mudar papel e áreas, remover | `rs_membros`, `rs_membro_areas` |
| `[Admin]` Áreas | `/painel/{e}/areas` | áreas com responsável, vagas abertas e recrutadores | criar, editar, arquivar | `rs_areas` |
| `[Recrutador+]` Pessoas | `/painel/{e}/pessoas` | cadastro com área, cargo, selo de acesso e vagas de que é dono | cadastrar, editar, arquivar, dar acesso (admin) | `rs_pessoas` |
| `[Membro]` Integrações | `/painel/{e}/integracoes` | chaves (admin), conexões MCP (as próprias; admin: todas), webhooks (admin), feed e API pública | criar, revogar, testar | `rs_credenciais`, `rs_webhooks` |
| `[Admin]` Empresa | `/painel/{e}/empresa` | e-mail de contato, retenção, talentos, mensagens do agente, aviso extra | salvar, excluir empresa | `rs_empresas` |
| `[Membro]` Minha conta | `/painel/conta` | nome, e-mail, link de agenda por empresa | salvar, sair, excluir conta | `rs_usuarios`, `rs_membros` |
| `[Membro]` Consentimento MCP | `/oauth/autorizar` | cliente, empresa, escopos | permitir, cancelar | `rs_oauth_codigos` |
| `[Público]` Carreiras | `/{empresa}` | logo, descrição, vagas publicadas com filtro por área e modelo | ver vaga | `rs_empresas`, `rs_vagas` |
| `[Público]` Vaga | `/{empresa}/vagas/{slug}` | descrição, requisitos, local, regime, salário (se mostrar), JSON-LD | Candidatar-me | `rs_vagas` |
| `[Público]` Candidatar-me | `/{empresa}/vagas/{slug}/candidatar` | formulário único | enviar | `rs_candidatos`, `rs_candidaturas`, `rs_respostas`, `rs_arquivos` |
| `[Candidato]` Acompanhamento | `/c/{token}` | situação, devolutiva, mensagens recebidas, banco de talentos | retirar, baixar dados, excluir dados, pedir revisão, renovar/retirar talentos | `rs_candidaturas`, `rs_candidatos` |
| `[Público]` Perdi o link | `/c` e `/{empresa}/links` | e-mail | reenviar links | `rs_notificacoes` |
| `[Público]` Docs | `/docs/api`, `/docs/mcp`, `/docs/auto-hospedagem` | documentação | — | — |
| `[Público]` Legais | `/privacidade`, `/termos` | textos | — | — |

---
## 11. Regras de negócio

Todas as constantes vivem em `src/lib/limits.ts`, com o número da regra ao lado.

| # | Regra | Valor / comportamento | Onde |
|---|---|---|---|
| 11.1 | Vaga válida para publicar | título 3–120; descrição 50–20.000; requisitos até 5.000; cidade e UF se presencial/híbrido; salário com `max ≥ min > 0` e período; 1–15 etapas com pelo menos uma; 0–10 perguntas; `encerra_em` (se houver) ≥ hoje. Depois da primeira publicação, perguntas não mudam (quem já respondeu respondeu àquelas) | zod (três portas) + banco (checks, `rs_tg_vaga_congelada`) |
| 11.2 | Candidatura válida | nome 2–120; e-mail válido; telefone 10–13 dígitos (opcional); LinkedIn no formato `linkedin.com/in/…` (opcional); currículo PDF ou DOCX ≤ 5 MB, obrigatório se `curriculo_obrigatorio`; respostas obrigatórias preenchidas, `texto_curto` ≤ 200, `texto_longo` ≤ 3.000, `numero` entre −1e9 e 1e9. Aviso de privacidade aceito. **Candidatura manual** (MCP `adicionar_candidato`, painel "Adicionar candidato") dispensa o aceite, mas envia ao candidato o e-mail `candidatura_recebida` com o texto "{Empresa} incluiu você no processo da vaga {vaga}" e o link para retirar e excluir os dados (LGPD art. 9º) | zod + servidor |
| 11.3 | Uma candidatura por pessoa por vaga | e-mail normalizado (minúsculas, sem espaços) + vaga. Segunda tentativa reenvia o link e não altera nada | banco (único) + `rs_fn_cria_candidatura` |
| 11.4 | Link do candidato | token de 32 bytes, só o hash no banco, comparação em tempo constante; vale enquanto a candidatura existir; depois do expurgo, "Link não encontrado" | servidor |
| 11.5 | Devolutiva obrigatória | `reprovada` e `encerrada_vaga` exigem texto de 20–3.000 caracteres ao candidato. `desistiu` envia confirmação automática (sem texto). `contratada` não exige (a empresa já está em contato), mas aceita mensagem. O motivo interno (`rs_motivo_reprovacao`) nunca aparece ao candidato, nem na API pública, nem no `/c` | `rs_fn_encerra_candidatura` |
| 11.6 | Trilha | todo evento da 15.3 é gravado por `rs_fn_registra_evento` na mesma transação da mudança; `dados` sem nome, e-mail, telefone, texto de currículo, comentário ou devolutiva | banco + hook `guard-audit` |
| 11.7 | Decisões em dois passos | São decisões: reprovar, marcar contratada, encerrar vaga **com candidatura ativa** e (se `mensagens_agente = confirmar`) mensagem enviada por agente ou integração. Pelo **painel**, a pessoa decide direto: o diálogo de confirmação com o texto final é o segundo passo. Pela **API ou MCP**, cria-se `rs_decisoes` pendente e a resposta é 202 com o id. **Só um membro recrutador ou administrador, com sessão no painel, confirma.** Nenhuma credencial confirma, com nenhum escopo. Proposta vence em 7 dias. Lote: até 50 por confirmação. Encerrar vaga com mais de 1.000 ativas é recusado (encerra-se em partes) | `rs_fn_propoe_decisao`, `rs_fn_confirma_decisao`, guardião da rota de confirmação |
| 11.8 | Mensagens de agente e integração | `mensagens_agente = confirmar` (padrão): `enviar_mensagem` vira proposta. `direto`: envia na hora, com até 200 mensagens por empresa por dia vindas de credenciais. Mensagens do painel sempre vão direto | servidor |
| 11.9 | Avaliação sem viés | avaliador vê as avaliações dos outros numa etapa só depois de registrar a própria naquela etapa; recrutador e administrador veem sempre. A API e o MCP respeitam o mesmo alcance do membro (agente) ou veem tudo (integração com `leitura`) | servidor (`alcance`) |
| 11.10 | Requisito declarado | pergunta `sim_nao` ou `escolha_unica` pode ter `resposta_esperada`. Resposta diferente marca `sinalizada = true` e mostra o selo. **Nunca** move, reprova nem esconde a candidatura | `rs_fn_cria_candidatura` |
| 11.11 | Tempo | candidatura ativa sem movimento há **14 dias** entra no resumo diário do responsável (ou dos recrutadores); vaga com `encerra_em < hoje` (America/Sao_Paulo) é **pausada** pela faxina, não encerrada, e o responsável recebe aviso; proposta pendente há 24 h entra no resumo; revisão pedida há 15 dias aparece como atrasada | faxina |
| 11.12 | Retenção | Candidatura encerrada: `expurgar_em = encerrada_em + retencao_dias` (90–365, padrão 180). Na data, a faxina anonimiza (7.4). Exceção: candidato com consentimento de talentos válido mantém nome, contato e currículo mais recente até `talentos_expira_em`, e só então anonimiza. Banco de talentos: `talentos_meses` 6–24, padrão 12, a partir do último consentimento ou renovação. Empresa excluída: 7 dias | faxina + funções |
| 11.13 | Direitos do titular | Em `/c/{token}`: **baixar dados** (JSON da 14.2, na hora); **excluir dados** (código de 6 dígitos por e-mail, 10 min, 5 tentativas → `rs_fn_exclui_dados_candidato`, na hora); **retirar candidatura** (`desistiu`); **pedir revisão** (uma vez por candidatura encerrada como `reprovada` ou `encerrada_vaga`, enquanto não expurgada; texto opcional de até 1.000; avisa o responsável; a resposta é uma mensagem `resposta_revisao` e pode vir com reabertura). Prazo de resposta sugerido: 15 dias (LGPD art. 19, II, por analogia; ver 20.1) | rotas do candidato + funções |
| 11.14 | Limites anti-abuso (instância) | usuários novos: `USUARIOS_NOVOS_POR_DIA` (padrão 100); empresas por usuário: 5; empresas novas por dia: `EMPRESAS_NOVAS_POR_DIA` (padrão 30); vagas publicadas por empresa ao mesmo tempo: 50; candidaturas por IP: 10 por hora; por vaga: 10.000; armazenamento por empresa: 5 GB (passou: recusa upload novo com mensagem e avisa o administrador); e-mails por empresa por dia: 1.000 (o que passar fica `pendente` para o dia seguinte, exceto códigos de login e de exclusão); chamadas de API por credencial: 600 por minuto | servidor (contagem no banco; janela deslizante) |
| 11.15 | Formato das credenciais | `rsk_` / `rsm_` + 32 bytes base64url; até 10 chaves de API ativas por empresa; tokens MCP sem limite por membro, listados para revogação | servidor |
| 11.16 | Escopo efetivo | Integração: os escopos da chave, alcance de todas as áreas. Agente: escopos do token ∩ papel do membro, no **alcance** dele (11.32), onde `avaliador` = só `leitura` (no alcance da equipe) e não registra avaliação pelo MCP; `recrutador` e `administrador` = `leitura`, `escrita`, `decisao`. O papel é relido a cada chamada (membro rebaixado perde o poder na hora, mesmo que o token sobreviva) | `requireCredencial` |
| 11.17 | Webhooks | HMAC SHA-256 do corpo com o segredo, cabeçalhos `X-Contrata-Assinatura: t={unix},v1={hex}` e `X-Contrata-Evento`; timeout 10 s; retentativas em 1 min, 10 min e 1 h (na hora, com `after()`), depois pela faxina diária por até 3 dias; status 2xx = entregue | `src/server/webhooks/` |
| 11.18 | SSRF | URL de webhook: só `https`, resolve DNS e recusa IP privado, loopback, link-local e metadados (mesma implementação do Assina, 11.18 de lá), sem seguir redirecionamento | `src/server/files/fetch-remote.ts` |
| 11.19 | Fuso | gravado em UTC; exibido e "hoje" calculado em `America/Sao_Paulo` | `src/lib/format.ts` |
| 11.20 | Página pública e JobPosting | Slugs reservados: `painel`, `entrar`, `sair`, `api`, `mcp`, `oauth`, `docs`, `c`, `privacidade`, `termos`, `.well-known`, `admin`, `sitemap.xml`, `robots.txt`. `cor_destaque` precisa de contraste ≥ 4,5:1 com branco. JSON-LD `JobPosting` em toda vaga publicada: `title`, `description` (HTML sanitizado da descrição + requisitos), `datePosted` (`publicada_em`), `validThrough` (fim do dia de `encerra_em` em BRT, ou omitido), `employmentType` (CLT/temporário → `FULL_TIME`/`TEMPORARY`, estágio → `INTERN`, PJ/freelancer → `CONTRACTOR`, outros → `OTHER`), `hiringOrganization` (nome, site, logo), `jobLocation` com `addressLocality`, `addressRegion` e `addressCountry: BR` (presencial e híbrido), `jobLocationType: TELECOMMUTE` + `applicantLocationRequirements: {Country: BR}` (remoto), `baseSalary` só se `mostrar_salario`, `directApply: true`, `identifier` com o id da vaga. Vaga não publicada: sem JSON-LD | `src/server/jobs/jsonld.ts` |
| 11.21 | Situação vista pelo candidato | `ativa` + etapa `triagem` → "Em análise"; `entrevista` ou `avaliacao` → "Em entrevistas"; `proposta` → "Em fase final"; `reprovada` e `encerrada_vaga` → "Encerrada"; `desistiu` → "Retirada por você"; `contratada` → "Aprovada". O candidato **não** vê o nome das etapas da empresa | `src/lib/copy.ts` |
| 11.22 | Etapas | 1–15 por vaga; renomear e reordenar sempre; excluir só sem candidaturas (ativas ou encerradas) nela; vaga não pode ficar sem etapa | servidor + banco |
| 11.23 | Reabrir | só membro recrutador ou administrador, só no painel, só antes do expurgo; volta para a última etapa (ou a primeira, se nula); não envia e-mail automático (o membro decide se manda mensagem); vaga precisa estar `publicada` ou `pausada` | `rs_fn_reabre_candidatura` |
| 11.24 | Convite de membro | vale 7 dias; aceito só pela conta Google cujo e-mail é igual ao convidado (sem diferenciar maiúsculas); reenviar gera token novo e invalida o anterior; até 50 convites pendentes por empresa; ao entrar, convites pendentes do e-mail são aceitos e a pessoa é ligada ao cadastro de pessoas | `rs_fn_entra_usuario` |
| 11.25 | Login | só Google (6.1). Não existe senha, código nem link mágico para membros. Os únicos códigos do sistema são os de exclusão de dados do candidato (11.13) | `src/server/auth/` |
| 11.26 | Último administrador | a empresa sempre tem ao menos um administrador com convite aceito; remover, rebaixar ou sair é recusado se ele for o último | funções de membro |
| 11.27 | Isolamento entre empresas | o mesmo e-mail em duas empresas são dois `rs_candidatos` sem ligação; nenhuma tela, rota ou ferramenta cruza empresas, inclusive para quem é membro das duas | helpers de `src/server/db/` |
| 11.28 | Busca | `websearch_to_tsquery('portuguese', unaccent(q))` sobre `texto_busca`; até 50 resultados por página, ordenados por relevância e depois por chegada; avaliador busca só nas vagas da equipe | servidor |
| 11.29 | Variáveis das mensagens | `{{nome}}` (primeiro nome do candidato), `{{nome_completo}}`, `{{vaga}}`, `{{empresa}}`, `{{link_acompanhamento}}`, `{{link_vaga}}`, `{{recrutador}}` (nome de quem envia, ou do responsável da vaga se for agente/integração), `{{link_agenda}}`. Variável desconhecida é recusada ao salvar o modelo | `src/server/messages/` |
| 11.30 | Mover em lote | até 100 candidaturas por chamada, todas da mesma vaga e ativas; parcial não existe (tudo ou nada) | domínio |
| 11.31 | Dono de vaga sem acesso | É uma linha de `rs_pessoas` sem `membro_id`. Não entra no sistema e não vê candidaturas. Se `recebe_resumo = true`, recebe às segundas (faxina) um e-mail por vaga `publicada` ou `pausada` de que é dono, **só com contagens** (candidaturas por etapa, encerradas na semana, contratada sim/não) e o nome do recrutador responsável; **sem nomes nem dados de candidatos**. O e-mail traz "Pedir acesso", que avisa os administradores (notificação, sem criar convite). Para opinar sobre candidatos, a pessoa precisa de acesso (avaliador) | faxina + `src/server/email/` |
| 11.33 | Instância por convite | Com `CRIACAO_EMPRESA=convite` (padrão na instância hospedada): criar empresa exige pedido de convite aprovado para o mesmo e-mail Google, ou ser administrador da instância. Um pedido cria **uma** empresa. Aprovação vale 30 dias. Pedidos: até 3 por IP por dia, um pendente por e-mail; repetir enquanto pendente não cria outro. Recusa envia e-mail curto sem motivo. A aprovação é sempre manual, por um administrador da instância, em `/admin/convites`; não há porta de API nem MCP | `rs_fn_pede_convite`, `rs_fn_decide_convite`, `rs_fn_cria_empresa`, `requireAdminInstancia` |
| 11.32 | Alcance por área | Administrador: todas as vagas. Recrutador com `todas_areas = true`: todas. Recrutador limitado: só vagas com `area_id` nas áreas dele; vagas "Sem área" ficam fora. Avaliador: só vagas da equipe (o dono com acesso entra na equipe automaticamente). O alcance vale para listas, busca, banco de talentos (candidatos que se candidataram a vagas do alcance ou que consentiram sem vaga ligada a área de fora), propostas a confirmar, exportação, API e MCP do membro. Recrutador limitado precisa de pelo menos uma área ativa | guardião (`alcance`) + funções |

---

## 12. Máquinas de estado

### 12.1 Vaga

| De \ Para | rascunho | publicada | pausada | encerrada |
|---|---|---|---|---|
| **rascunho** | — | ✅ válida (11.1) | ❌ | ✅ (sem candidaturas, sempre) |
| **publicada** | ❌ | — | ✅ manual ou faxina (11.11) | ✅ painel direto; API/MCP vira proposta se houver ativa |
| **pausada** | ❌ | ✅ se `encerra_em` nula ou futura | — | ✅ idem acima |
| **encerrada** | ❌ | ❌ | ❌ | — |

Encerrar exige `motivo_encerramento` e, se houver ativas, a devolutiva (padrão pelo motivo: `devolutiva_vaga_preenchida` ou `devolutiva_vaga_cancelada`). Pausada não recebe candidatura e sai da página pública, mas o funil continua.

### 12.2 Candidatura

| De \ Para | ativa | reprovada | desistiu | contratada | encerrada_vaga |
|---|---|---|---|---|---|
| **ativa** | (mudar etapa) | ✅ com devolutiva | ✅ candidato ou titular | ✅ | ✅ só pelo encerramento da vaga |
| **reprovada** | ✅ reabrir (11.23) | — | ❌ | ❌ | ❌ |
| **desistiu** | ✅ reabrir, se não foi por exclusão de dados | ❌ | — | ❌ | ❌ |
| **contratada** | ✅ reabrir (desistência depois da proposta) | ❌ | ❌ | — | ❌ |
| **encerrada_vaga** | ❌ | ❌ | ❌ | ❌ | — |

Toda transição grava o evento correspondente (15.3). Candidatura anonimizada não transita mais.

### 12.3 Decisão

`pendente` → `confirmada` (membro confirma; executa na mesma transação) · `pendente` → `descartada` (membro descarta, com motivo opcional) · `pendente` → `expirada` (7 dias, ou alvo mudou na hora da confirmação). Nenhuma outra transição.

### 12.4 Notificação e webhook

Iguais ao Assina: `pendente` → `enviada` | `falhou` (retentada) → `descartada` (depois de 5 tentativas ou destinatário anonimizado). Entrega: `pendente` → `entregue` | `falhou` → `desistiu` (3 dias).

---

## 13. Contratos de API

Convenções: JSON, nomes do banco (português) nos campos, datas ISO 8601 UTC, ids `uuid`, paginação por cursor (`?cursor=&limite=`, padrão 50, máximo 200), erros `{"codigo": "...", "mensagem": "..."}` com `mensagem` em português e sem dado pessoal. Escritas aceitam `Idempotency-Key` (24 h, por credencial).

### 13.1 Rotas internas (painel e candidato)

| Método e rota | Guardião | O que faz |
|---|---|---|
| `GET /api/auth/google`, `GET …/callback` | — | login Google (6.1) |
| `POST /api/painel/empresas` | sessão | cria empresa |
| `/api/painel/{e}/…` | `requireMembro` | espelham a API v1 com a sessão do membro, **mais**: membros, convites, áreas, pessoas (escrita), chaves, webhooks, confirmar e descartar decisões, reabrir, responder revisão, avaliações |
| `GET /convite/{token}`, `POST /api/convite/{token}/aceitar` | sessão Google | 11.24 |
| `POST /api/pedir-convite` | limites + honeypot | 11.33; resposta sempre igual |
| `GET /api/admin/convites`, `POST /api/admin/convites/{id}/decidir` | `requireAdminInstancia()` + `Origin` | 11.33 |
| `POST /api/painel/{e}/decisoes/confirmar` | `requireMembro(recrutador)` + `Origin` | `{ids: [...], ajustes: {id: {devolutiva}}}` → confirma em lote (11.7) |
| `POST /api/publico/{e}/vagas/{slug}/candidaturas` | `requireEmpresaPublica` + limites | cria candidatura, devolve `{id, upload_url?}` (sem token) |
| `POST /api/publico/{e}/candidaturas/{id}/concluir` | idem + `id` recém-criado na mesma origem (cookie de 1 h `rs_cand_{id}`) | confirma o upload, dispara extração e e-mail |
| `POST /api/publico/{e}/links` | limites | reenvia links (resposta sempre igual) |
| `GET /api/c/{token}`, `POST /api/c/{token}/retirar`, `…/exportar`, `…/excluir/codigo`, `…/excluir`, `…/revisao`, `…/talentos` | `requireCandidaturaPorToken` + `Origin` nas escritas | ações do candidato (11.13) |
| `GET /api/cron/diario` | `CRON_SECRET` | faxina (8.10) |

### 13.2 API REST pública v1

Base `/api/v1`, `Authorization: Bearer rsk_…` (ou `rsm_…`). Escopo exigido entre colchetes.

| Método e rota | Escopo | Notas |
|---|---|---|
| `GET /empresa` | leitura | empresa, credencial, escopos |
| `GET /areas` · `GET /pessoas` | leitura | áreas ativas; pessoas com nome, e-mail, cargo, área e `tem_acesso` (sem papel) |
| `GET /vagas` · `GET /vagas/{id}` | leitura | filtros `status`, `area_id`, `dono_pessoa_id`, `atualizada_desde` |
| `POST /vagas` · `PATCH /vagas/{id}` | escrita | cria rascunho / edita (11.1); `area_id` e `dono_pessoa_id` aceitos |
| `PUT /vagas/{id}/etapas` · `PUT /vagas/{id}/perguntas` · `PUT /vagas/{id}/equipe` | escrita | substitui a lista inteira; perguntas só antes da 1ª publicação |
| `POST /vagas/{id}/publicar` · `POST /vagas/{id}/pausar` | escrita | 12.1 |
| `POST /vagas/{id}/encerrar` | decisao | 200 se não houver ativa; **202 `{decisao_id}`** se houver |
| `GET /vagas/{id}/resumo` | leitura | contagem por etapa e situação, sinalizadas, paradas, idade média |
| `GET /candidaturas` | leitura | filtros `vaga_id`, `etapa_id`, `situacao`, `sinalizada`, `parada_desde`, `q` (11.28), `atualizada_desde` |
| `GET /candidaturas/{id}` | leitura | dados, respostas, etapa, situação, avaliações (11.9), notas, mensagens, `curriculo: {nome, bytes, extracao_status}` |
| `GET /candidaturas/{id}/curriculo` | leitura | `{texto}` (até 100.000) ou `{url}` pré-assinada de 5 min com `?formato=arquivo` |
| `POST /candidaturas` | escrita | origem `integracao`; mesmo contrato da pública + `upload_url` |
| `POST /candidaturas/{id}/mover` · `POST /candidaturas/mover` (lote, 11.30) | escrita | `{etapa_id}` |
| `POST /candidaturas/{id}/notas` | escrita | `{texto}` |
| `POST /candidaturas/{id}/reprovar` | decisao | `{motivo, devolutiva, justificativa?}` → **202 `{decisao_id}`** sempre |
| `POST /candidaturas/{id}/contratar` | decisao | `{mensagem?, justificativa?}` → **202** sempre |
| `POST /candidaturas/{id}/mensagens` | escrita | `{modelo?, assunto?, corpo?, justificativa?}` → 201 ou 202 (11.8) |
| `GET /decisoes` · `GET /decisoes/{id}` | leitura | filtro `status` |
| `GET /talentos` | leitura | `q`, só consentidos válidos |
| `POST /talentos/{candidato_id}/convidar` | escrita | `{vaga_id}` (vaga publicada) |
| `GET /modelos-mensagem` | leitura | padrão + personalizados |
| `GET /eventos` | leitura | `?desde={id}`, ordem crescente |
| `GET /openapi.json` | — | documento OpenAPI 3.1 |

**Sem porta de API nem MCP (de propósito):** confirmar ou descartar decisão (princípio 2), avaliar candidatura (é opinião de pessoa), reabrir candidatura e responder revisão (exigem julgamento humano registrado com nome), pedidos de convite da instância, membros, convites, áreas, escrita no cadastro de pessoas, chaves, webhooks, retenção e exclusão de empresa (administração e segurança: quem dá acesso é sempre uma pessoa no painel).

**API pública (sem chave):** `GET /api/publico/{e}/vagas`, `GET /api/publico/{e}/vagas/{slug}` (só publicadas, sem dados internos), `POST …/candidaturas` e `…/concluir`, `GET /{e}/vagas.xml`. CORS aberto (`*`) só nas leituras públicas; o `POST` aceita as origens de `cors_origens` da empresa — no MVP, qualquer origem `https` com os limites da 11.14 (assunção 24.8).

### 13.3 Ferramentas do MCP

Descrições em português, escritas para o modelo. Toda resposta tem um `texto` curto legível e `structuredContent` com os dados. Toda ferramenta que lista aceita `cursor`.

| Ferramenta | Escopo | Faz |
|---|---|---|
| `quem_sou_eu` | leitura | empresa, membro, papel, escopos efetivos |
| `listar_areas` · `listar_pessoas` | leitura | para o agente escolher área e dono ao criar vaga |
| `listar_vagas` · `ver_vaga` | leitura | |
| `criar_vaga` · `editar_vaga` | escrita | sempre em rascunho na criação; devolve o link da pré-visualização no painel |
| `publicar_vaga` · `pausar_vaga` | escrita | |
| `encerrar_vaga` | decisao | proposta se houver ativa |
| `resumo_da_vaga` | leitura | funil, paradas, sinalizadas |
| `listar_candidaturas` · `buscar_candidaturas` | leitura | |
| `ver_candidatura` | leitura | sem o texto do currículo |
| `ler_curriculo` | leitura | texto extraído; avisa quando é `sem_texto` |
| `adicionar_candidato` | escrita | 11.2 (manual) |
| `mover_etapa` | escrita | uma ou várias (11.30) |
| `adicionar_nota` | escrita | assinada como agente |
| `reprovar_candidatura` · `marcar_contratada` | decisao | sempre proposta; a resposta diz quem precisa confirmar e onde (`{site}/painel/{e}/confirmar`) |
| `enviar_mensagem` | escrita | 11.8 |
| `listar_propostas` | leitura | pendentes e recentes |
| `listar_modelos_mensagem` | leitura | |
| `buscar_talentos` · `convidar_para_vaga` | leitura / escrita | |

A descrição de `reprovar_candidatura` diz literalmente: "Cria uma proposta de reprovação. Ela só acontece quando uma pessoa da equipe confirmar no painel. Escreva a devolutiva em tom respeitoso, sem citar idade, gênero, raça, religião, deficiência, estado civil ou qualquer característica pessoal, e explique na justificativa o motivo da proposta." (seção 20.4).

### 13.4 Webhooks

Corpo: `{"id": "{evento_id}", "tipo": "...", "criado_em": "...", "empresa_id": "...", "dados": {...}}`, com `dados` contendo ids e o objeto resumido (vaga ou candidatura como na API v1, **sem texto do currículo**).

Catálogo: `vaga.publicada`, `vaga.pausada`, `vaga.encerrada`, `candidatura.criada`, `candidatura.etapa_alterada`, `candidatura.reprovada`, `candidatura.contratada`, `candidatura.desistiu`, `candidatura.encerrada_vaga`, `candidatura.reaberta`, `candidatura.anonimizada`, `decisao.proposta`, `decisao.confirmada`, `decisao.descartada`, `revisao.pedida`.

---

## 14. Relatórios, exportação e importação

### 14.1 Exportar candidaturas da vaga (CSV)
Botão "Exportar CSV" no funil (recrutador+), respeitando os filtros da tela. UTF-8 **com BOM**, separador `;`, datas `dd/mm/aaaa hh:mm` em Brasília, nome `candidaturas-{slug-da-vaga}-{aaaa-mm-dd}.csv`. Colunas, nesta ordem:

`nome`, `email`, `telefone`, `linkedin`, `cidade`, `etapa`, `situacao` (rótulo interno), `sinalizada` (`sim`/`não`), `origem`, `candidatou_em`, `movida_em`, `encerrada_em`, `avaliacoes` (ex.: `2 sim, 1 não`), e uma coluna por pergunta (cabeçalho = texto da pergunta). A exportação gera o evento `candidaturas_exportadas` com a contagem.

### 14.2 Dados do titular (JSON)
`/c/{token}` → "Baixar meus dados": `dados-{empresa}-{aaaa-mm-dd}.json` com `{empresa, gerado_em, pessoa: {nome, email, telefone, linkedin, cidade, banco_de_talentos: {consentido_em, expira_em}}, candidaturas: [{vaga, candidatou_em, situacao (texto da 11.21), respostas: [{pergunta, resposta}], curriculo: {nome_original, url (5 min)}, mensagens_recebidas: [{data, assunto, corpo}]}]}`. Não inclui notas, avaliações nem motivo interno (são opiniões da empresa; assunção 24.7).

### 14.3 Feed XML
`/{empresa}/vagas.xml`: formato genérico de feed de vagas (`<source><job>` com `title`, `date`, `referencenumber`, `url`, `company`, `city`, `state`, `country`, `description`, `jobtype`, `salary` se mostrado). Serve para agregadores que leem feed. Integração oficial com LinkedIn e Indeed fica na pergunta 25.4.

### 14.4 Importação
Não há importação em massa no MVP (seção 3, Fora).

---
## 15. Copy e tom de voz

Conteúdo final, não placeholder. Tudo em `src/lib/copy.ts`. Tom: direto, respeitoso, sem jargão de RH ("talent acquisition", "fit cultural") e sem frases de marketing. Para o candidato, sempre na segunda pessoa ("você"), frases curtas, nunca culpa ("não foi possível" em vez de "você errou").

### 15.1 Telas — candidato

| Onde | Texto |
|---|---|
| Botão na vaga | Candidatar-me |
| Título do formulário | Candidatar-me a {vaga} |
| Subtítulo | Leva poucos minutos. Você não precisa criar conta. |
| Campos | Nome completo · E-mail · Telefone (opcional) · LinkedIn (opcional) · Currículo (PDF ou Word, até 5 MB) |
| Aviso de privacidade (caixa obrigatória) | Li o aviso de privacidade e concordo que a {empresa} use meus dados para este processo seletivo. ([ler o aviso]) |
| Banco de talentos (caixa opcional, desmarcada) | Quero que a {empresa} guarde meus dados por {n} meses para me avisar de outras vagas. |
| Botão | Enviar candidatura |
| Sucesso | **Candidatura enviada.** Mandamos para {email} um link para você acompanhar o processo. Guarde esse e-mail. |
| Duplicada | Você já se candidatou a esta vaga. Enviamos o link de acompanhamento de novo para o seu e-mail. |
| Erro de arquivo | O currículo precisa ser PDF ou Word, com até 5 MB. |
| Upload interrompido | O envio não terminou. Tente de novo; seus dados continuam aqui. |
| Vaga fechada | Esta vaga não recebe mais candidaturas. [Ver outras vagas da {empresa}] |
| Acompanhamento — título | Sua candidatura para {vaga} |
| Situações | Em análise · Em entrevistas · Em fase final · Encerrada · Retirada por você · Aprovada |
| Explicação "Em análise" | A {empresa} recebeu sua candidatura e está analisando. Você vai receber um e-mail quando houver novidade. |
| Explicação "Encerrada" | O processo terminou para você. A mensagem da {empresa} está abaixo. |
| Ações | Retirar candidatura · Baixar meus dados · Excluir meus dados · Pedir revisão |
| Confirmar retirada | Retirar sua candidatura para {vaga}? A {empresa} não vai mais considerar você nesta vaga. [Retirar] [Cancelar] |
| Excluir dados | Para excluir seus dados, enviamos um código para {email mascarado}. Isso apaga seu currículo, suas respostas e suas mensagens nesta empresa, e encerra as candidaturas em andamento. Não dá para desfazer. |
| Dados excluídos | Seus dados foram excluídos. A {empresa} não tem mais acesso a eles. |
| Pedir revisão | Se você acha que a decisão merece uma segunda análise, peça uma revisão. Uma pessoa da {empresa} vai olhar sua candidatura de novo e responder por e-mail. [campo opcional: "Quer explicar algo? (opcional)"] [Pedir revisão] |
| Revisão pedida | Pedido enviado em {data}. A resposta chega no seu e-mail. |
| Banco de talentos | Você está no banco de talentos da {empresa} até {data}. [Renovar por mais {n} meses] [Sair do banco de talentos] |
| Perdi o link | Informe o e-mail que você usou. Se houver candidaturas na {empresa}, mandamos os links. |
| Resposta de "Perdi o link" | Se o e-mail estiver certo, os links chegam em instantes. |
| Link inválido | Link não encontrado. Ele pode ter sido digitado errado ou os dados já foram excluídos. [Perdi o link] |

### 15.2 Telas — painel

| Onde | Texto |
|---|---|
| Pedir convite | **Pedir convite.** Esta é uma instância de demonstração do Contrata, um projeto de código aberto. Para criar uma empresa aqui, peça um convite. Para usar de verdade, você pode hospedar o seu ([ver no GitHub]). · Seu nome · E-mail da conta Google que você vai usar · Nome da empresa · Para que você quer usar? (opcional) · [Pedir convite] |
| Pedido enviado | Pedido enviado. Você vai receber a resposta em {email}. |
| Sem convite aprovado | Para criar uma empresa aqui, você precisa de um convite aprovado para {email}. [Pedir convite] |
| Admin — convites vazio | Nenhum pedido pendente. |
| Boas-vindas | Bem-vindo ao Contrata. Para continuar, leia e aceite os [Termos de uso] e a [Política de privacidade]. [Aceitar e continuar] |
| Entrar | Entrar com Google |
| Convite — outra conta | Este convite é para {email}. Você entrou como {outro}. [Entrar com outra conta] |
| E-mail já em uso | O e-mail desta conta Google já está ligado a outro acesso. Fale com o administrador da sua empresa. |
| Equipe — convidar | E-mail · Papel: Administrador (tudo, inclusive equipe e integrações) / Recrutador (conduz vagas) / Avaliador (avalia nas vagas em que estiver) · Áreas (só recrutador): Todas / Escolher áreas |
| Pessoas — explicação | Gestores, donos de vaga e entrevistadores. Quem não tem acesso não entra no sistema; se for dono de vaga, recebe um resumo semanal só com números. |
| Pessoa sem acesso | Sem acesso · [Dar acesso] |
| Áreas — vazio | Nenhuma área ainda. Áreas organizam as vagas e permitem limitar o que cada recrutador vê. |
| Arquivar área recusado | Esta área tem vagas abertas ou é a única área de algum recrutador. Mude isso antes de arquivar. |
| Criar empresa | Nome da empresa · Endereço da página de carreiras ({site}/____) · E-mail que recebe as respostas dos candidatos |
| Slug em uso | Esse endereço já está em uso. Tente outro. |
| Convite | {nome} convidou você para a equipe de recrutamento da {empresa} como {papel}. [Aceitar convite] |
| Convite vencido | Este convite venceu. Peça um novo a quem convidou você. |
| Último administrador | A empresa precisa de pelo menos um administrador. Promova outra pessoa antes. |
| Vagas vazio | Nenhuma vaga ainda. Crie uma aqui ou peça ao Claude: "crie uma vaga de…". [+ Nova vaga] |
| Funil vazio | Nenhuma candidatura nesta etapa. |
| Selo sinalizada | Não atende: {pergunta} |
| Avaliação oculta | Registre sua avaliação para ver a dos outros. |
| Reprovar — diálogo | **Reprovar {nome}?** Motivo (só para a equipe): [lista] · Mensagem para {primeiro nome} (vai por e-mail): [texto do modelo] · [Reprovar e enviar] [Cancelar] |
| Encerrar vaga — diálogo | **Encerrar {vaga}?** {n} pessoas em andamento vão receber esta mensagem: [texto] · Motivo: Vaga preenchida / Vaga cancelada / Outro · [Encerrar e enviar] |
| Para confirmar — vazio | Nada para confirmar. Quando um agente ou integração propuser reprovar, contratar ou encerrar, a proposta aparece aqui. |
| Para confirmar — cartão | {tipo}: {nome} · {vaga} · Proposto por {Claude · em nome de Ana} em {data} · Justificativa: {texto} · Mensagem ao candidato: [editável] · [Confirmar] [Descartar] |
| Proposta inválida | Esta proposta não vale mais: {a candidatura já foi encerrada / a vaga já foi encerrada / venceu em {data}}. |
| Resposta da API/MCP a proposta | Proposta criada. Ela só acontece quando um recrutador ou administrador confirmar em {site}/painel/{e}/confirmar. |
| Chave criada | Copie a chave agora. Por segurança, ela não aparece de novo. |
| Consentimento MCP | **{cliente} quer acessar o Contrata.** Empresa: [escolha] · O que ele poderá fazer: ☑ Ler vagas e candidaturas · ☐ Criar e mover · ☐ Propor decisões · **O que ele não poderá fazer:** confirmar reprovações, contratações e encerramentos; gerir equipe e chaves; ver outras empresas. · [Permitir] [Cancelar] |
| E-mail não entregue | E-mail não entregue. [Tentar de novo] |
| Retenção | Candidaturas encerradas são anonimizadas {n} dias depois do encerramento. Quem está no banco de talentos fica até o consentimento vencer. |

### 15.3 Rótulos dos eventos da trilha

Catálogo fechado (check no banco). Rótulo no histórico entre aspas.

`empresa_criada` "Empresa criada" · `membro_convidado` "{email} convidado como {papel}" · `convite_cancelado` "Convite de {email} cancelado" · `membro_entrou` "{nome} entrou na equipe" · `membro_acesso_alterado` "Acesso de {nome}: {de} → {para}" · `membro_removido` "{nome} removido" · `area_criada` "Área {nome} criada" · `area_editada` "Área {nome} editada" · `area_arquivada` "Área {nome} arquivada" · `pessoa_cadastrada` "{nome} cadastrado" · `pessoa_editada` "{nome} editado" · `pessoa_arquivada` "{nome} arquivado" · `acesso_pedido` "{nome} pediu acesso" · `vaga_dono_alterado` "Dono da vaga: {de} → {para}" · `credencial_criada` "Chave {nome} criada" · `credencial_revogada` "Chave {nome} revogada" · `mcp_conectado` "{cliente} conectado por {nome}" · `vaga_criada` "Vaga criada" · `vaga_editada` "Vaga editada" · `vaga_publicada` "Vaga publicada" · `vaga_pausada` "Vaga pausada" · `vaga_pausada_prazo` "Vaga pausada pelo prazo" · `vaga_encerrada` "Vaga encerrada ({motivo})" · `candidatura_criada` "Candidatura recebida ({origem})" · `etapa_alterada` "{de} → {para}" · `nota_adicionada` "Nota" · `avaliacao_registrada` "Avaliação em {etapa}" · `mensagem_enviada` "Mensagem: {assunto}" · `candidatura_reprovada` "Reprovada" · `candidatura_contratada` "Aprovada e contratada" · `candidatura_desistiu` "Retirada pelo candidato" · `candidatura_encerrada_vaga` "Encerrada com a vaga" · `candidatura_reaberta` "Reaberta" · `decisao_proposta` "Proposta: {tipo}" · `decisao_confirmada` "Proposta confirmada" · `decisao_descartada` "Proposta descartada" · `decisao_expirada` "Proposta vencida" · `revisao_pedida` "Candidato pediu revisão" · `revisao_respondida` "Revisão respondida" · `dados_exportados` "Candidato baixou os próprios dados" · `dados_excluidos` "Dados excluídos a pedido do titular" · `candidatura_anonimizada` "Dados anonimizados pelo prazo de retenção" · `talentos_consentido` "Entrou no banco de talentos" · `talentos_retirado` "Saiu do banco de talentos" · `talentos_convidado` "Convidado para {vaga}" · `candidaturas_exportadas` "{n} candidaturas exportadas".

Os nomes no rótulo são resolvidos na hora de exibir (ids em `dados`), nunca gravados no evento.

**Palavras proibidas** em toda copy voltada ao candidato e nas descrições das ferramentas (hook `guard-copy`): "inteligência artificial reprovou", "algoritmo", "pontuação", "score", "ranking", "fit cultural", "match", "eliminado", "eliminatória". Elas sugerem triagem automática, que o produto não faz (princípio 2).

### 15.4 E-mails

| Tipo | Assunto | Corpo (resumo; texto completo em `copy.ts`) |
|---|---|---|
| `candidatura_recebida` | Recebemos sua candidatura para {vaga} | Olá, {nome}. A {empresa} recebeu sua candidatura. Acompanhe por este link, que é só seu: [Acompanhar candidatura]. Você vai receber uma resposta quando o processo terminar para você. |
| `candidatura_recebida` (manual) | {empresa} incluiu você no processo de {vaga} | … Se não quiser participar, você pode retirar a candidatura e excluir seus dados pelo link. |
| `mensagem_candidato` (devolutiva padrão) | Sobre sua candidatura para {vaga} | Texto da devolutiva + rodapé "Se você acha que a decisão merece uma segunda análise, pode pedir uma revisão pelo seu link de acompanhamento." |
| Modelo `devolutiva_padrao` | — | Olá, {{nome}}. Obrigado pelo interesse na vaga de {{vaga}} e pelo tempo que você dedicou ao processo. Depois de analisar as candidaturas, decidimos seguir com outras pessoas nesta etapa. Desejamos sucesso na sua busca. {{recrutador}}, {{empresa}} |
| Modelo `devolutiva_vaga_preenchida` | — | Olá, {{nome}}. A vaga de {{vaga}} foi preenchida e o processo foi encerrado. Obrigado por ter participado. {{empresa}} |
| Modelo `devolutiva_vaga_cancelada` | — | Olá, {{nome}}. A {{empresa}} cancelou a vaga de {{vaga}} e o processo foi encerrado. Obrigado por ter participado. |
| Modelo `convite_entrevista` | Entrevista para {{vaga}} | Olá, {{nome}}. Gostaríamos de conversar com você sobre a vaga de {{vaga}}. Escolha um horário por aqui: {{link_agenda}}. {{recrutador}} |
| Modelo `convite_vaga` | Uma vaga na {{empresa}} que pode interessar a você | Olá, {{nome}}. Você está no nosso banco de talentos e abrimos a vaga de {{vaga}}. Se tiver interesse, candidate-se: {{link_vaga}} |
| `codigo_exclusao` | Código para excluir seus dados: {codigo} | … |
| `pedido_convite_recebido` | Recebemos seu pedido de convite | Olá, {nome}. Recebemos seu pedido para usar o Contrata. Você vai receber a resposta neste e-mail. |
| `pedido_convite_admin` | Pedido de convite: {empresa_nome} | {nome} ({email}) pediu um convite. Uso: {uso}. [Ver pedidos] |
| `pedido_convite_aprovado` | Seu convite para o Contrata foi aprovado | Olá, {nome}. Entre com a conta Google de {email} e crie sua empresa: [Criar minha empresa]. O convite vale até {data}. |
| `pedido_convite_recusado` | Sobre seu pedido de convite | Olá, {nome}. Não conseguimos liberar um convite agora. O Contrata é de código aberto: você pode hospedar o seu seguindo o guia em {link_github}. |
| `convite_membro` | Convite para a equipe da {empresa} | {nome} convidou você como {papel}. Para aceitar, entre com a conta Google de {email}: [Aceitar convite]. O convite vale por 7 dias. |
| `resumo_dono_vaga` | {vaga}: resumo da semana | Olá, {nome}. Como está a vaga {vaga} que você pediu: {n} em análise, {n} em entrevistas, {n} em fase final, {n} encerradas nesta semana. Quem conduz: {recrutador}. Para ver as candidaturas e avaliar, [Pedir acesso]. |
| `resumo_diario` | {empresa}: {n} itens precisam de você | Propostas para confirmar · Revisões pedidas · Candidaturas paradas há 14 dias ou mais · Vagas pausadas pelo prazo |
| `revisao_pedida` | {nome} pediu revisão — {vaga} | … |
| `talentos_expirando` | Seus dados no banco de talentos da {empresa} | … vencem em {data}. [Renovar] |

Remetente: "{empresa} via Contrata" `<naoresponda@{dominio}>`, `reply-to` = `email_contato`. Rodapé de todo e-mail a candidato: "Enviado pelo Contrata a pedido da {empresa}. Responda este e-mail para falar com a {empresa}." HTML simples + texto puro.

### 15.5 Aviso de privacidade padrão (versão `2026-11-20`)

Texto em `copy.ts` (`AVISO_PRIVACIDADE`), com: quem é o controlador ({empresa} e e-mail de contato); finalidade (este processo seletivo); dados tratados (os do formulário e o currículo); base legal (procedimentos preliminares a contrato a pedido do titular, LGPD art. 7º, V); quem acessa (a equipe de recrutamento da empresa e ferramentas que ela usa, incluindo assistentes de IA que leem as candidaturas a pedido dela, sempre com decisão final de uma pessoa); operador (DabLab, na instância hospedada); retenção ({n} dias após o encerramento; banco de talentos só com consentimento); direitos (acompanhar, baixar, excluir, pedir revisão pelo link, e falar com a empresa pelo e-mail de contato). Depois, o texto extra da empresa, se houver.

---

## 16. Direção visual

**Referência:** a família visual do Assina e do Reunião. O agente confere `src/app/globals.css` do `~/assina` antes de inventar valores.

- **Tipografia:** pilha de sistema `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif`. Títulos de página com cerca de 34 px, peso 700, tracking negativo. Contadores e datas com `tabular-nums`.
- **Cor de marca:** azul `#0071e3` (claro) e `#0a84ff` (escuro) como único destaque do painel: botões primários em **pílula** ("+ Nova vaga" à direita do título), links, item ativo do menu e foco. O azul nunca indica status.
- **Superfícies:** fundo branco ou preto; menu lateral e cartões em `#f5f5f7` / `#1c1c1e`; texto secundário `#6e6e73` / `#98989d`; hairlines `#d2d2d7` / `#38383a`.
- **Cores semânticas** (pílulas com fundo a 12% e texto na cor):
  - verde `#34c759`/`#30d158` = Publicada, Aprovada/Contratada, Proposta confirmada;
  - laranja `#ff9500`/`#ff9f0a` = Sinalizada, Parada, Para confirmar, E-mail não entregue;
  - vermelho `#ff3b30`/`#ff453a` = Reprovada, Revisão atrasada, erro;
  - cinza `#8e8e93` = Rascunho, Pausada, Encerrada, Retirada;
  - roxo `#af52de`/`#bf5af2` = **ator agente** (selo "Agente · em nome de …" e notas de agente), para a equipe distinguir de relance o que veio de IA.
- **Navegação do painel:** **menu lateral estilo App Store Connect**:
  - topo: nome da empresa em negrito com seletor (chevron) para trocar de empresa;
  - grupos com título em **negrito escuro**, caixa normal: **Recrutamento** (Início, Vagas, Para confirmar — com contador laranja —, Banco de talentos); **Pessoas** (Equipe, Áreas, Pessoas); **Configurar** (Página de carreiras, Mensagens, Integrações, Empresa);
  - itens indentados sem marcador, hairline entre os grupos;
  - **um item ativo por vez**, em azul `#0071e3` com pílula azul clara ao fundo;
  - rodapé separado por hairline: nome e e-mail do usuário, "Minha conta" e "Sair".
  - Abaixo de 1024 px, gaveta. O avaliador vê só Início e Vagas; o recrutador vê Pessoas (sem Equipe e Áreas) e Mensagens.
- **Lista de vagas:** cartões cinza de cantos 16–18 px, sem borda; título semibold; linha secundária "Financeiro · dono: Bruno · 12 em análise · 3 em entrevistas"; à direita a pílula de status e "Ver página" (botão branco em pílula).
- **Funil da vaga:** cabeçalho com título e pílula de status; abaixo, **controle segmentado** com as etapas e a contagem ("Triagem 42 · Entrevista RH 6 · …") mais "Encerradas"; filtros como pílulas; lista de linhas (nome, cidade, chegada, selos, mini-indicador de avaliações "2 ✓ 1 ✗"). Caixa de seleção por linha para mover em lote. No desktop largo, o detalhe abre num painel à direita sem sair da lista.
- **Candidatura:** duas colunas no desktop: à esquerda o currículo (visualizador PDF ou texto do DOCX) ocupando a altura; à direita cartões empilhados (Contato, Respostas, Avaliações, Notas, Mensagens, Histórico) e a barra de ações fixa no topo do painel direito ("Mover para…", "Avaliar", "Mensagem", menu "…" com Reprovar/Contratar/Reabrir). No celular, uma coluna com o currículo atrás de um botão.
- **Para confirmar:** cartões grandes, um por proposta, com o texto ao candidato num campo editável e dois botões (azul "Confirmar", cinza "Descartar"); barra superior "Selecionar todas · Confirmar {n}".
- **Página de carreiras e páginas do candidato:** usam o logo da empresa e a `cor_destaque` (ou o azul) no botão "Candidatar-me" e nos links; o resto segue a família visual (cinza, branco, tipografia de sistema). Uma coluna centralizada (máx. 720 px na vaga, 560 px no formulário e no acompanhamento). Rodapé discreto "Página de carreiras feita com o Contrata".
- **Acompanhamento:** cartão com a situação em texto grande e uma linha do tempo simples de três pontos (Recebida → Em andamento → Encerrada/Aprovada), sem expor etapas internas.
- **Modo escuro:** obrigatório em tudo, seguindo o sistema.
- **E-mails:** HTML simples, fundo branco, logo da empresa no topo (se houver), título grande, botão em pílula na cor da empresa, rodapé discreto.
- **Livre para o agente:** ícones (traço fino, lucide), microanimações discretas, ilustração mínima nos estados vazios.

---

## 17. Requisitos não-funcionais

| Item | Alvo |
|---|---|
| Página da vaga (pública) | LCP < 1,5 s em 4G (p75); renderizada no servidor, cacheável por 60 s com revalidação ao editar |
| Formulário de candidatura até "Enviar" | < 2 s de interação em 4G; funciona sem JavaScript até o upload? Não: exige JS (upload direto ao R2), com mensagem clara se desligado |
| Lista de candidaturas | < 500 ms para 5.000 candidaturas numa vaga (índices da 7.3) |
| API v1 e MCP | p95 < 400 ms para leituras simples; `ler_curriculo` < 300 ms (texto já extraído) |
| Extração de currículo | < 10 s para 5 MB; fora da requisição do candidato |
| Volume por instância hospedada (dimensionamento) | 500 empresas, 5.000 vagas/ano, 500 mil candidaturas/ano |
| Navegadores | Safari iOS 17+, Chrome Android atual, Safari/Chrome/Edge/Firefox desktop atuais |
| Acessibilidade | WCAG 2.2 AA nas páginas públicas e do candidato (formulário com rótulos, erros ligados por `aria-describedby`, foco visível, toque ≥ 44 px); painel AA em contraste e teclado |
| Idioma | pt-BR; datas "20 de novembro de 2026", 24 h |
| Offline | não suportado |
| SEO | indexáveis: `/`, `/docs/*`, `/privacidade`, `/termos`, `/{empresa}` e `/{empresa}/vagas/{slug}` de empresas com página publicada e vagas publicadas (no `sitemap.xml` com `lastmod`). `noindex` em formulário de candidatura, `/c/*`, painel, OAuth e API. `robots.txt` bloqueia `/painel`, `/c/`, `/api/`, `/oauth/`, `/mcp`, `/entrar`, `/sair` |
| Cabeçalhos | CSP sem nonce (como o Assina v0.16) com o R2 em `connect-src`/`img-src`/`frame-src` (visualizador de PDF); `X-Frame-Options: DENY`; `Referrer-Policy: no-referrer` em `/c/*`, `strict-origin-when-cross-origin` no resto |

---

## 18. Convenções de código e repositório

- **Idioma:** banco em português, `snake_case`, prefixo `rs_`. Código, variáveis e arquivos em inglês. Tipos gerados mantêm os nomes do banco; fronteira em `src/server/db/`. A API pública usa os nomes do banco.
- **Comentários:** toda função, rota, ferramenta MCP, trigger e função SQL tem cabeçalho em português dizendo o que faz, o que recebe, o que devolve e a regra que implementa (`// Implementa a regra 11.7: pela API, reprovar vira proposta`). Lógica não óbvia leva comentário inline.
- **Copy** só em `src/lib/copy.ts`, **incluindo as descrições das ferramentas do MCP e dos campos do OpenAPI**; números só em `src/lib/limits.ts`, com a regra.
- **Segredos** só em `src/server/`, `src/app/api/`, `src/app/mcp/`, `src/app/oauth/`, `src/app/.well-known/`, `src/app/sair/` e `scripts/`. Todo arquivo de `src/server/` começa com `import "server-only"`.
- **Ator explícito:** toda função de domínio que escreve recebe `ator: Ator` (`{tipo, membroId?, credencialId?, origem}`) e o repassa ao evento. Não existe valor padrão para `ator`.
- **Alcance explícito:** toda função de domínio que lê candidaturas recebe `alcance: Alcance` (`{tipo:'todas'} | {tipo:'equipe', membroId}`).
- **Armazenamento atrás de interface:** `src/server/files/storage.ts` com `ArquivoStorage` (URL de upload e download, ler, apagar, apagar por prefixo, somar uso). Implementação S3 genérica configurada para R2 por padrão.
- **Um domínio, cinco portas:** `src/server/recruiting/` concentra vagas, candidaturas, funil, decisões, mensagens e talentos. Rotas do painel, `src/app/api/v1/`, `src/app/api/publico/`, `src/app/api/c/` e `src/app/mcp/` só fazem guardião, parse (zod) e chamada.
- **Pastas:**

```
src/
  app/
    (publico)/            # /, /privacidade, /termos, /docs/*
    [empresa]/            # página de carreiras, vagas/[slug], candidatar, links, vagas.xml
    c/[token]/            # acompanhamento
    entrar/  sair/
    painel/               # boas-vindas, nova, conta, [empresa]/(inicio, vagas, candidaturas, confirmar, talentos, mensagens, pagina, equipe, areas, pessoas, integracoes, empresa)
    convite/[token]/  pedir-convite/  admin/convites/
    api/
      auth/  painel/  publico/  c/  v1/  cron/diario/
    mcp/  oauth/  .well-known/
  features/<feature>/     # componentes de cliente (jobs, pipeline, candidate, decisions, careers, integrations)
  components/             # nav, ui
  lib/                    # copy.ts, limits.ts, format.ts, schemas/ (zod compartilhado)
  server/
    db/  auth/  org/ (members, invites, areas, people, scope)  recruiting/ (jobs, applications, pipeline, decisions, messages, talent, retention)
    files/ (storage, extract, fetch-remote)  email/  webhooks/  analytics/  mcp/ (tools)  jobs/ (jsonld, feed)  cron.ts
supabase/ migrations/  tests/  schema.sql  seed.sql
scripts/  tests/  plans/
```

- **Documentação viva:** `supabase/schema.sql`, `README.md` (com auto-hospedagem), `DOCUMENTACAO-TECNICA.md` e `CLAUDE.md` (uma página), atualizados no mesmo commit. Quando o agente errar a mesma coisa duas vezes, a correção entra em "Pegadinhas".
- **Variáveis de ambiente:**

| Variável | Pública? | Para quê |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | sim | origem (OAuth, links, JSON-LD, metadados MCP) |
| `NEXT_PUBLIC_NOME_PRODUTO` | sim | nome exibido (padrão "Contrata"; facilita a troca, 25.1) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | não | banco |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` | não | arquivos (R2 por padrão) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | não | login Google (obrigatórios) |
| `SESSION_SECRET` | não | JWT das sessões e HMAC dos códigos de exclusão do candidato |
| `CHAVES_ENC_KEY` | não | AES-256-GCM do segredo dos webhooks |
| `RESEND_API_KEY`, `EMAIL_REMETENTE` | não | e-mail |
| `CRON_SECRET` | não | faxina |
| `VISAO_INGEST_URL`, `VISAO_API_KEY` | não | analytics (opcional) |
| `CRIACAO_EMPRESA` (`convite` padrão \| `aberta`), `ADMIN_INSTANCIA_EMAILS` | não | 4.2, 11.33 |
| `USUARIOS_NOVOS_POR_DIA`, `EMPRESAS_NOVAS_POR_DIA`, `EMAILS_BLOQUEADOS` | não | 11.14 |
| `ADMIN_EMAIL` | não | alertas da instância (armazenamento, erros da faxina) |
| *(reservadas v2)* `SMTP_*`, `GOOGLE_INDEXING_*` | — | — |

- **Scripts:** `npm run dev` (porta **3050**), `typecheck`, `lint`, `test` (pgTAP local + Vitest), `build`, `verify` (os quatro + `npm audit --omit=dev --audit-level=high`), `db:types`, `openapi:check`.

### 18.1 Guardrails executáveis

| Regra | Origem | Mecanismo |
|---|---|---|
| Segredo nunca em código de cliente; `'use client'` não importa `src/server` | 18, 20.3 | hook `guard-secrets.sh` |
| Trilha só por `rs_fn_registra_evento`; nada de escrita direta em `rs_eventos` | 11.6 | hook `guard-audit.sh` + trigger `rs_tg_eventos_imutaveis` |
| Nenhuma rota de API v1 ou ferramenta MCP chama confirmação de decisão nem encerra candidatura direto | 0.2, 11.7 | hook `guard-decisoes.sh` + teste de rota com chave de todos os escopos + `verifier` |
| Situação da candidatura só muda pelas funções | 12.2 | trigger `rs_tg_situacao_candidatura` + pgTAP |
| Devolutiva obrigatória | 0.3, 11.5 | `rs_fn_encerra_candidatura` (banco) + pgTAP |
| Copy sem palavras de triagem automática | 15.3 | hook `guard-copy.sh` |
| Migration versionada não se edita | 7.6 | hook `guard-migrations.sh` |
| Teste não se edita em correção de bug | 22.1 | hook `guard-tests.sh` |
| Advisors e schema depois de migration | 7.6 | hook `remind-advisors.sh` |
| Guardião na primeira linha; toda consulta com `empresa_id` (e alcance) ou `token_hash` | 5, 6, 11.32 | `verifier` + `REVIEW.md` + testes de duas empresas e de recrutador limitado a uma área |
| Nenhum dado pessoal em log, evento, webhook de erro ou analytics | 20, 21 | `verifier` + tipo fechado |
| Critérios de aceite por épico | 8 | `verifier` |

---

## 19. Documentação técnica final

Ao fim da implementação, o agente gera o `DOCUMENTACAO-TECNICA.md` em português, descrevendo o que foi **de fato** implementado, nesta ordem:

1. modelo de dados explicado (cada tabela, coluna e valor de enum em linguagem de negócio);
2. relacionamentos com a cardinalidade em frase;
3. toda a lógica no banco (nome exato, tabela, quando dispara e o que faz);
4. mapa tela → tabelas, e o mapa ação → função de domínio → rota do painel, rota da API v1, ferramenta MCP (com "sem porta" e o motivo onde for o caso);
5. lógica por tela e por ferramenta (o que valida, grava e calcula, e o erro que a pessoa vê);
6. como hospedar (resumo do README) e o que muda entre a instância hospedada e a auto-hospedagem;
7. divergências em relação a este spec, com o porquê.

Toda mudança de schema, trigger, rota, ferramenta ou lógica de tela atualiza este documento no mesmo commit.

---
## 20. Privacidade, segurança e conformidade

### 20.1 Enquadramento (LGPD)

- **Papéis:** cada **empresa é controladora** dos dados dos seus candidatos. Na instância hospedada, a **DabLab é operadora** desses dados e controladora dos dados dos membros (conta, login). Na auto-hospedagem, quem hospeda é o operador. Os Termos têm cláusula de operador: tratamento só para o serviço, sem uso secundário, subprocessadores listados (Supabase, Vercel, Cloudflare, Resend) e exclusão quando a empresa é excluída.
- **Base legal da candidatura:** procedimentos preliminares a contrato a pedido do titular (art. 7º, V). **Banco de talentos:** consentimento (art. 7º, I), separado, opcional, com prazo e revogável a qualquer momento (art. 8º, § 5º). **Candidatura manual:** legítimo interesse da empresa (art. 7º, IX), com aviso imediato ao titular e saída em um clique (art. 9º e art. 10, § 2º). A copy cita a base, e a decisão final sobre ela é da empresa (o Contrata dá o padrão).
- **Retenção:** o produto aplica prazo padrão de 180 dias depois do encerramento (configurável de 90 a 365), que é a faixa usual de mercado para processos seletivos. A empresa decide e responde pelo prazo; o Contrata garante que ele é aplicado.
- **Decisões automatizadas (art. 20):** o produto não toma decisão automatizada sobre candidatos (princípio 2). Mesmo assim, oferece o pedido de revisão em toda candidatura encerrada, porque a empresa pode usar IA para ler candidaturas e o titular tem direito de entender e contestar a decisão.
- **Direitos do titular (art. 18):** acesso e portabilidade (baixar dados), eliminação (excluir dados), revogação do consentimento (banco de talentos) e revisão. O prazo de 15 dias da 11.13 segue, por analogia, o art. 19, II.
- **Dado sensível (art. 11):** o MVP não coleta. Os Termos proíbem perguntas de vaga sobre saúde, religião, origem racial, orientação sexual, filiação sindical e opinião política sem base legal própria da empresa, e o editor de perguntas mostra esse aviso.
- **Não discriminação:** os Termos proíbem critérios discriminatórios na seleção (Lei 9.029/1995, art. 1º), e a descrição das ferramentas de decisão do MCP repete a orientação (13.3).

### 20.2 Dados

| Dado | Por quê | Onde | Quem acessa | Retenção |
|---|---|---|---|---|
| Nome, e-mail, `google_sub`, foto do membro | conta e login | `rs_usuarios` | o próprio; nome e e-mail para a equipe da empresa | até excluir a conta |
| Cadastro de pessoas (nome, e-mail, cargo, área) | donos de vaga e equipe | `rs_pessoas` | membros da empresa (avaliador só nome e área) | até arquivar + 30 dias, depois a linha arquivada é anonimizada se não for dona de vaga não encerrada |
| Dados do candidato e currículo | processo seletivo | `rs_candidatos`, `rs_candidaturas`, `rs_respostas`, R2 | membros no alcance; integrações e agentes da empresa | regra 11.12 |
| Texto extraído do currículo | busca e leitura pelo agente | `rs_arquivos.texto_extraido` | idem | idem |
| Avaliações e notas | opinião da equipe | `rs_avaliacoes`, `rs_notas` | membros no alcance (11.9) | apagadas na anonimização |
| Mensagens enviadas | comunicação | `rs_mensagens`, `rs_notificacoes` | membros; o próprio candidato vê as dele | igual à candidatura; notificação 30 dias |
| Chaves e tokens (hash) | integrações | `rs_credenciais` | administradores | até revogar |
| Logs | diagnóstico | Vercel | DabLab | padrão da Vercel; **nunca** registrar nome, e-mail, telefone, texto de currículo, resposta, nota, avaliação, devolutiva, token ou URL `/c/…` |

### 20.3 Segurança

- Segredos só no servidor (18.1). Service role ignora RLS: os helpers de `src/server/db/` exigem `empresaId` e `alcance`, e isso é verificado por teste e pelo `verifier`.
- **CSRF:** escritas do painel e do candidato conferem `Origin = NEXT_PUBLIC_SITE_URL`; cookies `SameSite=Lax`.
- **Vínculo conferido a cada requisição:** o guardião do painel e do MCP relê `rs_membros` (removido, papel, áreas) em toda chamada; não há papel guardado em cookie ou token.
- **Tokens e códigos:** `crypto.randomBytes`/`randomInt`, só hash no banco, comparação em tempo constante.
- **Uploads:** só por URL assinada para um caminho fixo; tipo conferido pelos bytes no servidor; SVG de logo sanitizado (`DOMPurify` no servidor) ou recusado se não sanitizável; downloads por URL de 5 min.
- **Markdown da vaga** sanitizado com lista fechada de tags (sem `script`, `iframe`, `style`, atributos `on*`).
- **Injeção de prompt:** currículos e respostas são texto de terceiros que vai para a IA do recrutador. As ferramentas `ler_curriculo` e `ver_candidatura` devolvem esse texto dentro de um campo marcado como `conteudo_do_candidato` e a descrição da ferramenta diz que ele é dado, não instrução. O princípio 2 limita o estrago: nenhuma instrução escondida num currículo consegue reprovar, contratar ou mudar acessos, porque essas ações exigem confirmação humana ou não têm porta de máquina.
- **SSRF:** regra 11.18.
- **Supabase:** advisors depois de cada DDL, filtrando `rs_*`; funções com `search_path=''`; nenhuma `SECURITY DEFINER` exposta.
- **Dependências:** `npm audit --omit=dev` sem alta no `verify`.

### 20.4 IA

O Contrata **não roda modelo de IA** no servidor. A IA entra pelo MCP, escolhida e paga pela empresa. As regras do produto para esse uso:

1. O agente lê, resume, compara com os requisitos, escreve notas, move entre etapas e propõe decisões. Ele não confirma decisões, não avalia em nome de pessoas e não mexe em acessos.
2. Tudo que o agente escreve aparece marcado em roxo, "Agente · em nome de {membro}" (seção 16).
3. As descrições das ferramentas orientam contra critérios discriminatórios (13.3) e marcam o texto do candidato como dado (20.3).
4. O aviso de privacidade diz ao candidato que a empresa pode usar assistentes de IA para ler as candidaturas e que a decisão final é de uma pessoa (15.5).

---

## 21. Métricas de sucesso e telemetria

**Métricas (90 dias depois do lançamento):**

| Métrica | Alvo |
|---|---|
| Candidaturas encerradas com devolutiva entregue | 100% (é regra; mede falha de e-mail) |
| Mediana do tempo entre a candidatura e a primeira movimentação | < 7 dias |
| Candidaturas iniciadas que são enviadas | ≥ 80% |
| Empresas com pelo menos uma ação por API ou MCP | ≥ 30% |
| Propostas de agente confirmadas sem edição | medir (sem alvo; indica qualidade das devolutivas sugeridas) |

**Eventos (Visão do Produto, projeto "Contrata", prefixo `contrata_`).** Saem do servidor, só se as variáveis existirem. `distinct_id`: e-mail do membro nos eventos de membro; `cand_{candidatura_id}` nos do candidato (nunca o e-mail); `emp_{empresa_id}` nos de integração e sistema. `id` derivado de nome + registro, como no Assina.

| Evento | Tela | Propriedades (fechadas) |
|---|---|---|
| `contrata_convite_pedido` | `pedir_convite` | — |
| `contrata_convite_decidido` | `admin_convites` | `aprovado`, `horas_ate_decidir` |
| `contrata_empresa_criada` | `nova` | — |
| `contrata_membro_convidado` | `equipe` | `papel`, `limitado_por_area` |
| `contrata_area_criada` | `areas` | — |
| `contrata_pessoa_cadastrada` | `pessoas` | `com_acesso` |
| `contrata_vaga_criada` | `vagas` | `origem` |
| `contrata_vaga_publicada` | `vagas` | `origem`, `modelo_trabalho`, `regime`, `perguntas`, `etapas`, `mostra_salario`, `tem_area`, `dono_sem_acesso` |
| `contrata_candidatura_iniciada` | `candidatar` | — |
| `contrata_candidatura_enviada` | `candidatar` | `origem`, `com_curriculo`, `talentos`, `segundos_no_formulario` |
| `contrata_etapa_alterada` | `funil` | `origem`, `lote` |
| `contrata_avaliacao_registrada` | `candidatura` | `recomendacao` |
| `contrata_decisao_proposta` | `api` | `tipo`, `origem` |
| `contrata_decisao_confirmada` | `confirmar` | `tipo`, `editada`, `horas_ate_confirmar`, `lote` |
| `contrata_candidatura_encerrada` | `candidatura` | `situacao`, `origem`, `dias_ate_encerrar` |
| `contrata_revisao_pedida` | `acompanhamento` | — |
| `contrata_dados_excluidos` | `acompanhamento` | — |
| `contrata_mcp_conectado` | `autorizar` | `cliente`, `escopos` |
| `contrata_chave_criada` | `integracoes` | `escopos` |
| `contrata_api_chamada` | `api` | `rota` (padrão, sem id), `status`, `porta` (`v1`/`mcp`) — amostrado (1 a cada 10 s por credencial) |

Nenhuma propriedade carrega nome, e-mail, texto, título de vaga, nome de área ou de empresa. O tipo `PropriedadesDeEvento` é uma união fechada por evento.

---

## 22. Estratégia de teste

| O quê | Como |
|---|---|
| Permissões e alcance (5, 11.32) | Vitest de rotas nas cinco portas: duas empresas não se enxergam; recrutador limitado à área A não vê vaga da área B nem "Sem área"; avaliador só a equipe; membro removido perde acesso na requisição seguinte; token MCP de membro rebaixado perde escopo |
| Decisões (11.7) | Vitest: chave com `leitura,escrita,decisao` não consegue reprovar, contratar nem encerrar com ativas por nenhuma rota (sempre 202 + proposta); só a rota do painel com sessão de recrutador confirma; proposta com alvo alterado vira `expirada` |
| Devolutiva e situação (11.5, 12.2) | pgTAP: `rs_fn_encerra_candidatura` sem devolutiva falha; update direto de `situacao` falha; cada transição proibida falha |
| Trilha (11.6) | pgTAP: `rs_eventos` imutável; Vitest: cada função de domínio grava o evento com o ator certo (membro, agente com `membro_id`, api, sistema) |
| Candidatura (11.2, 11.3) | Vitest: validação, duplicada, tipo de arquivo pelos bytes (`.exe` renomeado para `.pdf`), 5 MB + 1 byte, honeypot, limite por IP |
| Extração | Vitest com fixtures: PDF com texto, PDF escaneado (`sem_texto`), DOCX, DOCX corrompido (`falhou`) |
| JobPosting (11.20) | Vitest: JSON-LD de vaga presencial, remota e com salário, comparado com snapshot e validado contra um schema JSON local dos campos obrigatórios; sem JSON-LD em vaga pausada |
| Retenção (11.12, 7.4) | pgTAP + Vitest com relógio injetado: expurgo apaga o que deve, mantém o que é de talentos válido, apaga arquivos depois do commit |
| Direitos do titular (11.13) | Vitest: exportar, excluir com código (5 tentativas), revisão uma vez só |
| OAuth (6.4) | Vitest: DCR, PKCE, escolha de empresa, escopos limitados pelo papel |
| MCP (13.3) | Vitest com cliente do SDK em memória: lista de ferramentas, `reprovar_candidatura` cria proposta, `ler_curriculo` marca `conteudo_do_candidato` |
| Webhooks e SSRF (11.17, 11.18) | Vitest como no Assina |
| OpenAPI | `npm run openapi:check` valida o documento |
| Banco | pgTAP: RLS sem acesso de `anon`/`authenticated`; triggers; filtrar sempre pela fixture |
| Manual | Fluxo 9.1 com o Claude real; candidatura pelo celular (iPhone e Android); JSON-LD no Teste de Pesquisa Aprimorada do Google; e-mails reais; convite aceito com conta Google de e-mail não Gmail |

### 22.1 Loop de verificação

- `npm run typecheck` · `npm run lint` · `npm test` (pgTAP local + Vitest) · `npm run build` · `npm run verify` (os quatro + audit, parando no primeiro erro). Saída saudável: tabela de rotas do `next build` e código 0, pgTAP "Result: PASS", Vitest "Tests N passed".
- Nenhum épico é declarado pronto sem colar a saída do `npm run verify` e o relatório do `verifier` sem "não cumprido".
- Telas: screenshot em claro e escuro, 375 px e 1280 px, comparada com o design aprovado.
- **Bug:** teste que reproduz → ver falhar → commit → `touch .claude/fix-mode` → corrigir → `rm .claude/fix-mode`.
- **Regra de ouro** (literal no `CLAUDE.md`): se um teste falhar, corrija o código, não o teste; nunca pule nem apague teste que falha.

---

## 23. Riscos e mitigação

| # | Risco | Impacto | Prob. | Mitigação |
|---|---|---|---|---|
| 23.1 | Volume no banco compartilhado (texto de currículo é grande: 500 mil candidaturas × ~10 KB = ~5 GB) | alto | média | Limite de 100.000 caracteres por texto; retenção automática; alerta ao `ADMIN_EMAIL` acima de 70% do plano; plano de saída: projeto Supabase próprio com as mesmas migrations (o prefixo facilita) |
| 23.2 | **Resend gratuito (100 e-mails/dia):** uma vaga com 200 candidaturas gera ~400 e-mails | baixo na instância hospedada (vitrine por convite, decisão de 20/11/2026); alto para quem hospeda e usa de verdade | alta | Limite por empresa (11.14) com fila para o dia seguinte; README avisa que uso real precisa de plano pago do Resend na conta de quem hospeda |
| 23.3 | Agente propõe muita coisa e a equipe confirma em lote sem ler | médio | média | Lote máximo de 50; texto ao candidato visível e editável em cada cartão; métrica "confirmadas sem edição" (21) |
| 23.4 | Encerrar vaga grande estoura o tempo da função | médio | baixa | Limite de 1.000 ativas por encerramento (11.7); e-mails enfileirados, não enviados na transação |
| 23.5 | Abuso da página pública (spam de candidaturas, phishing com página de carreiras falsa) | médio | baixa | Empresas só por convite aprovado (11.33); limites 11.14, honeypot, suspensão manual, Termos; Turnstile na v2 |
| 23.6 | Empresa usa o produto com critério discriminatório | alto | baixa | Termos, aviso no editor de perguntas, descrição das ferramentas; o produto não filtra por dado pessoal |
| 23.7 | Injeção de prompt em currículo induz o agente a ações indevidas | médio | média | 20.3: texto marcado como dado; ações de efeito sobre a pessoa só com confirmação humana |
| 23.8 | Google for Jobs muda os requisitos de JobPosting ou deixa de mostrar vagas de sites pequenos | médio | média | Premissa (d); feed e API pública como alternativas; página indexável de qualquer forma |
| 23.9 | Empresas sem Google (Microsoft 365) desistem por causa do login | médio | média | Decisão de 20/11/2026: só Google. O README explica como criar conta Google com e-mail corporativo; Microsoft na v2 se houver pedido |
| 23.10 | Vazamento entre empresas ou entre áreas pela service role | alto | baixa | Helpers com `empresaId` e `alcance` obrigatórios, testes nas cinco portas, `verifier` |
| 23.11 | Colisão no projeto compartilhado | alto | baixa | Prefixo `rs_` conferido livre em 20/11/2026; nunca `db push` |
| 23.12 | Vercel Hobby: cron diário e uso comercial | baixo | baixa | A instância hospedada é vitrine sem fins comerciais, por convite (4.2); atrasos de até 24 h aceitos |

---

## 24. Assunções declaradas

**Uma assunção não revisada vira verdade no minuto em que o agente começa a codar.**

| # | Assunção | Por quê | Se discordar |
|---|---|---|---|
| 24.1 | Uma instância serve várias empresas, com dados isolados por `empresa_id` | Decisão de 20/11/2026 ("várias empresas") | — |
| 24.2 | Três papéis (administrador, recrutador, avaliador) e alcance por área só para recrutador | Cobre RH centralizado e RH por área sem matriz de permissões customizável | Papéis customizáveis na v2 |
| 24.3 | Área tem um nível, sem hierarquia; uma vaga tem no máximo uma área e um dono | Simplicidade; organograma é outro produto | Subáreas na v2 |
| 24.4 | Dono de vaga sem acesso recebe só contagens, nunca dados de candidatos | Quem não tem acesso não deve ver dado pessoal por e-mail; incentiva dar acesso como avaliador | Mandar a lista de nomes no resumo |
| 24.5 | O candidato não tem conta; o link é a credencial | Princípio 4 | Conta de candidato na v2, só se houver pedido |
| 24.6 | Mudar a retenção vale para candidaturas encerradas depois da mudança | Não reabre prazos já calculados | Recalcular tudo (pode expurgar muita coisa de uma vez) |
| 24.7 | Notas, avaliações e motivo interno não entram no "Baixar meus dados" | São registros de opinião da empresa; a empresa responde a pedido formal de acesso fora do sistema se quiser | Incluir as avaliações |
| 24.8 | A API pública de candidatura aceita qualquer origem `https`, protegida pelos limites | Facilita a empresa usar o próprio site | Lista de origens por empresa |
| 24.9 | Sem IA no servidor | Custo zero para quem hospeda; a IA é do cliente | Resumo automático no servidor com chave de API da empresa na v2 |
| 24.10 | Licença MIT | Decisão de 20/11/2026 (25.6) | — |
| 24.11 | Mensagens de agente precisam de confirmação por padrão | É comunicação externa em nome da empresa | Padrão `direto` |
| 24.12 | Interface só em pt-BR | Público brasileiro | Copy centralizada |
| 24.13 | Integração (chave de API) vê todas as áreas | A chave é da empresa, criada pelo administrador | Chave limitada por área na v2 |

---

## 25. Perguntas abertas

O agente de código **para e pergunta** ao cruzar com qualquer item abaixo.

| # | Pergunta | Quem decide | Até quando |
|---|---|---|---|
| 25.1 | **Nome e domínio.** "Contrata" é nome de trabalho; o Alexandre está buscando o domínio (`.app.br`, como os outros). Conferir também no INPI | Alexandre | antes do 8.12 (o código usa `NEXT_PUBLIC_NOME_PRODUTO` até lá) |
| 25.2 | ~~Custos~~ **Respondida (20/11/2026):** Resend gratuito por ora. A instância hospedada é vitrine de portfólio, não deve ser usada para valer; quem clonar configura o próprio Resend | — | — |
| 25.3 | **Confirmar decisão dentro do chat:** quando os clientes MCP suportarem elicitação de forma confiável, aceitar a confirmação ali (com o usuário humano clicando, não o modelo)? Como garantir que foi a pessoa? | Alexandre | v2 |
| 25.4 | **LinkedIn e Indeed:** vale pedir parceria de ATS ao LinkedIn (Basic Jobs) e integrar o Indeed Apply? Ambos exigem processo com as plataformas | Alexandre | depois do lançamento |
| 25.5 | ~~SMTP~~ **Respondida (20/11/2026):** só Resend no MVP; quem clonar usa a própria conta. SMTP genérico fica na v2 (seção 28) | — | — |
| 25.6 | ~~Licença~~ **Respondida (20/11/2026):** MIT | — | — |
| 25.7 | ~~Aberta ou por convite~~ **Respondida (20/11/2026):** por convite. A pessoa pede no site, o pedido chega ao Alexandre e ele aprova (regra 11.33) | — | — |

---

## 26. Definition of Done

- [ ] Todos os critérios de 8.0–8.12 cumpridos, com a saída do `npm run verify` e o relatório do `verifier` sem "não cumprido".
- [ ] Banco em português, `snake_case`, prefixo `rs_`, sem tabela ou coluna fora da seção 7.
- [ ] Todas as rotinas, rotas, ferramentas, triggers e funções comentadas com a regra que implementam.
- [ ] RLS ligado e sem acesso de `anon`/`authenticated` em todas as `rs_*`; bucket privado.
- [ ] Advisors sem alerta crítico em `rs_*`.
- [ ] Guardrails do Anexo B instalados e testados.
- [ ] Cada ação da seção 13 existe nas portas previstas, ou consta da lista "sem porta" com o motivo; o mapa está na `DOCUMENTACAO-TECNICA.md`.
- [ ] `plans/` com o plano de cada épico, consistente com o código.
- [ ] `DOCUMENTACAO-TECNICA.md`, `CLAUDE.md`, `README.md` (com auto-hospedagem), `LICENSE` e `THIRD_PARTY_NOTICES.md` em dia.
- [ ] Fluxo 9.1 feito ponta a ponta no claude.ai, com candidaturas reais pelo celular e e-mails reais; 9.2 por `curl`; 9.3 com webhook recebido.
- [ ] JSON-LD aprovado no Teste de Pesquisa Aprimorada do Google.
- [ ] Uma auto-hospedagem de teste feita seguindo só o README, num projeto Supabase e numa conta Vercel separados.
- [ ] Modo escuro e 375 px conferidos em todas as telas da seção 10.
- [ ] Nenhum segredo no histórico do git.

---

## 27. Próximos passos operacionais

1. O Alexandre revisa a seção 24 e decide o nome e o domínio (25.1).
2. `git init` em `~/contrata`, repositório público no GitHub, conectado à Vercel.
3. Colar o prompt de implementação no Claude Code, a partir de `~/contrata`.
4. Desenhar as telas no Claude Design com `prompt-design-contrata.md`, em paralelo com 8.0–8.2.
5. Durante o 8.1: cliente OAuth do Google (escopos básicos), bucket R2 privado com CORS e token restrito, variáveis na Vercel.
6. Antes do 8.4: domínio apontado para a Vercel e verificado no Resend (SPF, DKIM, DMARC).
7. Durante o 8.11: projeto "Contrata" no Visão do Produto.
8. Antes de divulgar como portfólio, colocar `alexandre@dablab.com.br` em `ADMIN_INSTANCIA_EMAILS`, pedir um convite de teste, aprovar e rodar o fluxo 9.1 com uma empresa fictícia.

---

## 28. Roadmap: próximas releases

- **Agendamento de entrevistas** com horários do entrevistador (link de agenda hoje; integração com calendário depois).
- **Kanban** arrastável como segunda visualização do funil.
- **Confirmação no chat** (25.3).
- **Login Microsoft** e **entrada por domínio verificado**.
- **Requisição de vaga** com aprovação do dono antes de publicar, e organograma de áreas.
- **Importação de candidatos** (CSV) com base legal declarada.
- **Busca semântica** no banco de talentos (embeddings no Postgres com `pgvector`).
- **LinkedIn e Indeed** (25.4) e **Google Indexing API** para JobPosting.
- **SMTP genérico** e **Docker Compose** para auto-hospedagem fora da Vercel.
- **Interface em inglês** e páginas de carreiras bilíngues.
- **Turnstile** se aparecer abuso.

---

## 29. Protocolo de mudanças incrementais

1. Commit de checkpoint antes de qualquer mudança.
2. Não colar o spec inteiro de novo: só o trecho novo ou alterado.
3. Escrever como diff: "o app já existe e funciona; mude só X".
4. Dizer nominalmente o que **não** deve mudar.
5. Pedir o plano em plan mode (arquivos, ordem, testes, **e as portas afetadas: painel, API, MCP**) e salvar em `plans/<feature>.md`. Se for bug, o plano começa pelo teste que reproduz.
6. Revisar o `git diff` contra o plano e reverter o que passou do escopo.
7. Atualizar `DOCUMENTACAO-TECNICA.md` (e `CLAUDE.md`/README, quando couber) no mesmo commit.

Modelo:
```
O Contrata já está implementado e funcionando (spec.md v0.x, DOCUMENTACAO-TECNICA.md).
Quero mudar só isto: <descrição>.
Não mexa em: <telas/rotas/tabelas>; a trilha (rs_eventos), a confirmação humana das decisões (11.7) e a devolutiva obrigatória (11.5) continuam intocadas.
A mudança precisa existir no domínio, na API v1 e no MCP antes da tela (princípio 1), ou explicar por que não tem porta.
Entre em plan mode, me mostre o plano e salve em plans/<feature>.md depois de aprovado.
Rode npm run verify, cole a saída, acione o verifier e atualize DOCUMENTACAO-TECNICA.md no mesmo commit.
```

---

## Anexo A — Fontes (consultadas em 20/11/2026)

- Assina, repositório `asiqueira1973/assina` (spec v0.16, `CLAUDE.md`, `prompt-design-assina.md`, `.claude/`): padrão técnico, visual e de guardrails.
- Google Search Central, dados estruturados de vaga (JobPosting): https://developers.google.com/search/docs/appearance/structured-data/job-posting (conferir de novo na premissa (d)).
- LGPD, Lei 13.709/2018: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm (arts. 7º, 8º, 9º, 11, 18, 19 e 20).
- Lei 9.029/1995 (práticas discriminatórias na relação de trabalho): https://www.planalto.gov.br/ccivil_03/leis/l9029.htm
- Model Context Protocol, especificação: https://modelcontextprotocol.io/specification
- OpenCATS (ATS aberto, PHP): https://github.com/opencats/OpenCATS
- Pesquisa desta conversa (20/11/2026), fontes secundárias a reconferir antes de usar em copy: preço da Gupy (a partir de cerca de R$ 730/mês, anual); queixas de candidatos (falta de devolutiva, cadastros e testes longos, triagem por IA); Reqcore (ATS aberto, AGPL, 2026); LinkedIn Basic Jobs por feed de ATS parceiro; mudança do Indeed em 31/03/2026 para feeds de fonte única; prazos usuais de retenção em processos seletivos (90–180 dias); Retool 2026, McKinsey 2026 e Gartner sobre trocar SaaS por ferramentas próprias.
- Supabase, projeto `jeesdmfcrmhyufwzwzwt`: prefixos em uso conferidos em 20/11/2026 (`livros_`, `asq_`, `oc_`, `ag_`, `otcb_`, `as_`, tabelas sem prefixo de outro app; `en_` reservado pelo Envia; `rs_` livre).

---

## Anexo B — Kit de guardrails do Claude Code

Igual ao Anexo B do Assina, com os prefixos trocados (`as_` → `rs_`) e as diferenças abaixo. O agente copia os arquivos do `~/assina/.claude/` e aplica estas mudanças.

### `.claude/settings.json`
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-secrets.sh" },
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-audit.sh" },
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-decisoes.sh" },
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-copy.sh" },
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-migrations.sh" },
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-tests.sh" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/remind-advisors.sh" }
        ]
      }
    ]
  }
}
```

### `.claude/hooks/guard-secrets.sh`
Igual ao do Assina, com a lista de segredos:
`SUPABASE_SERVICE_ROLE_KEY|service_role|GOOGLE_CLIENT_SECRET|SESSION_SECRET|CHAVES_ENC_KEY|RESEND_API_KEY|CRON_SECRET|VISAO_API_KEY|S3_SECRET_ACCESS_KEY|S3_ACCESS_KEY_ID|NEXT_PUBLIC_[A-Z_]*(SECRET|KEY)`
e os caminhos de servidor acrescidos de `*/src/app/convite/*` (rota de aceite).

### `.claude/hooks/guard-audit.sh`
Igual ao do Assina com `rs_eventos` e `rs_fn_registra_evento`.

### `.claude/hooks/guard-decisoes.sh`
```bash
#!/bin/bash
# Princípio 2 e regra 11.7: API v1, API pública, MCP e rotas do candidato nunca confirmam decisões
# nem encerram candidaturas direto. Só a rota de confirmação do painel faz isso.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')
case "$path" in
  */src/app/api/v1/*|*/src/app/api/publico/*|*/src/app/mcp/*|*/src/server/mcp/*) ;;
  *) exit 0 ;;
esac
flat=$(echo "$content" | tr "\n" " ")
if echo "$flat" | grep -qE "rs_fn_confirma_decisao|confirmDecision|confirmarDecisao|rs_fn_encerra_candidatura|closeApplication|encerraCandidatura|rs_fn_muda_acesso|rs_fn_convida_membro|rs_fn_da_acesso"; then
  echo "Bloqueado: API e MCP não confirmam decisões, não encerram candidaturas direto e não mexem em acessos (princípio 2, regras 11.7 e 13.2). Use proposeDecision() em src/server/recruiting/decisions; a confirmação existe só em src/app/api/painel/[empresa]/decisoes/confirmar." >&2
  exit 2
fi
exit 0
```

### `.claude/hooks/guard-copy.sh`
```bash
#!/bin/bash
# Impede copy que sugere triagem automática (princípio 2, seção 15.3).
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')
case "$path" in
  */src/lib/copy.ts|*/src/server/email/*) ;;
  *) exit 0 ;;
esac
# Só arquivos de texto: em .tsx e código comum, palavras como "match" aparecem como API (str.match) e dariam falso positivo.
# Por isso toda copy, inclusive as descrições das ferramentas MCP, vive em copy.ts (seção 18).
if echo "$content" | grep -qiE 'intelig(ê|e)ncia artificial reprovou|algoritmo|pontua(ç|c)(ã|a)o|\bscore\b|ranking|fit cultural|\bmatch\b|eliminad[oa]|eliminat(ó|o)ria'; then
  echo "Bloqueado: copy sugere triagem automática, que o produto não faz (princípio 2, seção 15.3). Reescreva dizendo o que acontece de fato: uma pessoa da empresa analisa e decide." >&2
  exit 2
fi
exit 0
```

### `.claude/hooks/guard-migrations.sh`, `guard-tests.sh`
Iguais aos do Assina.

### `.claude/hooks/remind-advisors.sh`
Igual ao do Assina, com o filtro `rs_*` e `supabase/schema.sql` filtrado a `rs_`.

### `.claude/agents/verifier.md`
```markdown
---
name: verifier
description: Confere em contexto limpo se o épico implementado cumpre os critérios de aceite do spec.md. Use ao terminar cada épico, antes de declarar pronto.
tools: Bash, Read, Grep
---
Você verifica; não corrige nada.

1. Leia no spec.md a seção 8.X do épico, a matriz de permissões (seção 5), as regras da seção 11 e as máquinas de estado (seção 12) que o épico toca.
2. Leia o plano em plans/ e o git diff do épico.
3. Rode `npm run verify` e guarde a saída.
4. Para cada critério de aceite: cumprido / não cumprido / não verificável, com evidência (saída de comando ou arquivo:linha).
5. Toda ação nova existe no domínio, na API v1 e no MCP, ou está na lista "sem porta" da seção 13.2 (princípio 1)?
6. Toda rota nova chama o guardião na primeira linha (requireMembro, requireCredencial, requireCandidaturaPorToken, requireEmpresaPublica)? Toda consulta filtra por empresa_id e respeita o alcance (área, equipe) ou usa token_hash?
7. Algum caminho de API, MCP ou rota pública reprova, contrata, encerra candidatura ou confirma decisão sem passar por proposta + confirmação no painel (princípio 2, 11.7)? Algum encerramento acontece sem devolutiva (11.5)?
8. Toda escrita passa um Ator e grava evento na mesma transação, com ator e credencial certos (11.6)?
9. Algum log, evento, analytics, webhook de erro ou resposta de erro carrega nome, e-mail, telefone, texto de currículo, resposta, nota, avaliação, devolutiva, token ou URL /c/ (seções 20 e 21)?
10. Liste divergências entre o diff e o plano.

Termine com uma linha: PRONTO ou NÃO PRONTO, e os itens que impedem.
```

### `REVIEW.md`
```markdown
# Instruções de revisão

## Passes
Faça três passes e marque cada achado com o passe:
- Bugs: transições proibidas da seção 12; devolutiva obrigatória (11.5); proposta com alvo alterado (11.7); expurgo apagando o que não deve ou mantendo o que deve sair (11.12); fuso (11.19); lote tudo-ou-nada (11.30); idempotência de e-mail e webhook.
- Segurança: matriz da seção 5 e alcance por área (11.32); guardião na primeira linha; toda consulta com empresa_id e alcance (service role ignora RLS); papel relido a cada chamada; API e MCP nunca confirmam decisões nem mexem em acessos; tokens e códigos só como hash; SSRF; Origin nas escritas; texto de candidato marcado como dado no MCP; nada pessoal em log ou analytics.
- Conformidade: spec.md (épicos, regras sem número inventado, copy em src/lib/copy.ts sem as palavras proibidas), plano em plans/, convenções da seção 18 (banco em português com prefixo rs_, rotinas comentadas com a regra, uma regra num lugar só, as três portas).

## O que é Importante
Importante é o que deixa alguém sem resposta, deixa uma máquina decidir sobre uma pessoa, expõe dado de uma empresa ou área a quem não devia, guarda dado além do prazo ou viola regra do spec. Estilo e nome são detalhe.

## Limite de detalhes
No máximo cinco detalhes por revisão; resuma o resto como contagem.

## Não reportar
Arquivos gerados (src/server/db/types.ts, supabase/schema.sql) e o que o lint/CI já garante.
```
