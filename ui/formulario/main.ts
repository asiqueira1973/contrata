// Formulário genérico do chat (princípio 6; seções 10.2, 12.5, 13.3 e 16). Desenha o formulário
// que abrir_formulario_* descreveu, carrega as opções pela ferramenta do app, mostra e esconde
// campos pelas condições, valida o básico e chama salvar_<acao>. Quem grava é o clique da pessoa.
// Sem rede própria: tudo passa por callServerTool (CSP connect-src 'none').
import type { App } from "@modelcontextprotocol/ext-apps";
import { copy } from "@/lib/copy";
import { campoVisivel, valoresVisiveis, type Campo, type Formulario, type ItemLista, type Opcao, type RespostaSalvar, type SubCampo, type Valor } from "@/lib/formularios";
import { $, criarFormulario, el } from "../shared/app";
import { lembrar, lerLembranca, storageDaPagina } from "../shared/memoria";
import { errosLocais, inicial, reduzir, type Estado, type Evento } from "./state";

const t = copy.mcp.ui;
const storage = storageDaPagina();
let estado: Estado = inicial();
// O App é criado no fim do arquivo; os handlers só rodam depois do connect.
const ref: { app?: App } = {};
const obterApp = () => ref.app;
// Campos já montados no DOM (montados uma vez; depois só se atualiza o que muda, sem perder o foco).
// `atualizar`: campos com partes internas (lista) atualizam visibilidade, erros e travas sozinhos.
const montados = new Map<string, { bloco: HTMLElement; erro: HTMLElement; preencher: (v: Valor | undefined) => void; opcoes?: (lista: Opcao[]) => void; atualizar?: (travado: boolean) => void }>();

function despachar(e: Evento): void {
  estado = reduzir(estado, e);
  desenhar();
}

// Opções de um campo: lista fixa ou nomeada (vinda de opcoes_<acao>).
function opcoesDe(c: Campo): Opcao[] {
  if (!("opcoes" in c)) return [];
  return typeof c.opcoes === "string" ? estado.opcoes[c.opcoes] ?? [] : c.opcoes;
}

// Ao escolher uma opção com `preencher`, os campos ligados recebem os valores dela.
function aoEscolher(c: Campo, valor: string): void {
  const opcao = opcoesDe(c).find((o) => o.valor === valor);
  despachar({ tipo: "valor", nome: c.nome, valor, preencher: opcao?.preencher });
  if (opcao?.preencher) for (const [nome, v] of Object.entries(opcao.preencher)) montados.get(nome)?.preencher(v);
}

