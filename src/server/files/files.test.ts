// Arquivos (8.4): tipo pelos bytes (11.2, 20.3), extração com os quatro casos da seção 22, driver
// local (HMAC, validade, caminho com ..) e URL assinada do S3 calculada sem rede.
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { CURRICULO_MAX_BYTES } from "@/lib/limits";
import { GET as devGet, PUT as devPut } from "@/app/api/dev/arquivos/[...caminho]/route";
import { extrairTexto } from "./extract";
import { localFilePath, localStorageDriver, verifyLocal } from "./local";
import { s3StorageDriver } from "./s3";
import { confereCurriculo, tipoPelosBytes } from "./verifica";
import { docx, docxCorrompido, exe, pdf } from "../../../tests/fixtures/curriculos";

describe("tipo pelos bytes", () => {
  it("PDF e DOCX de verdade passam; .exe com nome de .pdf não", () => {
    expect(tipoPelosBytes(pdf("Oi"))).toBe("pdf");
    expect(tipoPelosBytes(docx("Oi"))).toBe("docx");
    expect(tipoPelosBytes(exe())).toBeNull();
  });
  it("5 MB passa; 5 MB + 1 byte não", () => {
    const base = pdf("Oi");
    const cheio = new Uint8Array(CURRICULO_MAX_BYTES);
    cheio.set(base);
    expect(confereCurriculo(cheio)).toMatchObject({ tipo: "pdf", bytes: CURRICULO_MAX_BYTES });
    const grande = new Uint8Array(CURRICULO_MAX_BYTES + 1);
    grande.set(base);
    expect(confereCurriculo(grande)).toBe("curriculo_invalido");
  });
});

describe("extração (seção 22)", () => {
  it("PDF com texto", async () => {
    const r = await extrairTexto(pdf("Experiencia com atendimento"), "pdf");
    expect(r.status).toBe("ok");
    expect(r.texto).toContain("Experiencia com atendimento");
  });
  it("PDF escaneado (sem texto) vira sem_texto", async () => {
    expect(await extrairTexto(pdf(), "pdf")).toEqual({ status: "sem_texto", texto: null });
  });
  it("DOCX", async () => {
    const r = await extrairTexto(docx("Padeira com 5 anos de casa"), "docx");
    expect(r).toEqual({ status: "ok", texto: "Padeira com 5 anos de casa" });
  });
  it("DOCX corrompido vira falhou, sem lançar", async () => {
    expect((await extrairTexto(docxCorrompido(), "docx")).status).toBe("falhou");
  });
});

describe("armazenamento", () => {
  it("driver local: grava pela URL assinada, lê de volta, recusa assinatura errada e vencida", async () => {
    const s = localStorageDriver();
    const path = `teste/${Date.now()}/curriculo.pdf`;
    const up = await s.createUploadUrl(path, "application/pdf", 60);
    const url = new URL(up.url);
    const caminho = url.pathname.replace("/api/dev/arquivos/", "").split("/").map(decodeURIComponent);
    const put = await devPut(new NextRequest(up.url, { method: "PUT", body: Buffer.from(pdf("x")) }), { params: Promise.resolve({ caminho }) });
    expect(put.status).toBe(200);
    expect(await s.read(path, 1000)).not.toBeNull();
    const errado = new NextRequest(up.url.replace(/sig=[^&]+/, "sig=xxx"), { method: "PUT", body: "a" });
    expect((await devPut(errado, { params: Promise.resolve({ caminho }) })).status).toBe(403);
    const get = await devGet(new NextRequest(up.url.replace("op=put", "op=get")), { params: Promise.resolve({ caminho }) });
    expect(get.status).toBe(403);
    expect(verifyLocal("put", path, Math.floor(Date.now() / 1000) - 1, "x")).toBe(false);
    await s.deletePrefix(`${path.split("/").slice(0, 2).join("/")}/`);
    expect(await s.read(path, 1000)).toBeNull();
  });
  it("caminho com .. não sai da pasta", () => {
    expect(() => localFilePath("../../etc/passwd")).toThrow("caminho_invalido");
  });
  it("S3: URL de upload assinada sem rede, com a validade pedida", async () => {
    const s = s3StorageDriver({ endpoint: "https://conta.r2.cloudflarestorage.com", region: "auto", accessKeyId: "AKIA", secretAccessKey: "segredo", bucket: "contrata-arquivos" });
    const up = await s.createUploadUrl("e/c/curriculo.pdf", "application/pdf", 3600);
    const url = new URL(up.url);
    expect(url.hostname).toBe("conta.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/contrata-arquivos/e/c/curriculo.pdf");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
    const down = new URL((await s.createDownloadUrl("e/c/curriculo.pdf", 300, "cv.pdf")).url);
    expect(down.searchParams.get("response-content-disposition")).toContain("cv.pdf");
  });
});
