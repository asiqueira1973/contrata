// E-mails do candidato (8.4; 20.3): o assunto fica guardado na fila depois do envio (só html e texto
// são apagados), então nada secreto vai no assunto.
import { describe, expect, it } from "vitest";
import { codigoExclusao } from "./templates";

describe("codigoExclusao", () => {
  it("o código vai no corpo, nunca no assunto", () => {
    const e = codigoExclusao({ empresa: "Padaria", codigo: "482913" });
    expect(e.assunto).not.toContain("482913");
    expect(e.texto).toContain("482913");
  });
});
