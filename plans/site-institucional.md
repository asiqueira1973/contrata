# Plano — Site institucional do Vaga Aberta, no jeito do Fechou Por Quanto

## Contexto
A página inicial de hoje (8.12) funciona, mas tem cara de modelo pronto: cartões arredondados, selos, grade de ícones. O Alexandre quer um site institucional "sem cara de IA", como o do Fechou Por Quanto (`~/metro-quadrado`), com a referência de estrutura da Breakcold (`docs/referencias/landing-breakcold.md`). A mensagem central: **o recrutamento inteiro acontece dentro da IA que você já usa (Claude, ChatGPT, Grok)**, sem painel.

Decisões já tomadas por ele:
- Visual editorial do Fechou.
- As três IAs citadas por igual, sem teste no Grok.
- Fotos documentais de "lugares que contratam", geradas no Higgsfield.
- As telas dos prints recriadas em HTML com dados fictícios.

## Decisões
1. **Escopo.** Refeitas a página inicial `/` e as páginas de documentação (`/docs/mcp`, `/docs/api`, `/docs/auto-hospedagem`) e as legais (`/privacidade`, `/termos`), com cabeçalho e rodapé novos. As páginas de carreiras, da vaga, do candidato e o consentimento do conector não mudam: continuam na família do Assina (seção 16).
2. **Visual.** Portado de `~/metro-quadrado/apps/web/src/features/site/site.module.css`:
   - fundo off-white `#fdfcfc`, com seções alternadas em bege `#f4f2ef`;
   - tinta `#0a0a0a`;
   - Geist nos títulos e Inter no texto (`next/font/google`), Geist Mono para nomes de ferramentas e endereço do conector;
   - réguas finas em vez de cartões e colunas separadas por linha vertical;
   - botão preto retangular com raio de 2 px e link secundário sublinhado;
   - passos numerados "01 / 02 / 03";
   - FAQ com `<details>`;
   - sem sombra, gradiente, ícone genérico ou emoji. Azul `#0071e3` só em links.
   - **Modo escuro** (exigido no DoD para as páginas da 10.1): os mesmos tokens invertidos (fundo quase preto, bege vira cinza-escuro).
3. **Página inicial**, de cima para baixo:
   1. **Abertura**:
      - etiqueta "Recrutamento e seleção, código aberto";
      - título em duas linhas: "Contrate conversando. / Dentro da sua IA.";
      - subtítulo sobre não ter painel;
      - botão "Conectar no Claude, ChatGPT ou Grok" e o link "Como hospedar";
      - linha "Funciona no Claude, no ChatGPT e no Grok."
      - À direita, a conversa recriada em HTML: pedido → bloco "Consultando Vaga Aberta" com as ferramentas e os tempos → resposta → o formulário de decisões no chat, com "Reprovar e enviar 2".
      - Embaixo, foto larga (padaria).
   2. **O problema**: "Sistema de recrutamento é mais uma tela para aprender." Três colunas com réguas.
   3. **Como funciona**, em três passos numerados: você pede; o agente prepara e abre o formulário; nada acontece sem o seu clique.
   4. **Uma vaga do começo ao fim**: as telas do teste real, recriadas.
      - o formulário da vaga;
      - o resumo frente aos requisitos (só "atende", sem nota);
      - o formulário "Contratar + Encerrar a vaga";
      - o e-mail da devolutiva.
      - Foto do escritório.
   5. **O que o candidato vê**:
      - página de acompanhamento e e-mail recriados;
      - sem conta, devolutiva sempre;
      - pedir revisão, baixar e excluir os dados.
      - Foto vertical (cadeira de entrevista).
   6. **Peça assim**: exemplos de pedidos em três grupos (quem recruta, gestor que avalia, RH de uma pessoa só), cada um com botão "Copiar".
   7. **Para quem / O que não faz**: duas listas com réguas.
   8. **Como conectar**:
      - caixa com `https://vagaaberta.app.br/mcp` e "Copiar";
      - três passos e link para `/docs/mcp`;
      - foto larga (loja ou oficina).
   9. **Integrações e código aberto**: API, webhooks para o n8n, auto-hospedagem, licença MIT.
   10. **Perguntas frequentes**: é grátis? onde ficam os dados (LGPD)? a IA decide sozinha? funciona no Grok? (as três sim; os formulários com botão aparecem no Claude e no ChatGPT, e nas outras IAs a confirmação sai por prévia na conversa) posso hospedar o meu?
   11. **Rodapé**: "Um produto DabLab", Privacidade, Termos, Documentação, GitHub.
