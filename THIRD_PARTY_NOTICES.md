# Avisos de terceiros

O Vaga Aberta é distribuído sob a licença MIT (arquivo `LICENSE`). Este arquivo registra as referências funcionais usadas no projeto e os componentes de terceiros que vão junto com o que o Vaga Aberta entrega: o site, o servidor MCP, a API e o formulário que abre dentro do chat.

## Referências funcionais

**Assina** (`asiqueira1973/assina`) e **Agenda Psi**, do mesmo autor e da mesma DabLab, licença MIT.
- Serviram de referência de stack e de padrões: login Google com sessão em cookie, Cloudflare R2 com URL pré-assinada, fila de e-mail no Resend, cron diário, API REST com chave, webhooks com HMAC e busca protegida contra SSRF, servidor MCP com OAuth 2.1 próprio, analytics pelo servidor, guardrails e a página legal (Assina); formulários de MCP Apps e o fallback com prévia (Agenda Psi).
- Os trechos portados mantêm a mesma licença e o mesmo titular do `LICENSE`.

Outros sistemas de recrutamento citados no `spec.md` (OpenCATS e semelhantes) foram só leitura de mercado; nenhum código deles foi copiado.

## Componentes incluídos no que o Vaga Aberta entrega

| Componente | Versão | Licença | Onde aparece |
|---|---|---|---|
| Next.js, React e React DOM | 16.4.6 / 19.3.0 | MIT | O site, as rotas da API e do MCP |
| `@modelcontextprotocol/server` | 2.4.0 | Apache-2.0 | Servidor MCP (`/mcp`) |
| `@modelcontextprotocol/ext-apps` | 2.0.4 | MIT | Formulários no chat (MCP Apps), no servidor e no HTML do formulário |
| `@supabase/supabase-js` | 2.119.2 | MIT | Acesso ao banco pelo servidor |
| AWS SDK for JavaScript v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) | 3.1175.0 | Apache-2.0 | Currículos e logos no Cloudflare R2 (ou outro S3) |
| jose | 6.2.18 | MIT | Sessão (JWT) e tokens |
| zod | 4.6.7 | MIT | Validação e esquemas (MCP, API v1, OpenAPI) |
| marked | 18.2.1 | MIT | Descrição das vagas em markdown |
| sanitize-html | 2.18.2 | MIT | Limpeza do HTML das vagas e do SVG dos logos |
| unpdf | 1.9.1 | MIT | Texto dos currículos em PDF |
| mammoth | 1.13.0 | BSD-2-Clause | Texto dos currículos em DOCX |
| lucide-react | 1.77.0 | ISC | Ícones |
| server-only | 0.0.1 | MIT | Barreira entre servidor e navegador |

Só no desenvolvimento e nos testes (não vão no que é entregue): node-forge (BSD-3-Clause, certificado dos testes de webhook), happy-dom (MIT, DOM dos testes de componente), Vitest, Vite, TypeScript, ESLint e a Supabase CLI.

Os textos completos das licenças estão em cada pacote, em `node_modules/<pacote>/LICENSE`. A versão exata de cada um está em `package-lock.json`.

**Apache-2.0 (`@modelcontextprotocol/server` e AWS SDK):** quem redistribuir o Vaga Aberta mantém os avisos de copyright e de licença desses pacotes, que já vão em `node_modules` e no `package-lock.json`; nenhum deles foi modificado.
