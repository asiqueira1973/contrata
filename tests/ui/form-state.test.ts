// Máquina do formulário genérico (12.5): trava depois do sucesso, erros por campo, validação local
// só dos campos visíveis e obrigatórios, preencher ao escolher uma opção.
import { describe, expect, it } from "vitest";
import type { Formulario } from "@/lib/formularios";
import { errosLocais, inicial, reduzir } from "../../ui/formulario/state";

const form: Formulario = {
  formulario_id: "f1",
  acao: "area",
  titulo: "Áreas",
  botao: "Salvar",
  ferramentaOpcoes: "opcoes_area",
  campos: [
    { tipo: "radio", nome: "operacao", rotulo: "O que", obrigatorio: true, opcoes: [{ valor: "criar", rotulo: "Criar" }, { valor: "editar", rotulo: "Editar" }] },
    { tipo: "select", nome: "area", rotulo: "Área", opcoes: "areas", obrigatorio: true, mostrarSe: [{ campo: "operacao", igual: "editar" }] },
    { tipo: "texto", nome: "nome", rotulo: "Nome", obrigatorio: true },
  ],
  valores: { operacao: "criar", area: "", nome: "" },
};

describe("estado do formulário", () => {
  it("carrega opções antes de ficar pronto", () => {
    let s = reduzir(inicial(), { tipo: "formulario", form });
    expect(s.fase).toBe("carregando");
    s = reduzir(s, { tipo: "opcoes", opcoes: { areas: [] } });
    expect(s.fase).toBe("pronto");
  });
  it("validação local ignora campo escondido e cobra o obrigatório visível", () => {
    expect(errosLocais(form.campos, { operacao: "criar", area: "", nome: "" }, "x")).toEqual({ nome: "x" });
    expect(errosLocais(form.campos, { operacao: "editar", area: "", nome: "A" }, "x")).toEqual({ area: "x" });
  });
  it("escolher uma opção com preencher atualiza os campos ligados", () => {
    let s = reduzir(reduzir(inicial(), { tipo: "formulario", form }), { tipo: "opcoes", opcoes: {} });
    s = reduzir(s, { tipo: "valor", nome: "area", valor: "a1", preencher: { nome: "Loja" } });
    expect(s.valores).toMatchObject({ area: "a1", nome: "Loja" });
  });
  it("erro do servidor volta para pronto com a mensagem no campo; sucesso trava", () => {
    let s = reduzir(reduzir(inicial(), { tipo: "formulario", form }), { tipo: "opcoes", opcoes: {} });
    s = reduzir(s, { tipo: "salvar_inicio", erros: {} });
    expect(s.fase).toBe("salvando");
    s = reduzir(s, { tipo: "salvar_fim", resposta: { ok: false, erros: [{ campo: "nome", mensagem: "Já existe" }, { campo: null, mensagem: "Geral" }] } });
    expect(s).toMatchObject({ fase: "pronto", erros: { nome: "Já existe" }, erroGeral: "Geral" });
    s = reduzir(reduzir(s, { tipo: "salvar_inicio", erros: {} }), { tipo: "salvar_fim", resposta: { ok: true, ids: ["1"], resumo: "ok" } });
    expect(s.fase).toBe("sucesso");
    const depois = reduzir(s, { tipo: "valor", nome: "nome", valor: "outro" });
    expect(depois).toBe(s);
    expect(reduzir(s, { tipo: "salvar_inicio", erros: {} })).toBe(s);
  });
  it("cancelar não acontece no meio do salvamento", () => {
    let s = reduzir(reduzir(inicial(), { tipo: "formulario", form }), { tipo: "opcoes", opcoes: {} });
    s = reduzir(s, { tipo: "salvar_inicio", erros: {} });
    expect(reduzir(s, { tipo: "cancelar" }).fase).toBe("salvando");
  });
  it("lista: cobra o mínimo de itens e os subcampos obrigatórios visíveis de cada item (8.3)", () => {
    const campos: Formulario["campos"] = [{
      tipo: "lista", nome: "perguntas", rotulo: "Perguntas", rotuloItem: "Pergunta", adicionar: "+", min: 1, novo: { texto: "", tipo: "sim_nao" },
      subcampos: [
        { tipo: "texto", nome: "texto", rotulo: "Texto", obrigatorio: true },
        { tipo: "linhas", nome: "opcoes", rotulo: "Opções", obrigatorio: true, mostrarSe: [{ campo: "tipo", igual: "escolha_unica" }] },
      ],
    }];
    expect(errosLocais(campos, { perguntas: [] }, "x")).toEqual({ perguntas: "x" });
    expect(errosLocais(campos, { perguntas: [{ texto: "", tipo: "sim_nao" }, { texto: "Turno", tipo: "escolha_unica", opcoes: [] }] }, "x"))
      .toEqual({ "perguntas.0.texto": "x", "perguntas.1.opcoes": "x" });
    expect(errosLocais([{ ...campos[0], somenteLeitura: true } as Formulario["campos"][number]], { perguntas: [] }, "x")).toEqual({});
  });
  it("mexer na lista apaga os erros dos itens dela", () => {
    let s = reduzir(reduzir(inicial(), { tipo: "formulario", form }), { tipo: "opcoes", opcoes: {} });
    s = reduzir(s, { tipo: "salvar_inicio", erros: { "etapas.0.nome": "x", nome: "y" } });
    s = reduzir(s, { tipo: "valor", nome: "etapas", valor: [{ nome: "Triagem", tipo: "triagem" }] });
    expect(s.erros).toEqual({ nome: "y" });
  });
});