// Monta um campo uma vez. Devolve os ganchos para atualizar valor e opções.
function montarCampo(c: Campo): void {
  const id = `campo-${c.nome}`;
  const erro = el("p", { id: `erro-${c.nome}`, className: "erro", hidden: true });
  const bloco = el("div", { className: "campo", "data-campo": c.nome });
  const dica = c.dica ? el("p", { className: "rodape" }, c.dica) : null;
  let preencher: (v: Valor | undefined) => void = () => undefined;
  let opcoes: ((lista: Opcao[]) => void) | undefined;

  if (c.tipo === "texto" || c.tipo === "email" || c.tipo === "textarea") {
    const input = c.tipo === "textarea" ? el("textarea", { id, rows: 4 }) : el("input", { id, type: c.tipo === "email" ? "email" : "text", autocomplete: "off" });
    if (c.max) input.maxLength = c.max;
    input.setAttribute("aria-describedby", erro.id);
    input.addEventListener("input", () => despachar({ tipo: "valor", nome: c.nome, valor: input.value }));
    preencher = (v) => (input.value = typeof v === "string" ? v : "");
    bloco.append(el("label", { for: id }, c.rotulo), input);
  } else if (c.tipo === "select") {
    const select = el("select", { id, "aria-describedby": erro.id });
    select.addEventListener("change", () => aoEscolher(c, select.value));
    opcoes = (lista) => {
      const atual = estado.valores[c.nome];
      select.replaceChildren(new Option(c.vazio ?? t.escolha, ""), ...lista.map((o) => new Option(o.rotulo, o.valor)));
      select.value = typeof atual === "string" ? atual : "";
    };
    preencher = (v) => (select.value = typeof v === "string" ? v : "");
    bloco.append(el("label", { for: id }, c.rotulo), select);
  } else if (c.tipo === "radio" || c.tipo === "multipla") {
    const grupo = el("fieldset", { className: "registros", "aria-describedby": erro.id }, el("legend", {}, c.rotulo));
    const lista = el("div");
    grupo.append(lista);
    opcoes = (itens) => {
      const atual = estado.valores[c.nome];
      lista.replaceChildren(
        ...itens.map((o) => {
          const input = el("input", { type: c.tipo === "radio" ? "radio" : "checkbox", name: c.nome, value: o.valor });
          input.checked = Array.isArray(atual) ? (atual as string[]).includes(o.valor) : atual === o.valor;
          input.addEventListener("change", () => {
            if (c.tipo === "radio") return aoEscolher(c, o.valor);
            const marcados = [...lista.querySelectorAll<HTMLInputElement>("input:checked")].map((i) => i.value);
            despachar({ tipo: "valor", nome: c.nome, valor: marcados });
          });
          return el("label", {}, input, el("span", {}, o.rotulo, ...(o.dica ? [el("span", { className: "antes" }, ` (${o.dica})`)] : [])));
        }),
      );
    };
    preencher = () => opcoes?.(opcoesDe(c));
    bloco.append(grupo);
  } else if (c.tipo === "numero" || c.tipo === "data") {
    const input = el("input", { id, type: c.tipo === "data" ? "date" : "number", "aria-describedby": erro.id });
    if (c.tipo === "numero") {
      input.inputMode = "decimal";
      input.step = String(c.passo ?? "any");
      if (c.min !== undefined) input.min = String(c.min);
      if (c.max !== undefined) input.max = String(c.max);
    }
    input.addEventListener("input", () => despachar({ tipo: "valor", nome: c.nome, valor: input.value }));
    preencher = (v) => (input.value = typeof v === "string" ? v : "");
    bloco.append(el("label", { for: id }, c.rotulo), input);
  } else if (c.tipo === "lista") {
    const lista = montarLista(c, erro);
    preencher = lista.preencher;
    bloco.append(lista.grupo);
    montados.set(c.nome, { bloco, erro, preencher, atualizar: lista.atualizar });
  } else {
    // marcar (caixa única) e confirmar (frase a digitar fica para formulários de exclusão)
    const input = el("input", { id, type: "checkbox", "aria-describedby": erro.id });
    input.addEventListener("change", () => despachar({ tipo: "valor", nome: c.nome, valor: input.checked }));
    preencher = (v) => (input.checked = v === true);
    bloco.className = "campo marcar";
    bloco.append(input, el("label", { for: id }, c.rotulo));
  }
  if (dica) bloco.append(dica);
  bloco.append(erro);
  $<HTMLFormElement>("form").append(bloco);
  if (!montados.has(c.nome)) montados.set(c.nome, { bloco, erro, preencher, opcoes });
}

