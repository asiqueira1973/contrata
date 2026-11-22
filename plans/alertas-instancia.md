# Plano — Alertas da instância ao `ADMIN_EMAIL`

## Contexto
O spec promete alertas a quem hospeda e nada os envia hoje (achado C1 do verifier do 8.12):
- **6.1 (l. 263):** login recusado porque o e-mail novo da conta Google já é de outro usuário → alerta ao `ADMIN_EMAIL`. Hoje o callback (`src/app/api/auth/google/callback/route.ts:40`) só volta com `email_em_uso`.
- **18 (l. 1395):** `ADMIN_EMAIL` recebe "alertas da instância (armazenamento, erros da faxina)". Hoje `runDailyCleanup` só põe `falharam` no log.
- **23.1:** alerta acima de 70% do plano do banco.
- **11.14:** acima de 5 GB a empresa tem o upload recusado "e avisa o administrador" (da empresa). Hoje só recusa (`applications.ts:160` e `:315`, `armazenamento_cheio`).

`ADMIN_EMAIL` continua opcional: vazia, nenhum alerta da instância sai e nada falha (no log, só o nome do alerta).

## Decisões (aprovar junto)
1. **Pela fila de e-mail que já existe** (`email/outbox.enqueue`): chave por dia, retentativa da faxina, descarte na 5ª falha e corpo apagado depois do envio.
   - Migration `rs_alertas`: `rs_notificacoes.empresa_id` passa a aceitar nulo (alerta da instância não é de empresa).
   - Enum `rs_tipo_notificacao` ganha `alerta_instancia` e `armazenamento_cheio`.
   - `rs_fn_notificacoes_a_retentar` troca o `join` por `left join` (sem empresa, não há suspensão a conferir).
   - `NovaNotificacao.empresaId` vira opcional.
2. **Um módulo** `src/server/alerts/instance.ts` com `alertaDaInstancia(tipo, dados)`.
   - Sem `ADMIN_EMAIL`, não faz nada.
   - Chave `alerta:{tipo}:{dia em FUSO}` (+ id quando houver): no máximo um por tipo por dia.
   - Nunca lança: falha vira log só com o código.
   - Modelos em `email/templates.ts`; texto em `copy.emailAlertas`.
3. **Os quatro alertas, sem dado pessoal (20.2):**
   - **Login com e-mail em uso (6.1):** o callback chama o alerta depois do `fail`. O texto diz o que houve e como resolver (o usuário antigo trocou de e-mail no Google, ou duas contas disputam o mesmo endereço). Leva só os **ids internos** dos dois usuários: o que tem o e-mail, achado pelo e-mail no servidor, e o que tentou entrar, pelo `google_sub`, se existir. Nenhum e-mail nem nome. Chave por dia e por usuário dono do e-mail.
   - **Faxina com falha (18):** no fim de `runDailyCleanup`, se `falharam` não estiver vazio, um alerta com os nomes dos passos e o código de erro de cada um (já capturado no `seguro`). `sobrou` não alerta, porque é atraso normal que o dia seguinte resolve. Uma vez por dia.
   - **Banco acima de 70% do plano (23.1):** passo novo da faxina, `alerta_banco`. Função `rs_fn_tamanho_banco()` (`security definer`, `pg_database_size(current_database())`, EXECUTE só para `service_role`). O plano vem da variável nova e opcional `ALERTA_BANCO_LIMITE_MB`; o padrão em `limits.ts` é 500, o plano gratuito do Supabase. O limiar é `ALERTA_BANCO_FRACAO = 0.7`. O alerta leva o tamanho e o limite em MB. No projeto compartilhado, mede o banco inteiro, que é o que o plano limita.
   - **Empresa sem espaço (11.14):** quando a candidatura é recusada com `armazenamento_cheio`, vai um e-mail aos **administradores da empresa**, não ao `ADMIN_EMAIL`, com uso e limite em GB. Chave `armazenamento_cheio:{empresa}:{dia}`, então um por dia. Fila normal, com `empresa_id`.
