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
