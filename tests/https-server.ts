// Servidor https local para os testes dos webhooks (8.8, porte do Assina): o banco só aceita
// webhook https, então o teste precisa de TLS. Certificado autoassinado gerado na hora.
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:https";
import type { IncomingMessage, ServerResponse } from "node:http";
import forge from "node-forge";

function selfSigned(): { key: string; cert: string } {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.publicKeyFromPem(publicKey.export({ type: "spki", format: "pem" }) as string);
  cert.serialNumber = "01" + randomBytes(8).toString("hex");
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + 86400_000);
  cert.setSubject([{ name: "commonName", value: "127.0.0.1" }]);
  cert.setIssuer([{ name: "commonName", value: "127.0.0.1" }]);
  const pem = privateKey.export({ type: "pkcs1", format: "pem" }) as string;
  cert.sign(forge.pki.privateKeyFromPem(pem) as forge.pki.rsa.PrivateKey, forge.md.sha256.create());
  return { key: pem, cert: forge.pki.certificateToPem(cert) };
}

export type Received = { path: string; headers: IncomingMessage["headers"]; body: string };

// Sobe o servidor. Recebe: o tratador. Devolve: a URL base, os pedidos recebidos e o close.
export async function startHttps(handler: (req: IncomingMessage, res: ServerResponse, body: Buffer) => void) {
  const received: Received[] = [];
  const server: Server = createServer(selfSigned(), (req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      received.push({ path: req.url ?? "", headers: req.headers, body: body.toString("utf8") });
      handler(req, res, body);
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const base = `https://127.0.0.1:${(server.address() as { port: number }).port}`;
  return { base, received, close: () => new Promise<void>((r) => server.close(() => r())) };
}
