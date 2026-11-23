// @vitest-environment happy-dom
// Formulário de candidatura (8.4): o Next 16 guarda a página escondida (<Activity>) e, ao voltar
// para "Candidatar-me", mostrava de novo a tela "Candidatura enviada" da candidatura anterior,
// sem formulário. Voltar à página tem de trazer o formulário vazio.
import { Activity, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import { ApplicationForm } from "./application-form";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
  document.body.innerHTML = "";
});

const props = {
  empresaSlug: "padaria", empresaNome: "Padaria", vagaSlug: "atendente", vagaTitulo: "Atendente", curriculoObrigatorio: false,
  perguntas: [], aviso: ["Aviso."], avisoExtra: null, talentosMeses: 12,
};

// Escreve num campo controlado do React (o setter nativo + evento input).
function escreve(el: HTMLInputElement, valor: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, valor);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("formulário de candidatura ao voltar para a página", () => {
  it("depois de enviar, sair e voltar mostra o formulário vazio, não a tela de enviada", async () => {
    globalThis.fetch = (async (url: string) =>
      new Response(JSON.stringify(String(url).includes("/concluir") ? {} : { id: "c1", upload_url: null, concluir_token: "t" }), {
        status: 200, headers: { "content-type": "application/json" },
      })) as typeof fetch;
    const div = document.createElement("div");
    document.body.appendChild(div);
    const root = createRoot(div);
    const render = (mode: "visible" | "hidden") => act(async () => root.render(createElement(Activity, { mode } as React.ComponentProps<typeof Activity>, createElement(ApplicationForm, props))));
    await render("visible");
    const nome = div.querySelector<HTMLInputElement>("input[autocomplete=name]")!;
    const email = div.querySelector<HTMLInputElement>("input[type=email]")!;
    await act(async () => {
      escreve(nome, "Teste Volta");
      escreve(email, "volta@teste.dev");
      div.querySelector<HTMLInputElement>("input[type=checkbox]")!.click();
    });
    await act(async () => {
      div.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(div.textContent).toContain(copy.candidatura.enviadaTitulo);
    // Sai da página (o Next esconde) e volta.
    await render("hidden");
    await render("visible");
    expect(div.textContent).not.toContain(copy.candidatura.enviadaTitulo);
    expect(div.querySelector("form")).not.toBeNull();
    expect(div.querySelector<HTMLInputElement>("input[autocomplete=name]")!.value).toBe("");
    root.unmount();
  });
});