// Lista de itens que se repetem (etapas, perguntas). Digitar só atualiza o estado (o foco fica);
// adicionar, remover, subir e descer redesenham os itens. Erros de item: "<lista>.<i>.<subcampo>".
function montarLista(c: Extract<Campo, { tipo: "lista" }>, erro: HTMLElement) {
  const grupo = el("fieldset", { className: "lista", "aria-describedby": erro.id }, el("legend", {}, c.rotulo));
  const itensEl = el("div", { className: "itens" });
  const adicionar = el("button", { type: "button", className: "texto" }, c.adicionar);
  grupo.append(itensEl);
  if (c.somenteLeitura) grupo.append(el("p", { className: "rodape" }, t.somenteLeitura));
  else grupo.append(adicionar);
  let partes: { i: number; sc: SubCampo; bloco: HTMLElement; erro: HTMLElement }[] = [];
  const itens = () => (Array.isArray(estado.valores[c.nome]) ? (estado.valores[c.nome] as ItemLista[]) : []);
  const mudar = (novos: ItemLista[]) => despachar({ tipo: "valor", nome: c.nome, valor: novos });

  function desenharItens(): void {
    partes = [];
    const lista = itens();
    itensEl.replaceChildren(
      ...lista.map((item, i) => {
        const nomeItem = `${c.rotuloItem} ${i + 1}`;
        const cab = el("div", { className: "item-cab" }, el("strong", {}, nomeItem));
        if (!c.somenteLeitura) {
          const botao = (texto: string, rotulo: string, acao: () => ItemLista[]) => {
            const b = el("button", { type: "button", className: "texto mini", "aria-label": rotulo }, texto);
            b.addEventListener("click", () => {
              mudar(acao());
              desenharItens();
            });
            return b;
          };
          const troca = (a: number, b: number) => {
            const novos = [...itens()];
            [novos[a], novos[b]] = [novos[b], novos[a]];
            return novos;
          };
          if (i > 0) cab.append(botao("↑", t.subir(nomeItem), () => troca(i, i - 1)));
          if (i < lista.length - 1) cab.append(botao("↓", t.descer(nomeItem), () => troca(i, i + 1)));
          if (lista.length > (c.min ?? 0)) cab.append(botao("✕", t.remover(nomeItem), () => itens().filter((_, j) => j !== i)));
        }
        const card = el("div", { className: "item" }, cab);
        for (const sc of c.subcampos) card.append(montarSubcampo(c, sc, i, item));
        return card;
      }),
    );
    adicionar.hidden = c.max !== undefined && lista.length >= c.max;
    atualizar(estado.fase !== "pronto");
  }

  function montarSubcampo(lista: typeof c, sc: SubCampo, i: number, item: ItemLista): HTMLElement {
    const id = `campo-${lista.nome}-${i}-${sc.nome}`;
    const serro = el("p", { id: `erro-${lista.nome}-${i}-${sc.nome}`, className: "erro", hidden: true });
    const sbloco = el("div", { className: "campo" });
    const set = (v: string | boolean | string[]) => mudar(itens().map((it, j) => (j === i ? { ...it, [sc.nome]: v } : it)));
    const atual = item[sc.nome];
    if (sc.tipo === "marcar") {
      const input = el("input", { id, type: "checkbox", "aria-describedby": serro.id });
      input.checked = atual === true;
      input.addEventListener("change", () => set(input.checked));
      sbloco.className = "campo marcar";
      sbloco.append(input, el("label", { for: id }, sc.rotulo));
    } else if (sc.tipo === "select") {
      const select = el("select", { id, "aria-describedby": serro.id }, new Option(sc.vazio ?? t.escolha, ""), ...sc.opcoes.map((o) => new Option(o.rotulo, o.valor)));
      select.value = typeof atual === "string" ? atual : "";
      select.addEventListener("change", () => set(select.value));
      sbloco.append(el("label", { for: id }, sc.rotulo), select);
    } else {
      const input = sc.tipo === "linhas" ? el("textarea", { id, rows: 3 }) : el("input", { id, type: "text", autocomplete: "off" });
      if (sc.max) input.maxLength = sc.max;
      input.setAttribute("aria-describedby", serro.id);
      input.value = Array.isArray(atual) ? atual.join("\n") : typeof atual === "string" ? atual : "";
      input.addEventListener("input", () =>
        set(sc.tipo === "linhas" ? input.value.split("\n").map((l) => l.trim()).filter(Boolean) : input.value),
      );
      sbloco.append(el("label", { for: id }, sc.rotulo), input);
    }
    if (sc.dica) sbloco.append(el("p", { className: "rodape" }, sc.dica));
    sbloco.append(serro);
    partes.push({ i, sc, bloco: sbloco, erro: serro });
    return sbloco;
  }

  // Visibilidade dos subcampos (condições do item), erros por item e travas.
  function atualizar(travado: boolean): void {
    const lista = itens();
    for (const p of partes) {
      p.bloco.hidden = !lista[p.i] || !campoVisivel(p.sc, lista[p.i]);
      const msg = estado.erros[`${c.nome}.${p.i}.${p.sc.nome}`];
      p.erro.textContent = msg ?? "";
      p.erro.hidden = !msg;
      p.bloco.querySelectorAll("input, select, textarea").forEach((x) => {
        (x as HTMLInputElement).disabled = travado || !!c.somenteLeitura;
        x.setAttribute("aria-invalid", String(!!msg));
      });
    }
    grupo.querySelectorAll("button").forEach((b) => ((b as HTMLButtonElement).disabled = travado));
  }

  adicionar.addEventListener("click", () => {
    mudar([...itens(), { ...c.novo }]);
    desenharItens();
  });
  return { grupo, preencher: () => desenharItens(), atualizar };
}