4. **Sem evento na trilha:** alertas não são ação sobre um registro. O e-mail de "empresa sem espaço" fica em `rs_notificacoes` como os outros.
5. **`limits.ts`:** `ALERTA_BANCO_LIMITE_MB_PADRAO = 500` e `ALERTA_BANCO_FRACAO = 0.7`, com o número da regra.
6. **`.env.example` e README:**
   - `ALERTA_BANCO_LIMITE_MB` (opcional), com a linha na tabela.
   - A descrição de `ADMIN_EMAIL` volta a citar os alertas.
   - A spec 18 ganha a variável nova.

## Fases
- **A — Banco:** migration `2026112300…_rs_alertas.sql` (coluna anulável, enum, `left join`, `rs_fn_tamanho_banco`, grants). Aplicar local e remoto pelo `apply_migration`. Depois advisors `rs_*`, `db:types` e `db:schema`.
- **B — Código:**
  - `alerts/instance.ts`;
  - `outbox.enqueue` com empresa opcional;
  - o callback;
  - em `cron.ts`, o passo `alerta_banco` e o alerta de falhas no fim;
  - em `applications.ts`, o aviso aos administradores;
  - modelos, copy e limits.
- **C — Testes:**
  - pgTAP: notificação sem empresa é retentada; `rs_fn_tamanho_banco` devolve número e não é exposta a `anon`.
  - Vitest, com a caixa de saída de teste (`captureEmails`):
    - sem `ADMIN_EMAIL`, nada sai;
    - login com e-mail em uso gera um alerta, só com ids, sem e-mail;
    - dois logins no mesmo dia geram um alerta só;
    - faxina com um passo que falha gera alerta com o nome do passo;
    - faxina limpa não gera alerta;
    - banco acima do limiar gera alerta (limite pequeno pela variável) e abaixo não gera;
    - empresa acima de 5 GB gera e-mail aos administradores, um por dia, e não ao candidato;
    - nenhum alerta leva nome, e-mail ou texto de candidato.
- **D — Documentos:** DOCUMENTACAO-TECNICA, CLAUDE.md, README, spec v0.4.13 (6.1, 18, 23.1 e 11.14 marcados como implementados), `docs/entrega.md` (pôr `ADMIN_EMAIL` e, se o plano não for o gratuito, `ALERTA_BANCO_LIMITE_MB`) e `plans/alertas-instancia.md`.
- **E — Fechamento:** `npm run verify`, commit, verifier em contexto limpo, achados pelo protocolo.

## Verificação
- `npm run verify` verde.
- Pelo `/api/cron/diario` local com `ADMIN_EMAIL` e `ALERTA_BANCO_LIMITE_MB=1`, o alerta aparece em `.caixa-de-saida-local/`.
- A segunda chamada no mesmo dia não gera outro.

## Resultado (23/11/2026)
- Migration `20261123090000_rs_alertas.sql` (local e remoto pelo `apply_migration`): `rs_notificacoes.empresa_id` anulável, tipos `alerta_instancia` e `armazenamento_cheio`, retentativa com `left join`, `rs_fn_tamanho_banco()` só para `service_role`. Advisors `rs_*`: só o "RLS sem política" esperado.
- `src/server/alerts/instance.ts` com os quatro alertas; chamados no callback do Google, no fim de `runDailyCleanup` (passo `alerta_banco` e o alerta das falhas, com o código de cada passo) e em `confereEspaco` das candidaturas.
- Testes: `src/server/alerts/alerts.test.ts` (sem `ADMIN_EMAIL` nada sai; e-mail em uso com ids e um por dia; faxina com passo que falha e sem repetir no dia; banco acima e abaixo do limiar; empresa acima de 5 GB avisa só os administradores, um por dia), um caso novo no teste do callback e `supabase/tests/rs_alertas.test.sql`.
- Documentos: spec v0.4.13, README (variável `ALERTA_BANCO_LIMITE_MB`), `.env.example`, DOCUMENTACAO-TECNICA, CLAUDE.md, `docs/entrega.md`.