4. **Fotos no Higgsfield**:
   - Modelo: `flux_2` pro em 2K, cerca de 1,5 crédito cada.
   - Seis fotos e algumas refeitas, com teto de 20 créditos.
   - Mesma fórmula do Fechou: fotografia documental, cena comum e brasileira com detalhes concretos, luz do dia, "35mm analog film, Kodak Portra 400, natural grain, muted warm colors". Proibido: ninguém olhando para a câmera, texto, placa legível, cara de render.
   - Cenas:
     - padaria de bairro abrindo cedo (16:9);
     - escritório pequeno de contabilidade (16:9);
     - cadeira vazia de entrevista perto da janela (3:4);
     - bancada de oficina (16:9);
     - loja de rua com a porta aberta (16:9);
     - canteiro de obra ou cozinha de restaurante (16:9), de reserva.
   - Tratamento: convertidas com `cwebp -q 76 -resize 1800 0` para `public/site/*.webp`, com `next/image` e tamanho explícito.
   - Os prompts ficam guardados em `docs/referencias/fotos-site.md`, porque o Fechou perdeu os dele.
5. **Telas recriadas** em componentes HTML/CSS em `src/features/public/`: conversa, formulário de decisões, formulário da vaga, e-mail e página do candidato. Dados fictícios da "Padaria Pão de Cada Dia" ("Assistente administrativo", candidatas Mariana e Juliana, nenhum e-mail real). Funcionam em 375 px.
6. **Texto** todo em `copy.ts` (blocos `inicio` e `docs` reescritos), sem "revolucione", sem emoji, com números reais: 18 consultas e operações e 22 formulários, conferidos pelo teste que já existe.
7. **Spec v0.4.15**: a seção 16 passa a dizer que o site institucional segue a linha editorial da DabLab (como o Fechou Por Quanto) e que as páginas do produto seguem a família do Assina. `docs/referencias/landing-breakcold.md` ganha a nota "aplicada no site de 23/11".

## Arquivos
- **Novos ou reescritos:**
  - `src/app/(publico)/layout.tsx` (fontes, cabeçalho e rodapé do site);
  - `src/app/(publico)/page.tsx`;
  - `src/features/public/site.module.css`, que substitui o `public.module.css`;
  - `src/features/public/{conversa,telas,copiar}.tsx`;
  - `doc-page.tsx` e `site-footer.tsx` adaptados;
  - `public/site/*.webp`;
  - `docs/referencias/fotos-site.md`.
- **Atualizados:** `src/lib/copy.ts`, `src/features/public/public.test.ts` (as mesmas garantias com a copy nova), DOCUMENTACAO-TECNICA, CLAUDE.md, spec e `plans/site-institucional.md`.
- **Reaproveitados do Fechou:** tokens e classes de `site.module.css`, o padrão de `copiar.tsx` e o desenho do mock de conversa e do recibo.

## Verificação
- `npm run verify` verde. O teste de páginas públicas continua garantindo 200 e `index`, canônica, números contra o conector, sitemap, operador e README.
- No navegador: `/`, `/docs/mcp` e `/privacidade` a 375 px e no desktop, claro e escuro. Sem rolagem horizontal. Fotos carregando.
- Publicar (push na `main`) e conferir em `vagaaberta.app.br`.

## Resultado (23/11/2026)
- **Página inicial:** refeita na ordem do plano, com a seção "No que acreditamos" pedida durante o trabalho ("Os sistemas vão ser usados de dentro das IAs").
- **Fotos:** seis geradas no Higgsfield, cerca de 9 créditos, nenhuma refeita. Estão em `public/site/`, de 84 a 228 KB cada, com os prompts em `docs/referencias/fotos-site.md`.
- **Telas recriadas** em `telas.tsx`: conversa, vaga, comparação com requisitos, decisões (contratar e encerrar), e-mail e acompanhamento, com dados da Padaria Pão de Cada Dia.
- **Documentação e páginas legais** passam a usar o mesmo layout. `/docs/mcp` ganhou a seção do Grok, e a política de privacidade cita o Grok.
- **Divergência:** o rodapé não diz "Um produto DabLab". O teste que impede escrever o nome do operador à mão barrou o texto. Ele mostra "Operado por {OPERADOR_NOME}" quando a variável existe.
- **Testes:** as páginas públicas são renderizadas dentro do layout, com `next/font` simulado; as fotos existem e têm texto alternativo; as telas não levam e-mail nem nome reais; a inicial cita as três IAs e o "no que acreditamos".
- **Navegador:** conferido no desktop no tema claro e a 375 px no escuro, sem rolagem horizontal.
- **Cores (pedido do Alexandre ao ver):** o bege do Fechou ficou "morto". Agora o fundo é branco, as seções alternadas usam um azul bem claro (`#f2f7fd`) e o azul `#0071e3` marca etiquetas, números dos passos, o botão principal, o pedido na conversa e os botões das telas.
