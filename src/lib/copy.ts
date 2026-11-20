// Copy do Contrata — seção 15 (texto final, não placeholder) e seção 18 (copy só aqui, inclusive
// e-mails e, nos próximos épicos, as descrições das ferramentas MCP e do OpenAPI).
// Os textos marcados "15.x" são literais do spec; os demais são rótulos de interface no mesmo tom:
// direto, respeitoso, sem jargão de RH.
import { CONVITE_DIAS, CONVITES_PENDENTES_MAX } from "./limits";
import type { Papel } from "./limits";

// Nome exibido (pergunta 25.1): troca-se por variável, sem mexer no código.
export const NOME_PRODUTO = process.env.NEXT_PUBLIC_NOME_PRODUTO || "Contrata";

// Rótulo e explicação de cada papel (15.2, "Equipe — convidar").
export const PAPEL: Record<Papel, { rotulo: string; explicacao: string }> = {
  administrador: { rotulo: "Administrador", explicacao: "tudo, inclusive equipe e integrações" },
  recrutador: { rotulo: "Recrutador", explicacao: "conduz vagas" },
  avaliador: { rotulo: "Avaliador", explicacao: "avalia nas vagas em que estiver" },
};

// Mensagem de cada código de erro que as rotas devolvem ({codigo, mensagem}, 13.2). Nenhuma
// carrega dado pessoal. Código desconhecido cai em "generico".
export const ERROS: Record<string, string> = {
  generico: "Não foi possível concluir. Tente de novo.",
  origem_invalida: "Não foi possível concluir. Recarregue a página e tente de novo.",
  nao_autenticado: "Sua sessão terminou. Entre de novo.",
  sem_permissao: "Você não tem permissão para isso.",
  nao_encontrado: "Não encontrado.",
  dados_invalidos: "Confira os campos destacados.",
  // 15.2
  slug_em_uso: "Esse endereço já está em uso. Tente outro.",
  slug_invalido: "Use de 3 a 40 letras minúsculas, números e hífens.",
  sem_permissao_criar_empresa:
    "Esta instância só permite criar empresas para os e-mails definidos por quem a hospeda. Para entrar numa empresa que já existe, peça um convite ao administrador dela.",
  ultimo_administrador: "A empresa precisa de pelo menos um administrador. Promova outra pessoa antes.",
  area_em_uso: "Esta área tem vagas abertas ou é a única área de algum recrutador. Mude isso antes de arquivar.",
  convite_vencido: "Este convite venceu. Peça um novo a quem convidou você.",
  convite_invalido: "Este convite venceu. Peça um novo a quem convidou você.",
  email_em_uso: "O e-mail desta conta Google já está ligado a outro acesso. Fale com o administrador da sua empresa.",
  // Rótulos de interface
  membro_ja_existe: "Esse e-mail já está na equipe ou tem um convite pendente.",
  limite_convites: `A empresa já tem ${CONVITES_PENDENTES_MAX} convites pendentes. Cancele algum antes de convidar.`,
  recrutador_sem_area: "Escolha pelo menos uma área para o recrutador.",
  area_invalida: "Essa área não existe mais. Recarregue a página.",
  area_nome_em_uso: "Já existe uma área com esse nome.",
  pessoa_invalida: "Essa pessoa não existe mais. Recarregue a página.",
  pessoa_email_em_uso: "Já existe uma pessoa com esse e-mail.",
  pessoa_com_acesso: "Esta pessoa tem acesso ao sistema. Remova o acesso na Equipe antes.",
  pessoa_com_acesso_email: "O e-mail de quem tem acesso não muda aqui: ele é o login da pessoa.",
  pessoa_dona_de_vaga: "Esta pessoa é dona de vagas abertas. Troque o dono das vagas antes de arquivar.",
  membro_invalido: "Esse membro não existe mais. Recarregue a página.",
  convite_outro_email: "Este convite é para outro e-mail.",
  // 6.3: credenciais de máquina e escopos
  credencial_invalida: "Credencial inválida ou revogada.",
  campo_invalido: "Confira este campo.",
  precisa_de_membro: "Esta ação precisa de uma pessoa da equipe: conecte o conector pelo login com Google, não por chave de API.",
  previa_divergente: "Os dados mudaram desde a prévia. Mostre a nova prévia à pessoa.",
  previa_invalida: "A prévia venceu ou não é válida. Gere uma nova prévia e mostre à pessoa.",
  escopo_insuficiente: "Esta conexão não tem permissão para isso. Conecte de novo marcando o escopo necessário.",
  papel_insuficiente: "Seu papel na empresa não permite isso.",
  limite_chaves: "A empresa já tem 10 chaves de API ativas. Revogue alguma antes de criar outra.",
  termos_pendentes: "Aceite os Termos de uso e a Política de privacidade para continuar.",
};

