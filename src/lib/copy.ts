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