// Monta o formulário inteiro na chegada da descrição.
function montar(form: Formulario): void {
  $("titulo").textContent = form.titulo;
  const avisos = $("avisos");
  avisos.replaceChildren(...(form.avisos ?? []).map((a) => el("p", {}, a)));
  avisos.hidden = !form.avisos?.length;
  for (const c of form.campos) montarCampo(c);
  for (const c of form.campos) {
    const m = montados.get(c.nome)!;
    m.opcoes?.(opcoesDe(c));
    m.preencher(estado.valores[c.nome]);
  }
  const geral = el("p", { id: "erro-geral", className: "erro geral", role: "alert", hidden: true });
  const cancelar = el("button", { type: "button", id: "cancelar", className: "texto" }, t.cancelar);
  const salvar = el("button", { type: "submit", id: "salvar", className: "primario" }, form.botao);
  cancelar.addEventListener("click", cancelarFormulario);
  $<HTMLFormElement>("form").append(geral, el("div", { className: "acoes" }, cancelar, salvar));
}

// Atualiza visibilidade, erros, travas e telas finais conforme o estado.
function desenhar(): void {
  const s = estado;
  document.querySelector("main")!.setAttribute("aria-busy", String(s.fase === "carregando"));
  const erroOpcoes = $("erro-opcoes");
  erroOpcoes.hidden = s.fase !== "erro_opcoes";
  if (s.fase === "erro_opcoes" && !erroOpcoes.childElementCount) {
    const botao = el("button", { type: "button", className: "texto" }, t.tentarDeNovo);
    botao.addEventListener("click", () => void carregarOpcoes());
    erroOpcoes.replaceChildren(el("span", {}, t.erroOpcoes), botao);
  }
  if (!s.form) return;
  const travado = s.fase !== "pronto";
  for (const c of s.form.campos) {
    const m = montados.get(c.nome);
    if (!m) continue;
    m.bloco.hidden = !campoVisivel(c, s.valores);
    const msg = s.erros[c.nome];
    m.erro.textContent = msg ?? "";
    m.erro.hidden = !msg;
    if (m.atualizar) {
      m.atualizar(travado);
      continue;
    }
    m.bloco.querySelectorAll("input, select, textarea").forEach((x) => {
      (x as HTMLInputElement).disabled = travado;
      x.setAttribute("aria-invalid", String(!!msg));
    });
  }
  const geral = document.getElementById("erro-geral");
  if (geral) {
    geral.textContent = s.erroGeral ?? "";
    geral.hidden = !s.erroGeral;
  }
  const salvar = document.getElementById("salvar") as HTMLButtonElement | null;
  if (salvar) {
    salvar.disabled = travado;
    salvar.textContent = s.fase === "salvando" ? t.salvando : s.form.botao;
  }
  $("form").hidden = s.fase === "sucesso" || s.fase === "cancelado";
  $("cancelado").hidden = s.fase !== "cancelado";
  $("cancelado").textContent = t.cancelado;
  $("sucesso").hidden = s.fase !== "sucesso";
  if (s.fase === "sucesso" && s.resposta) {
    $("sucesso-titulo").textContent = t.salvo;
    $("sucesso-resumo").textContent = s.resposta.resumo;
    const seg = s.resposta.segredo;
    $("segredo").hidden = !seg;
    if (seg) {
      $("segredo-aviso").textContent = seg.aviso;
      $("segredo-rotulo").textContent = seg.rotulo;
      $<HTMLInputElement>("segredo-valor").value = seg.valor;
    }
  }
}

