// Estado puro do formulário genérico (máquina 12.5), testável sem navegador:
// carregando → pronto ⇄ salvando → sucesso | (erro → pronto); cancelado. Sucesso e cancelado
// travam: não há segundo Salvar (evita gravar em duplicidade).
import { campoVisivel, type Campo, type ErroDeCampo, type Formulario, type ItemLista, type Opcao, type RespostaSalvar, type Valores } from "@/lib/formularios";

export type Fase = "carregando" | "erro_opcoes" | "pronto" | "salvando" | "sucesso" | "cancelado";
export type Estado = {
  fase: Fase;
  form: Formulario | null;
  valores: Valores;
  opcoes: Record<string, Opcao[]>;
  erros: Record<string, string>;
  erroGeral: string | null;
  resposta: (RespostaSalvar & { ok: true }) | null;
};

export const inicial = (): Estado => ({ fase: "carregando", form: null, valores: {}, opcoes: {}, erros: {}, erroGeral: null, resposta: null });

export type Evento =
  | { tipo: "formulario"; form: Formulario }
  | { tipo: "opcoes"; opcoes: Record<string, Opcao[]> }
  | { tipo: "opcoes_erro" }
  | { tipo: "valor"; nome: string; valor: Valores[string]; preencher?: Valores }
  | { tipo: "salvar_inicio"; erros: Record<string, string> }
  | { tipo: "salvar_fim"; resposta: RespostaSalvar }
  | { tipo: "cancelar" }
  | { tipo: "lembranca"; fase: "sucesso" | "cancelado"; resposta?: RespostaSalvar & { ok: true } };

export function reduzir(s: Estado, e: Evento): Estado {
  if (s.fase === "sucesso" || s.fase === "cancelado") return s;
  switch (e.tipo) {
    case "formulario":
      return { ...s, form: e.form, valores: { ...e.form.valores }, fase: e.form.ferramentaOpcoes ? "carregando" : "pronto" };
    case "opcoes":
      return { ...s, opcoes: e.opcoes, fase: s.form ? "pronto" : s.fase };
    case "opcoes_erro":
      return { ...s, fase: "erro_opcoes" };
    case "valor": {
      if (s.fase !== "pronto") return s;
      // Mexer num campo (ou num item de lista) apaga os erros dele e dos itens dele.
      const erros = Object.fromEntries(Object.entries(s.erros).filter(([k]) => k !== e.nome && !k.startsWith(`${e.nome}.`)));
      return { ...s, valores: { ...s.valores, ...(e.preencher ?? {}), [e.nome]: e.valor }, erros, erroGeral: null };
    }
    case "salvar_inicio":
      if (s.fase !== "pronto") return s;
      return Object.keys(e.erros).length ? { ...s, erros: e.erros } : { ...s, fase: "salvando", erros: {}, erroGeral: null };
    case "salvar_fim":
      if (s.fase !== "salvando") return s;
      if (e.resposta.ok) return { ...s, fase: "sucesso", resposta: e.resposta };
      return { ...s, fase: "pronto", ...espalharErros(e.resposta.erros) };
    case "cancelar":
      return s.fase === "salvando" ? s : { ...s, fase: "cancelado" };
    case "lembranca":
      return { ...s, fase: e.fase, resposta: e.resposta ?? null };
  }
}

// Erros do servidor: os de campo vão para baixo do campo; o resto vira a mensagem geral.
function espalharErros(lista: ErroDeCampo[]): Pick<Estado, "erros" | "erroGeral"> {
  const erros: Record<string, string> = {};
  const gerais: string[] = [];
  for (const e of lista) {
    if (e.campo) erros[e.campo] = e.mensagem;
    else gerais.push(e.mensagem);
  }
  return { erros, erroGeral: gerais.join(" ") || null };
}

const vazio = (v: unknown) => v === undefined || v === "" || (Array.isArray(v) && v.length === 0) || v === false;

// Validação local (conveniência; o servidor revalida tudo, princípio 6): obrigatórios visíveis,
// inclusive os subcampos obrigatórios de cada item de lista ("etapas.1.nome").
export function errosLocais(campos: Campo[], valores: Valores, mensagem: string): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const c of campos) {
    if (!campoVisivel(c, valores)) continue;
    const v = valores[c.nome];
    if (c.tipo === "lista") {
      if (c.somenteLeitura) continue;
      const itens = Array.isArray(v) ? (v as ItemLista[]) : [];
      if ((c.obrigatorio || (c.min ?? 0) > 0) && itens.length < Math.max(1, c.min ?? 0)) erros[c.nome] = mensagem;
      itens.forEach((item, i) => {
        for (const sc of c.subcampos) {
          if (sc.obrigatorio && campoVisivel(sc, item) && vazio(item[sc.nome])) erros[`${c.nome}.${i}.${sc.nome}`] = mensagem;
        }
      });
      continue;
    }
    if (c.obrigatorio && vazio(v)) erros[c.nome] = mensagem;
  }
  return erros;
}
