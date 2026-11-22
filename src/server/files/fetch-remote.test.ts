// Regras 11.17 e 11.18: o fetch de fora recusa http, IP privado (inclusive depois do DNS e em
// redirecionamento), segue no máximo 3 redirecionamentos e corta acima do limite de bytes.
import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { fetchRemote, isPublicAddress, safeLookup, setRemoteFetchTestMode } from "./fetch-remote";

const opts = { maxBytes: 1000, timeoutMs: 3000 };
const refused = (p: Promise<unknown>, code = "url_recusada") => expect(p).rejects.toMatchObject({ code });

describe("isPublicAddress", () => {
  it.each([
    ["8.8.8.8", true],
    ["1.1.1.1", true],
    ["2606:4700:4700::1111", true],
    ["127.0.0.1", false],
    ["10.1.2.3", false],
    ["172.20.0.1", false],
    ["192.168.0.10", false],
    ["169.254.169.254", false], // metadado de nuvem
    ["100.64.0.1", false],
    ["0.0.0.0", false],
    ["::1", false],
    ["fe80::1", false],
    ["fd00:ec2::254", false], // metadado da AWS em IPv6
    ["::ffff:127.0.0.1", false],
    ["::ffff:10.0.0.1", false],
    ["::ffff:7f00:1", false], // 127.0.0.1 em hexadecimal (forma que o URL normaliza)
    ["::ffff:808:808", true], // 8.8.8.8 em hexadecimal
    ["::127.0.0.1", false], // IPv4 compatível (obsoleto)
    ["2002:7f00:1::1", false], // 6to4 de 127.0.0.1
    ["2001:0:4136:e378:8000:63bf:3fff:fdd2", false], // Teredo
    ["nao-e-ip", false],
  ])("%s → %s", (ip, ok) => expect(isPublicAddress(ip)).toBe(ok));
});

describe("fetchRemote (produção)", () => {
  it("recusa http, credenciais na URL, IP privado literal e localhost", async () => {
    await refused(fetchRemote("http://example.com/x.pdf", opts));
    await refused(fetchRemote("https://user:pw@example.com/x.pdf", opts));
    await refused(fetchRemote("https://127.0.0.1/x.pdf", opts));
    await refused(fetchRemote("https://[::1]/x.pdf", opts));
    await refused(fetchRemote("https://169.254.169.254/latest/meta-data", opts));
    await refused(fetchRemote("https://localhost/x.pdf", opts));
    await refused(fetchRemote("ftp://example.com/x.pdf", opts));
    await refused(fetchRemote("não é url", opts));
  });

  it("o lookup do socket recusa nome que resolve para loopback (DNS rebinding)", async () => {
    // "localhost" resolve pelo /etc/hosts, sem rede: o erro tem de ser a recusa, não a conexão.
    const err = await new Promise<unknown>((resolve) => safeLookup("localhost", {}, (e) => resolve(e)));
    expect(err).toMatchObject({ code: "url_recusada" });
  });

  it("recusa IPv6 compatível com IPv4 e mapeado em hexadecimal", async () => {
    await refused(fetchRemote("https://[::127.0.0.1]/x.pdf", opts));
    await refused(fetchRemote("https://[::ffff:7f00:1]/x.pdf", opts));
    expect(isPublicAddress("::7f00:1")).toBe(false);
  });
});

describe("fetchRemote (servidor local, modo de teste)", () => {
  let server: Server;
  let base = "";
  beforeAll(async () => {
    setRemoteFetchTestMode(true);
    server = createServer((req, res) => {
      const u = new URL(req.url!, "http://x");
      if (u.pathname.startsWith("/redir/")) {
        const n = Number(u.pathname.split("/")[2]);
        res.writeHead(302, { location: n > 0 ? `/redir/${n - 1}` : "/ok" }).end();
      } else if (u.pathname === "/to-private") {
        res.writeHead(302, { location: "http://10.0.0.1/x" }).end();
      } else if (u.pathname === "/big") {
        res.end(Buffer.alloc(5000, 1));
      } else {
        res.end("%PDF-1.7 ok");
      }
    }).listen(0);
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(() => {
    server.close();
    setRemoteFetchTestMode(false);
  });
  afterEach(() => undefined);

  it("baixa, segue até 3 redirecionamentos e para no 4º", async () => {
    expect(Buffer.from((await fetchRemote(`${base}/ok`, opts)).body).toString()).toBe("%PDF-1.7 ok");
    expect((await fetchRemote(`${base}/redir/2`, { ...opts, maxRedirects: 3 })).status).toBe(200);
    await refused(fetchRemote(`${base}/redir/3`, { ...opts, maxRedirects: 3 }), "download_falhou");
  });

  it("redirecionamento para IP privado é recusado; sem redirecionamento permitido também", async () => {
    await refused(fetchRemote(`${base}/to-private`, { ...opts, maxRedirects: 3 }));
    await refused(fetchRemote(`${base}/redir/0`, opts));
  });

  it("corta acima do limite de bytes", async () => {
    await refused(fetchRemote(`${base}/big`, opts), "grande_demais");
  });
});
