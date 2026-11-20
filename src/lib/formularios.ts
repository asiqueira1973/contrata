// Contrato entre o servidor MCP e o formulário genérico do chat (princípio 6, seções 10.2, 12.5 e
// 13.3). O servidor descreve campos, valores e de onde vêm as opções; um único HTML (ui/formulario)
// desenha qualquer formulário, carrega as opções pela ferramenta do app e chama salvar_<acao>.
// Sem zod e sem "server-only": o formulário (navegador) importa este arquivo.

export type Valor = string | boolean | string[];
export type Valores = Record<string, Valor>;

// Uma opção de lista. `preencher`: ao escolher, estes campos recebem estes valores (ex.: editar
// uma área preenche o nome e o responsável atuais).
export type Opcao = { valor: string; rotulo: string; dica?: string; preencher?: Valores };

// Campo visível só quando todas as condições batem (ex.: áreas só para recrutador limitado).
export type Condicao = { campo: string; igual: Valor | Valor[] };

type Base = { nome: string; rotulo: string; dica?: string; obrigatorio?: boolean; mostrarSe?: Condicao[] };
export type Campo =
  | (Base & { tipo: "texto" | "email" | "textarea"; max?: number })
  | (Base & { tipo: "select"; opcoes: string | Opcao[]; vazio?: string })
  | (Base & { tipo: "radio"; opcoes: Opcao[] })
  | (Base & { tipo: "marcar" })
  | (Base & { tipo: "multipla"; opcoes: string | Opcao[] })
  | (Base & { tipo: "confirmar"; frase: string });

// O que abrir_formulario_* devolve em structuredContent: o formulário pronto para desenhar.
export type Formulario = {
  formulario_id: string;
  acao: string;
  titulo: string;
  campos: Campo[];
  valores: Valores;
  botao: string;
  // Ferramenta do app que traz as listas de opções nomeadas (campos com `opcoes: "<chave>"`).
  ferramentaOpcoes?: string;
  avisos?: string[];
};

export type ErroDeCampo = { campo: string | null; mensagem: string };

// Resposta de todo salvar_* (12.5). `segredo` só aparece no formulário (ex.: chave de API
// criada, mostrada uma vez); nunca vai no texto devolvido ao modelo.
export type RespostaSalvar =
  | { ok: true; ids: string[]; resumo: string; segredo?: { rotulo: string; valor: string; aviso: string } }
  | { ok: false; erros: ErroDeCampo[] };

// Diz se um campo aparece com os valores atuais. Recebe: campo e valores.
export function campoVisivel(campo: Campo, valores: Valores): boolean {
  return (campo.mostrarSe ?? []).every((c) => {
    const atual = valores[c.campo];
    const aceitos = Array.isArray(c.igual) && !Array.isArray(atual) ? c.igual : [c.igual];
    return aceitos.some((v) => JSON.stringify(v) === JSON.stringify(atual));
  });
}

// Só os valores dos campos visíveis seguem para o salvar (o que está escondido não conta).
export function valoresVisiveis(campos: Campo[], valores: Valores): Valores {
  return Object.fromEntries(campos.filter((c) => campoVisivel(c, valores) && c.nome in valores).map((c) => [c.nome, valores[c.nome]]));
}
