# Prompt para o Claude Design — Contrata (nome de trabalho)

Cole o bloco abaixo no Claude Design. Fonte: `spec.md` v0.2, seções 5, 8, 9, 10, 11.21, 15 e 16.

```
Crie todas as telas do Contrata, um sistema de recrutamento e seleção (ATS) gratuito e de código aberto, em português, para empresas pequenas e médias. Ele faz o miolo de uma Gupy: abrir vagas, página de carreiras, candidatura sem cadastro, funil por etapas, avaliações da equipe e resposta a todo candidato. Boa parte do trabalho do RH acontece pelo Claude (conector MCP) e por API; o painel é a referência visual e o lugar onde uma pessoa confirma decisões sobre candidatos. Desenhe cada tela em desktop (1280 px) e celular (375 px), em modo claro e escuro. Use a copy abaixo literalmente: é texto final. Não invente telas além das listadas.

## Identidade visual (mesma família dos apps Assina e Reunião, assina.app.br e reuniao.app.br)
- Tipografia de sistema Apple (-apple-system, SF Pro Display/Text, Helvetica Neue). Títulos de página grandes e pesados (~34 px, 700, tracking negativo). Contadores e datas com números tabulares.
- Único destaque de marca no painel: azul #0071e3 (escuro #0a84ff), em botões primários em pílula com "+" no canto superior direito, alinhados ao título ("+ Nova vaga"), links, item ativo do menu e foco. O azul nunca indica status.
- Fundo branco ou preto. Menu lateral e cartões em cinza #f5f5f7 (escuro #1c1c1e). Texto secundário #6e6e73 / #98989d. Hairlines #d2d2d7 / #38383a. Sem sombra pesada, muito espaço em branco.
- Pílulas de status com fundo a 12% e texto na cor:
  - verde #34c759 = Publicada, Aprovada/Contratada;
  - laranja #ff9500 = Sinalizada, Parada, Para confirmar, E-mail não entregue;
  - vermelho #ff3b30 = Reprovada, Revisão atrasada, erro;
  - cinza #8e8e93 = Rascunho, Pausada, Encerrada, Retirada;
  - roxo #af52de (escuro #bf5af2) = tudo que foi feito por agente de IA: selo "Agente · em nome de Ana" em notas, no histórico e nas propostas.
- Cartões cinza de cantos 16–18 px, sem borda; título semibold, uma linha secundária menor; à direita pílula de status e botões brancos em pílula. 12 px entre cartões.
- Ícones de traço fino (estilo lucide). Toque mínimo de 44 px.

## Navegação do painel: menu lateral estilo App Store Connect
- Coluna fixa à esquerda (~250 px), fundo cinza claro. No topo, o nome da empresa em negrito com um chevron para trocar de empresa (a pessoa pode estar em mais de uma).
- Grupos com título em negrito escuro e caixa normal (nunca maiúsculas):
  - **Recrutamento**: Início, Vagas, Para confirmar (com número laranja à direita quando há pendências), Banco de talentos;
  - **Pessoas**: Equipe, Áreas, Pessoas;
  - **Configurar**: Página de carreiras, Mensagens, Integrações, Empresa.
- Itens indentados, sem marcador. Hairline entre os grupos.
- Um item ativo por vez: texto azul #0071e3 com pílula azul clara ao fundo.
- Rodapé separado por hairline: foto, nome e e-mail do usuário, "Minha conta" e "Sair".
- Variações por papel: administrador vê tudo; recrutador não vê Equipe, Áreas, Integrações de chaves nem Empresa; avaliador vê só Início e Vagas. Desenhe o menu do administrador e, numa miniatura, o do avaliador.
- Abaixo de 1024 px, o menu vira gaveta.

## Perfis
- Administrador: configura a empresa, convida a equipe (sempre com login Google), cria áreas (departamentos), mantém o cadastro de pessoas e as integrações.
- Recrutador: conduz as vagas de todas as áreas ou só das áreas dele.
- Avaliador: gestor ou entrevistador; vê só as vagas em que está na equipe e registra avaliações. Só vê a avaliação dos outros depois de registrar a dele.
- Dono de vaga sem acesso: aparece só como pessoa cadastrada ("Sem acesso"); recebe um resumo semanal por e-mail, só com números.
- Candidato: sem conta. Página de carreiras, formulário único, link de acompanhamento.

## Telas do painel
1. **Entrar** (`/entrar`): só "Entrar com Google", centrado, com o nome do produto e uma frase: "Recrutamento e seleção, de código aberto."
2. **Convite** (`/convite/…`): "{Carla} convidou você para a equipe de recrutamento da Padaria Exemplo como Recrutador." Botão "Entrar com Google para aceitar". Variação: "Este convite é para ana@padaria.com.br. Você entrou como ana.silva@gmail.com. [Entrar com outra conta]".
3. **Boas-vindas**: "Bem-vindo ao Contrata. Para continuar, leia e aceite os Termos de uso e a Política de privacidade. [Aceitar e continuar]".
4. **Empresas** (`/painel`): cartões das empresas do usuário e "+ Criar empresa".
5. **Criar empresa**: Nome da empresa · Endereço da página de carreiras (contrata.app/____ com pré-visualização ao vivo) · E-mail que recebe as respostas dos candidatos. Erro: "Esse endereço já está em uso. Tente outro."
6. **Início**: três cartões de atenção no topo (Para confirmar 4 · Revisões pedidas 1 · Paradas há 14+ dias 7), depois a lista das vagas publicadas com contagem por etapa.
7. **Vagas**: título "Vagas" + "+ Nova vaga". Filtros em pílula: Status, Área, Dono. Cartões: "Assistente administrativo" · "Financeiro · dono: Bruno · 12 em análise · 3 em entrevistas" · pílula Publicada · "Ver página". Estado vazio: "Nenhuma vaga ainda. Crie uma aqui ou peça ao Claude: "crie uma vaga de…". [+ Nova vaga]".
8. **Editar vaga**: formulário em seções com índice lateral no desktop: Básico (título, área, dono da vaga com busca no cadastro de pessoas e selo "Sem acesso · recebe resumo semanal" quando for o caso), Descrição (markdown simples), Requisitos, Local e regime (presencial/híbrido/remoto, cidade, UF, CLT/PJ/Estágio/…), Salário (faixa, mês/hora, "Mostrar na página"), Etapas (lista reordenável: Triagem, Entrevista com RH, Entrevista com a gestão, Proposta), Perguntas (até 10; tipo; obrigatória; "Resposta esperada" com a ajuda "Quem responder diferente fica sinalizado. Ninguém é reprovado automaticamente."), Equipe (responsável e avaliadores). Barra superior: pílula de status, "Pré-visualizar", "Salvar", botão azul "Publicar".
9. **Funil da vaga**: cabeçalho com título, pílula de status e "…" (Pausar, Encerrar, Exportar CSV). Controle segmentado com as etapas e contagens: "Triagem 42 · Entrevista com RH 6 · Entrevista com a gestão 2 · Proposta 1 · Encerradas 31". Filtros em pílula: Sinalizadas, Paradas há 7+ dias, Falta minha avaliação. Busca "Buscar no currículo e nas respostas". Linhas com caixa de seleção, nome, cidade, "chegou há 3 dias", selos (laranja "Não atende: Possui CNH?"), mini-indicador "2 ✓ 1 ✗". Ao selecionar, barra "3 selecionadas · Mover para… · Exportar". No desktop largo, o detalhe abre num painel à direita.
10. **Candidatura**: desktop em duas colunas. Esquerda: currículo (visualizador de PDF) em altura total. Direita: barra fixa "Mover para… · Avaliar · Mensagem · …" (no menu: Reprovar, Marcar como contratada, Reabrir) e cartões: Contato; Respostas; Avaliações (com o estado "Registre sua avaliação para ver a dos outros."); Notas (uma nota de pessoa e uma nota roxa "Agente · em nome de Ana"); Mensagens; Histórico (linha do tempo com o ator em cada evento: "Ana (painel)", "Claude · em nome de Ana", "Integração n8n", "Sistema", "Candidato", e "proposto por Claude · em nome de Ana · confirmado por Bruno"). Celular: uma coluna, currículo atrás de um botão "Ver currículo".
11. **Diálogo Reprovar**: "Reprovar Mariana Souza?" · Motivo (só para a equipe): lista · Mensagem para Mariana (vai por e-mail): campo com o texto do modelo · [Reprovar e enviar] [Cancelar].
12. **Diálogo Encerrar vaga**: "Encerrar Assistente administrativo? 18 pessoas em andamento vão receber esta mensagem: [texto] · Motivo: Vaga preenchida / Vaga cancelada / Outro · [Encerrar e enviar]".
13. **Para confirmar**: barra "Selecionar todas · Confirmar 4". Cartões grandes: "Reprovar: Mariana Souza · Assistente administrativo · Proposto por Claude · em nome de Ana há 2 h · Justificativa: Não tem experiência com faturamento, requisito obrigatório. · Mensagem para a candidata: [campo editável] · [Confirmar] [Descartar]". Variação de proposta inválida: "Esta proposta não vale mais: a candidatura já foi encerrada." Estado vazio: "Nada para confirmar. Quando um agente ou integração propuser reprovar, contratar ou encerrar, a proposta aparece aqui."
14. **Banco de talentos**: busca, lista de pessoas com "no banco até 03/2027" e "Convidar para uma vaga".
15. **Equipe**: lista de membros (foto, nome, e-mail, papel, áreas, último acesso) e convites pendentes ("Reenviar", "Cancelar"). "+ Convidar": E-mail · Papel: Administrador (tudo, inclusive equipe e integrações) / Recrutador (conduz vagas) / Avaliador (avalia nas vagas em que estiver) · Áreas (só recrutador): Todas / Escolher áreas. Erro: "A empresa precisa de pelo menos um administrador. Promova outra pessoa antes."
16. **Áreas**: cartões "Financeiro · responsável: Bruno · 2 vagas abertas · 1 recrutador". "+ Nova área". Vazio: "Nenhuma área ainda. Áreas organizam as vagas e permitem limitar o que cada recrutador vê."
17. **Pessoas**: explicação no topo: "Gestores, donos de vaga e entrevistadores. Quem não tem acesso não entra no sistema; se for dono de vaga, recebe um resumo semanal só com números." Lista: nome, cargo, área, selo "Com acesso · Avaliador" ou "Sem acesso · [Dar acesso]", vagas de que é dono.
18. **Mensagens**: modelos (Confirmação, Devolutiva padrão, Vaga preenchida, Vaga cancelada, Convite para entrevista, Convite para vaga, Contratação) com editor, variáveis clicáveis ({{nome}}, {{vaga}}, {{empresa}}, {{link_acompanhamento}}, {{link_agenda}}…), pré-visualização com dados fictícios e "Voltar ao padrão".
19. **Página de carreiras (config.)**: logo, cor de destaque (com aviso se o contraste for baixo), descrição, site, pré-visualização ao vivo com a faixa "Página ainda não publicada", botão "Publicar página".
20. **Integrações**: três cartões: Chaves de API (lista com nome, prefixo rsk_Ab12…, escopos Leitura/Escrita/Decisão, último uso, Revogar; "+ Nova chave"; aviso "Copie a chave agora. Por segurança, ela não aparece de novo."), Conexões MCP ("Claude · conectado por Ana · Leitura, Escrita, Propor decisões · Revogar" e como conectar: endereço {site}/mcp), Webhooks (URL, eventos, "Enviar teste"). Rodapé: feed XML e API pública da página de carreiras.
21. **Empresa**: e-mail de contato, retenção ("Candidaturas encerradas são anonimizadas 180 dias depois do encerramento. Quem está no banco de talentos fica até o consentimento vencer."), validade do banco de talentos, "Mensagens enviadas por agentes: Precisam de confirmação / Saem direto", aviso de privacidade extra, zona de perigo "Excluir empresa".
22. **Consentimento MCP** (`/oauth/autorizar`): cartão central. "Claude quer acessar o Contrata." Empresa: [seletor] · O que ele poderá fazer: ☑ Ler vagas e candidaturas · ☑ Criar e mover · ☑ Propor decisões · O que ele não poderá fazer: confirmar reprovações, contratações e encerramentos; gerir equipe e chaves; ver outras empresas. · [Permitir] [Cancelar].

## Telas públicas e do candidato (usam o logo da empresa; a cor de destaque da empresa vai no botão principal e nos links)
23. **Página de carreiras** (`/padaria-exemplo`): logo, nome, descrição curta, filtros por área e modelo de trabalho, lista de vagas em cartões ("Assistente administrativo · Financeiro · Campinas, SP · Presencial · CLT"). Rodapé "Página de carreiras feita com o Contrata".
24. **Vaga**: uma coluna (máx. 720 px): título, área, local, regime, salário quando mostrado, descrição, requisitos, botão grande "Candidatar-me" (fixo no rodapé no celular). Variação: "Esta vaga não recebe mais candidaturas. [Ver outras vagas da Padaria Exemplo]".
25. **Candidatar-me**: uma tela, máx. 560 px. "Candidatar-me a Assistente administrativo" · "Leva poucos minutos. Você não precisa criar conta." · Nome completo · E-mail · Telefone (opcional) · LinkedIn (opcional) · Currículo (PDF ou Word, até 5 MB) com área de soltar arquivo e botão no celular · perguntas da vaga · caixa obrigatória "Li o aviso de privacidade e concordo que a Padaria Exemplo use meus dados para este processo seletivo. (ler o aviso)" · caixa opcional desmarcada "Quero que a Padaria Exemplo guarde meus dados por 12 meses para me avisar de outras vagas." · [Enviar candidatura]. Estados: erro por campo ("O currículo precisa ser PDF ou Word, com até 5 MB."), enviando com barra de progresso, upload interrompido ("O envio não terminou. Tente de novo; seus dados continuam aqui.").
26. **Candidatura enviada**: "Candidatura enviada. Mandamos para mariana@email.com um link para você acompanhar o processo. Guarde esse e-mail." Variação duplicada: "Você já se candidatou a esta vaga. Enviamos o link de acompanhamento de novo para o seu e-mail."
27. **Acompanhamento** (`/c/…`): "Sua candidatura para Assistente administrativo" · logo da empresa · situação em texto grande ("Em análise") com a explicação ("A Padaria Exemplo recebeu sua candidatura e está analisando. Você vai receber um e-mail quando houver novidade.") · linha do tempo de três pontos (Recebida → Em andamento → Encerrada/Aprovada), sem etapas internas · mensagens recebidas · cartão do banco de talentos ("Você está no banco de talentos da Padaria Exemplo até 20/11/2027. [Renovar] [Sair do banco de talentos]") · ações discretas: Retirar candidatura · Baixar meus dados · Excluir meus dados. Variação "Encerrada": a devolutiva da empresa em destaque e "Pedir revisão" ("Se você acha que a decisão merece uma segunda análise, peça uma revisão. Uma pessoa da Padaria Exemplo vai olhar sua candidatura de novo e responder por e-mail."). Diálogo de exclusão com código de 6 dígitos.
28. **Perdi o link**: "Informe o e-mail que você usou. Se houver candidaturas na Padaria Exemplo, mandamos os links."
29. **E-mails** (fundo branco, logo da empresa, botão em pílula na cor da empresa): "Recebemos sua candidatura para Assistente administrativo"; devolutiva com o rodapé de revisão; convite de membro; resumo semanal ao dono de vaga sem acesso ("Como está a vaga Assistente administrativo que você pediu: 12 em análise, 3 em entrevistas, 1 em fase final, 4 encerradas nesta semana. Quem conduz: Ana. [Pedir acesso]").
30. **Página inicial** (`/`): o que é, para quem, o que não faz (admissão, testes, triagem automática), faixa discreta "Instância de demonstração de um projeto de código aberto", botões "Pedir convite" e "Ver no GitHub", e "Conectar no Claude".
31. **Pedir convite** (`/pedir-convite`): "Pedir convite. Esta é uma instância de demonstração do Contrata, um projeto de código aberto. Para criar uma empresa aqui, peça um convite. Para usar de verdade, você pode hospedar o seu (ver no GitHub)." · Seu nome · E-mail da conta Google que você vai usar · Nome da empresa · Para que você quer usar? (opcional) · [Pedir convite]. Depois: "Pedido enviado. Você vai receber a resposta em ana@empresa.com.br."
32. **Convites (admin da instância)** (`/admin/convites`): fora do menu das empresas, com cabeçalho simples "Convites". Abas Pendentes · Aprovados · Recusados. Cartões: nome, e-mail, empresa, uso, "há 2 h", botões azul "Aprovar" e cinza "Recusar". Vazio: "Nenhum pedido pendente."
33. **Sem convite aprovado**: na tela Empresas, no lugar de "+ Criar empresa": "Para criar uma empresa aqui, você precisa de um convite aprovado para ana@gmail.com. [Pedir convite]".

## Regras de desenho
- Nunca use as palavras: algoritmo, pontuação, score, ranking, match, fit cultural, eliminado, eliminatória.
- Candidato nunca vê o nome das etapas internas, notas, avaliações nem o motivo interno de reprovação.
- Tudo que veio de agente de IA aparece com o selo roxo; tudo que veio de integração, com "Integração · {nome}".
- Ações que afetam o candidato (Reprovar, Encerrar, Confirmar) sempre mostram o texto que ele vai receber antes do botão.
- Modo escuro e 375 px em todas as telas.
```