export const copy = {
  appName: NOME_PRODUTO,
  carregando: "Carregando…",
  salvar: "Salvar",
  cancelar: "Cancelar",
  fechar: "Fechar",
  emConstrucao: "Esta parte ainda está sendo construída.",

  nav: {
    grupos: { recrutamento: "Recrutamento", pessoas: "Pessoas", configurar: "Configurar" },
    inicio: "Início",
    vagas: "Vagas",
    confirmar: "Para confirmar",
    talentos: "Banco de talentos",
    equipe: "Equipe",
    areas: "Áreas",
    pessoas: "Pessoas",
    pagina: "Página de carreiras",
    mensagens: "Mensagens",
    integracoes: "Integrações",
    empresa: "Empresa",
    conta: "Minha conta",
    sair: "Sair",
    trocarEmpresa: "Trocar de empresa",
    abrirMenu: "Abrir menu",
    fecharMenu: "Fechar menu",
  },

  // 15.2 "Entrar"
  login: {
    botao: "Entrar com Google",
    erros: {
      falha: "Não foi possível entrar. Tente de novo.",
      sem_acesso: "Esta conta não tem acesso a esta instância.",
      suspenso: "Esta conta está suspensa. Fale com quem hospeda esta instância.",
      email_em_uso: ERROS.email_em_uso,
    },
  },

  // 15.2 "Boas-vindas"
  boasVindas: {
    titulo: `Bem-vindo ao ${NOME_PRODUTO}.`,
    aceite: "Para continuar, leia e aceite os Termos de uso e a Política de privacidade.",
    termos: "Termos de uso",
    privacidade: "Política de privacidade",
    botao: "Aceitar e continuar",
  },

  empresas: {
    titulo: "Empresas",
    criar: "Criar empresa",
    nenhuma: "Você ainda não participa de nenhuma empresa.",
    papel: (p: Papel) => PAPEL[p].rotulo,
  },

  // 15.2 "Criar empresa"
  novaEmpresa: {
    titulo: "Criar empresa",
    enderecoLivre: "Endereço disponível.",
    nome: "Nome da empresa",
    endereco: "Endereço da página de carreiras",
    email: "E-mail que recebe as respostas dos candidatos",
    botao: "Criar empresa",
  },

  // 15.2 "Convite", "Convite — outra conta", "Convite vencido"; 6.1
  convite: {
    titulo: "Convite",
    texto: (nome: string, empresa: string, papel: Papel) =>
      `${nome} convidou você para a equipe de recrutamento da ${empresa} como ${PAPEL[papel].rotulo}.`,
    aceitar: "Aceitar convite",
    entrarParaAceitar: "Entrar com Google para aceitar",
    outraConta: (email: string, outro: string) => `Este convite é para ${email}. Você entrou como ${outro}.`,
    entrarComOutra: "Entrar com outra conta",
    vencido: ERROS.convite_vencido,
  },

  inicio: { titulo: "Início" },

  // 15.2 "Equipe — convidar", "Último administrador"
  equipe: {
    titulo: "Equipe",
    convidar: "Convidar",
    email: "E-mail",
    papel: "Papel",
    areas: "Áreas",
    todasAreas: "Todas",
    escolherAreas: "Escolher áreas",
    enviarConvite: "Enviar convite",
    pendente: (data: string) => `Convite pendente · vence em ${data}`,
    vencido: "Convite vencido",
    ultimoAcesso: (data: string) => `Último acesso ${data}`,
    nuncaEntrou: "Ainda não entrou",
    todasAsAreas: "Todas as áreas",
    reenviar: "Reenviar convite",
    cancelarConvite: "Cancelar convite",
    mudarAcesso: "Mudar acesso",
    remover: "Remover",
    confirmarRemocao: (nome: string) =>
      `Remover ${nome}? A pessoa perde o acesso na hora e continua no cadastro de pessoas.`,
    voce: "você",
    conviteEnviado: "Convite enviado.",
    conviteReenviado: "Convite reenviado.",
  },

  // 15.2 "Áreas — vazio", "Arquivar área recusado"
  areas: {
    titulo: "Áreas",
    vazio: "Nenhuma área ainda. Áreas organizam as vagas e permitem limitar o que cada recrutador vê.",
    nova: "Nova área",
    nome: "Nome",
    responsavel: "Responsável",
    semResponsavel: "Sem responsável",
    editar: "Editar",
    arquivar: "Arquivar",
    confirmarArquivar: (nome: string) => `Arquivar a área ${nome}? Vagas antigas continuam com ela.`,
    resumo: (responsavel: string, vagas: number, recrutadores: number) =>
      `${responsavel} · ${vagas} ${vagas === 1 ? "vaga aberta" : "vagas abertas"} · ${recrutadores} ${recrutadores === 1 ? "recrutador limitado" : "recrutadores limitados"}`,
  },

  // 15.2 "Pessoas — explicação", "Pessoa sem acesso"; critério 8.1 do selo
  pessoas: {
    titulo: "Pessoas",
    explicacao:
      "Gestores, donos de vaga e entrevistadores. Quem não tem acesso não entra no sistema; se for dono de vaga, recebe um resumo semanal só com números.",
    nova: "Cadastrar pessoa",
    vazio: "Nenhuma pessoa cadastrada ainda.",
    nome: "Nome",
    email: "E-mail",
    cargo: "Cargo (opcional)",
    area: "Área",
    semArea: "Sem área",
    recebeResumo: "Recebe o resumo semanal das vagas de que é dona",
    comAcesso: (papel: Papel) => `Com acesso · ${PAPEL[papel].rotulo}`,
    semAcesso: "Sem acesso",
    conviteEnviado: "Convite enviado",
    darAcesso: "Dar acesso",
    editar: "Editar",
    arquivar: "Arquivar",
    confirmarArquivar: (nome: string) => `Arquivar ${nome}? A pessoa sai das listas, e as vagas antigas continuam com ela.`,
  },

  conta: {
    titulo: "Minha conta",
    sair: "Sair",
  },

  // 6.4 e 15.2 "Consentimento do conector": a porta de entrada do produto.
  oauth: {
    titulo: (cliente: string) => `${cliente} quer acessar o ${NOME_PRODUTO}.`,
    empresa: "Empresa",
    escopos: "O que ele poderá fazer",
    escopo: {
      leitura: "Ler vagas e candidaturas",
      escrita: "Criar e mover",
      decisao: "Propor e confirmar decisões",
    } as Record<"leitura" | "escrita" | "decisao", string>,
    garantia: "Decisões sobre candidatos só acontecem quando você clicar em Confirmar no formulário. O agente não vê outras empresas.",
    permitir: "Permitir",
    cancelar: "Cancelar",
    como: (email: string) => `Você está conectando como ${email}.`,
    voltaPara: (host: string) => `Depois, você volta para ${host}.`,
    invalidoTitulo: "Este pedido de conexão não é válido.",
    invalidoTexto: "Volte ao aplicativo e tente conectar de novo.",
    semEmpresa: "Você ainda não participa de nenhuma empresa.",
    criarEmpresa: "Criar empresa",
  },

  // Erros do OAuth (error_description), para quem integra.
  oauthErros: {
    registroCorpo: "Informe de 1 a 5 redirect_uris e, opcionalmente, client_name.",
    registroUri: "Cada redirect_uri precisa ser https, ou http em localhost ou 127.0.0.1.",
    grantType: "Só authorization_code.",
    faltando: "Faltam code, code_verifier (43 a 128 caracteres), client_id ou redirect_uri.",
    cliente: "Cliente desconhecido.",
    grant: "Código inválido, usado, vencido, de outro cliente ou com PKCE que não confere.",
    servidor: "Não consegui concluir a autorização. Tente de novo.",
  },

  // Servidor MCP (seção 13.3): títulos, descrições escritas para o modelo e textos dos formulários.
  // Nenhuma descrição promete triagem automática (15.3, guard-copy).
  mcp: {
    titulos: {
      quem_sou_eu: "Quem sou eu",
      listar_equipe: "Equipe da empresa",
      listar_areas: "Áreas da empresa",
      listar_pessoas: "Pessoas da empresa",
    } as Record<string, string>,
    descricoes: {
      quem_sou_eu: `Diz em qual empresa este conector está, quem é o membro, o papel dele e o que ele pode fazer no ${NOME_PRODUTO}. Use no começo da conversa.`,
      listar_equipe: "Lista os membros da empresa e os convites pendentes, com papel e áreas. Avaliadores veem só nome e área.",
      listar_areas: "Lista as áreas (departamentos) ativas da empresa, com responsável, vagas abertas e recrutadores limitados a cada uma. Use para escolher a área de uma vaga.",
      listar_pessoas: "Lista as pessoas da empresa (gestores, donos de vaga, entrevistadores), com cargo, área e se têm acesso. Use para escolher o dono de uma vaga.",
    } as Record<string, string>,
    // Texto devolvido ao modelo quando um formulário abre: nada foi gravado.
    formularioAberto: (titulo: string) =>
      `Formulário "${titulo}" aberto na conversa, já preenchido. Nada foi gravado: só grava quando a pessoa conferir e clicar no botão do formulário. Não diga que foi feito antes disso.`,
    previaPronta: "Prévia pronta. Nada foi gravado. Mostre os dados à pessoa e, só se ela concordar, chame de novo com confirmar=true e o token_previa.",
    nadaGravado: "Nada foi gravado. Corrija os campos indicados.",
    descricaoFallback: (titulo: string) =>
      `${titulo}, sem formulário (para clientes que não mostram formulários). Primeira chamada: devolve a prévia e um token_previa; nada é gravado. Nunca envie confirmar=true sem mostrar a prévia à pessoa e ela concordar.`,
    descricaoSalvar: (titulo: string) => `Grava o formulário "${titulo}" conferido pela pessoa. Chamada só pelo formulário.`,
    descricaoOpcoes: (titulo: string) => `Opções do formulário "${titulo}". Chamada só pelo formulário.`,
    tituloSalvar: (titulo: string) => `Salvar: ${titulo}`,
    tituloFallback: (titulo: string) => `${titulo} sem formulário`,
    tituloOpcoes: (titulo: string) => `Opções: ${titulo}`,
    // Formulário genérico (ui/formulario)
    ui: {
      cancelar: "Cancelar",
      cancelado: "Formulário fechado. Nada foi gravado.",
      salvando: "Salvando…",
      salvo: "Salvo.",
      erroOpcoes: "Não foi possível carregar as opções.",
      tentarDeNovo: "Tentar de novo",
      inesperado: "Não foi possível salvar agora. Tente de novo.",
      obrigatorio: "Preencha este campo.",
      escolha: "Escolha…",
      canceladoModelo: (titulo: string) => `A pessoa fechou o formulário "${titulo}" sem salvar. Nada foi gravado.`,
      salvoModelo: (resumo: string) => `Salvo pela pessoa no formulário: ${resumo}`,
    },
    // Formulários do 8.2 (seção 10.2).
    form: {
      convite: {
        titulo: "Convidar para a equipe",
        descricao: "Abre o formulário para convidar uma pessoa para a equipe de recrutamento (e-mail, papel e, para recrutador, as áreas). Não grava nada: o administrador confere e clica em Enviar convite. O convite chega por e-mail e só é aceito com a conta Google do mesmo e-mail.",
        botao: "Enviar convite",
        email: "E-mail",
        papel: "Papel",
        areas: "Áreas",
        todasAreas: "Todas as áreas",
        escolherAreas: "Escolher áreas",
        resumo: (email: string) => `Convite enviado para ${email}.`,
      },
      acesso: {
        titulo: "Acesso de um membro",
        descricao: "Abre o formulário para mudar o papel e as áreas de um membro, removê-lo da empresa, ou reenviar ou cancelar um convite pendente. Não grava nada: o administrador confere e confirma. Remover ou mudar o papel desconecta os conectores dessa pessoa.",
        botao: "Confirmar",
        membro: "Membro",
        operacao: "O que fazer",
        mudar: "Mudar papel e áreas",
        remover: "Remover da empresa",
        reenviar: "Reenviar convite",
        cancelar: "Cancelar convite",
        aviso: "Remover tira o acesso na hora; a pessoa continua no cadastro de pessoas.",
        resumo: {
          mudar: "Acesso alterado.",
          remover: "Membro removido.",
          reenviar: "Convite reenviado.",
          cancelar: "Convite cancelado.",
        } as Record<string, string>,
        pendente: "convite pendente",
      },
      area: {
        titulo: "Áreas",
        descricao: "Abre o formulário para criar, renomear (e trocar o responsável) ou arquivar uma área da empresa. Não grava nada: o administrador confere e confirma.",
        botao: "Salvar",
        operacao: "O que fazer",
        criar: "Criar área",
        editar: "Editar área",
        arquivar: "Arquivar área",
        area: "Área",
        nome: "Nome",
        responsavel: "Responsável",
        semResponsavel: "Sem responsável",
        resumo: {
          criar: (nome: string) => `Área ${nome} criada.`,
          editar: (nome: string) => `Área ${nome} salva.`,
          arquivar: () => "Área arquivada.",
        } as Record<string, (nome: string) => string>,
      },
      pessoa: {
        titulo: "Pessoas da empresa",
        descricao: "Abre o formulário para cadastrar ou editar uma pessoa da empresa (gestor, dono de vaga, entrevistador), arquivá-la ou dar acesso a ela (vira convite). Não grava nada: a pessoa da equipe confere e confirma.",
        botao: "Salvar",
        operacao: "O que fazer",
        cadastrar: "Cadastrar pessoa",
        editar: "Editar pessoa",
        arquivar: "Arquivar pessoa",
        darAcesso: "Dar acesso (enviar convite)",
        pessoa: "Pessoa",
        nome: "Nome",
        email: "E-mail",
        cargo: "Cargo (opcional)",
        area: "Área",
        semArea: "Sem área",
        recebeResumo: "Recebe o resumo semanal das vagas de que é dona",
        resumo: {
          cadastrar: (nome: string) => `${nome} cadastrada.`,
          editar: (nome: string) => `${nome} salva.`,
          arquivar: () => "Pessoa arquivada.",
          dar_acesso: () => "Convite enviado.",
        } as Record<string, (nome: string) => string>,
      },
      conexoes: {
        titulo: "Conexões e chaves de API",
        descricao: "Abre o formulário para revogar uma conexão do conector (as suas; o administrador vê todas) ou criar e revogar chaves de API da empresa (só administrador). Não grava nada: a pessoa confere e confirma. A chave criada aparece só no formulário, uma única vez.",
        botao: "Confirmar",
        operacao: "O que fazer",
        revogar: "Revogar conexão ou chave",
        criarChave: "Criar chave de API",
        credencial: "Conexão ou chave",
        nome: "Nome da chave (ex.: n8n, site da empresa)",
        escopos: "Escopos",
        chaveRotulo: "Chave de API",
        chaveAviso: "Copie a chave agora. Por segurança, ela não aparece de novo.",
        resumoCriada: (nome: string) => `Chave de API "${nome}" criada.`,
        resumoRevogada: "Revogada.",
        conexao: (cliente: string, membro: string) => `Conector ${cliente} · ${membro}`,
        chave: (nome: string, prefixo: string) => `Chave ${nome} (${prefixo}…)`,
      },
    },
  },

  // Página inicial provisória (até o 8.12) e convite aceito (6.1, 15.2).
  inicioPublico: {
    titulo: `${NOME_PRODUTO}: recrutamento e seleção para agentes`,
    texto: "Quem recruta usa o Contrata pelo Claude ou pelo ChatGPT. Para conectar, adicione um conector personalizado com este endereço:",
  },
  conviteAceito: {
    titulo: "Convite aceito",
    texto: (empresas: string) => `Pronto, você está na equipe da ${empresas}. Agora conecte o ${NOME_PRODUTO} no Claude ou no ChatGPT com este endereço:`,
    passos: "No Claude: Configurações › Conectores › Adicionar conector personalizado. No ChatGPT: Configurações › Aplicativos e conectores › Criar (modo desenvolvedor).",
  },

  // 15.4 convite_membro
  emailConviteMembro: {
    assunto: (empresa: string) => `Convite para a equipe da ${empresa}`,
    corpo: (nome: string, papel: Papel, email: string) =>
      `${nome} convidou você como ${PAPEL[papel].rotulo}. Para aceitar, entre com a conta Google de ${email}.`,
    botao: "Aceitar convite",
    validade: `O convite vale por ${CONVITE_DIAS} dias.`,
  },
} as const;

export type LoginErrorCode = keyof typeof copy.login.erros;

// Diz se um valor da URL é um código de erro de login conhecido.
export function isLoginErrorCode(v: unknown): v is LoginErrorCode {
  return typeof v === "string" && v in copy.login.erros;
}

// Mensagem de um código de erro de rota, com o genérico como reserva.
export function mensagemDeErro(codigo: string | undefined): string {
  return (codigo && ERROS[codigo]) || ERROS.generico;
}