async function carregarOpcoes(): Promise<void> {
  const nome = estado.form?.ferramentaOpcoes;
  const app = obterApp();
  if (!nome || !app) return;
  try {
    const r = await app.callServerTool({ name: nome, arguments: {} });
    const opcoes = (r.structuredContent as { opcoes?: Record<string, Opcao[]> } | undefined)?.opcoes;
    if (r.isError || !opcoes) return despachar({ tipo: "opcoes_erro" });
    despachar({ tipo: "opcoes", opcoes });
    for (const c of estado.form!.campos) {
      const m = montados.get(c.nome)!;
      m.opcoes?.(opcoesDe(c));
    }
    desenhar();
  } catch {
    despachar({ tipo: "opcoes_erro" });
  }
}

function cancelarFormulario(): void {
  if (estado.fase === "salvando") return;
  despachar({ tipo: "cancelar" });
  const id = estado.form?.formulario_id;
  if (id) lembrar(storage, id, { fase: "cancelado" });
  const app = obterApp();
  void app?.updateModelContext({ content: [{ type: "text", text: t.canceladoModelo(estado.form?.titulo ?? "") }] }).catch(() => undefined);
  void app?.requestTeardown().catch(() => undefined);
}

$<HTMLFormElement>("form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = estado.form;
  const app = obterApp();
  if (!form || estado.fase !== "pronto" || !app) return;
  despachar({ tipo: "salvar_inicio", erros: errosLocais(form.campos, estado.valores, t.obrigatorio) });
  // despachar() troca o estado: a validação local pode ter mantido a fase em "pronto".
  if ((estado.fase as string) !== "salvando") return;
  let resposta: RespostaSalvar;
  try {
    const r = await app.callServerTool({ name: `salvar_${form.acao}`, arguments: valoresVisiveis(form.campos, estado.valores) });
    resposta = (r.structuredContent as RespostaSalvar | undefined) ?? { ok: false, erros: [{ campo: null, mensagem: t.inesperado }] };
  } catch {
    resposta = { ok: false, erros: [{ campo: null, mensagem: t.inesperado }] };
  }
  despachar({ tipo: "salvar_fim", resposta });
  if (resposta.ok) {
    // A memória guarda só o resumo, nunca o segredo (a chave aparece uma vez).
    lembrar(storage, form.formulario_id, { fase: "sucesso", resumo: resposta.resumo, idSalvo: resposta.ids[0] ?? null });
    void app.updateModelContext({ content: [{ type: "text", text: t.salvoModelo(resposta.resumo) }] }).catch(() => undefined);
  }
});

ref.app = criarFormulario(
  (r) => {
    const form = r.structuredContent as Formulario | undefined;
    if (!form?.campos || estado.form) return;
    const l = lerLembranca(storage, form.formulario_id);
    despachar({ tipo: "formulario", form });
    montar(form);
    if (l) {
      despachar(l.fase === "sucesso" ? { tipo: "lembranca", fase: "sucesso", resposta: { ok: true, ids: l.idSalvo ? [l.idSalvo] : [], resumo: l.resumo } } : { tipo: "lembranca", fase: "cancelado" });
      return;
    }
    desenhar();
    void carregarOpcoes();
  },
  () => void carregarOpcoes(),
);

desenhar();
