// Regra 11.17: o segredo cifrado volta igual, não aparece em claro e adulteração é detectada.
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./aes";

describe("cifra AES-256-GCM (regra 11.17)", () => {
  it("cifra e decifra de volta", () => {
    const sealed = encryptSecret("whsec_valor-secreto");
    expect(sealed.split(".")).toHaveLength(3);
    expect(sealed).not.toContain("whsec_");
    expect(decryptSecret(sealed)).toBe("whsec_valor-secreto");
  });

  it("dois cifrados do mesmo texto são diferentes (iv aleatório)", () => {
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
  });

  it("texto adulterado não decifra", () => {
    const [iv, tag, data] = encryptSecret("whsec_valor").split(".");
    const flipped = Buffer.from(data, "base64url");
    flipped[0] ^= 1;
    expect(() => decryptSecret([iv, tag, flipped.toString("base64url")].join("."))).toThrow();
  });

  it("tag truncada é recusada", () => {
    const [iv, tag, data] = encryptSecret("whsec_valor").split(".");
    const short = Buffer.from(tag, "base64url").subarray(0, 4).toString("base64url");
    expect(() => decryptSecret([iv, short, data].join("."))).toThrow("segredo_cifrado_invalido");
  });

  it("chave errada não decifra", () => {
    const sealed = encryptSecret("whsec_valor");
    expect(() => decryptSecret(sealed, randomBytes(32).toString("base64"))).toThrow();
  });

  it("chave ausente ou curta é recusada", () => {
    expect(() => encryptSecret("x", "curta")).toThrow(/CHAVES_ENC_KEY/);
  });
});
