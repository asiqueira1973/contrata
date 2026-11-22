// Requisição a uma URL de fora, protegida contra SSRF — regras 11.17 e 11.18 (épico 8.8, porte do
// Assina). Usada para entregar webhooks.
// - Só https. O IP é conferido **no momento da conexão** (lookup próprio do socket), então um DNS
//   que responde um IP público na checagem e um privado na conexão não passa (DNS rebinding).
// - Recusa IP privado, loopback, link-local, CGNAT, multicast, reservado, "this network", ULA do
//   IPv6, IPv4 mapeado em IPv6 que caia nesses blocos e o metadado de nuvem (169.254.169.254 e
//   fd00:ec2::254 já estão nos blocos). Host que é IP literal também é conferido.
// - Redirecionamentos: só se pedidos, no máximo 3, cada um conferido de novo (e só https).
// - Timeout total e limite de bytes da resposta (corta ao passar).
// Nos testes (Vitest), setRemoteFetchTestMode libera http, loopback e certificado autoassinado
// para servidores locais.
import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { NOME_PRODUTO } from "@/lib/copy";

export class RemoteFetchError extends Error {
  constructor(public code: "url_recusada" | "download_falhou" | "grande_demais") {
    super(code);
  }
}

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 96], // IPv4 compatível (::a.b.c.d), obsoleto; inclui :: e ::1
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["2001::", 32], // Teredo (embute IPv4)
  ["2002::", 16], // 6to4 (embute IPv4)
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

let testMode = false;
// Só para testes: libera http e loopback (servidor local do teste). Em produção não tem efeito.
export function setRemoteFetchTestMode(on: boolean): void {
  testMode = on && !!process.env.VITEST;
}

// Diz se o IP pode ser alvo. Recebe: o endereço. Devolve: true se for público.
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (!family) return false;
  if (family === 6) {
    // IPv4 mapeado (::ffff:a.b.c.d ou ::ffff:7f00:1): vale a regra do IPv4. (Não dá para pôr
    // ::ffff:0:0/96 no BlockList: ele confere todo IPv4 contra esse bloco e recusaria tudo.)
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) return isPublicAddress(mapped[1]);
    const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address);
    if (hex) {
      const hi = parseInt(hex[1], 16);
      const lo = parseInt(hex[2], 16);
      return isPublicAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return !blocked.check(address, "ipv6");
  }
  return !blocked.check(address, "ipv4");
}

function allowed(address: string): boolean {
  if (testMode && (address === "127.0.0.1" || address === "::1")) return true;
  return isPublicAddress(address);
}

// lookup do socket: resolve e só devolve endereço público. Exportado para o teste conferir que um
// nome que resolve para loopback é recusado aqui, e não por falha de conexão.
export const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = (addresses as unknown as LookupAddress[]).filter((a) => allowed(a.address));
    if (!list.length) return callback(new RemoteFetchError("url_recusada") as NodeJS.ErrnoException, "", 0);
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

// Confere a URL antes de conectar. Devolve: a URL; lança url_recusada.
function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new RemoteFetchError("url_recusada");
  }
  if (url.protocol !== "https:" && !(testMode && url.protocol === "http:")) throw new RemoteFetchError("url_recusada");
  if (url.username || url.password) throw new RemoteFetchError("url_recusada");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !allowed(host)) throw new RemoteFetchError("url_recusada");
  if (host === "localhost" || host.endsWith(".localhost")) {
    if (!testMode) throw new RemoteFetchError("url_recusada");
  }
  return url;
}

// Confere uma URL de webhook ao salvar (a conexão confere de novo, depois do DNS).
// Devolve: true se é https, sem credenciais, sem IP privado literal e sem localhost.
export function isAcceptableWebhookUrl(raw: string): boolean {
  try {
    checkUrl(raw);
    return new URL(raw).protocol === "https:";
  } catch {
    return false;
  }
}

export type RemoteResponse = { status: number; body: Uint8Array };

// Faz a requisição. Recebe: URL e opções (método, cabeçalhos, corpo, limite de bytes, timeout,
// redirecionamentos permitidos). Devolve: status e corpo. Lança RemoteFetchError.
export async function fetchRemote(
  raw: string,
  opts: {
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    body?: string;
    maxBytes: number;
    timeoutMs: number;
    maxRedirects?: number;
    /** "erro" (padrão): passou do limite, lança grande_demais. "cortar": guarda o começo e segue (webhook: só o status importa). */
    excess?: "erro" | "cortar";
  },
): Promise<RemoteResponse> {
  const deadline = Date.now() + opts.timeoutMs;
  let current = raw;
  for (let hop = 0; ; hop++) {
    const url = checkUrl(current);
    const res = await once(url, opts, Math.max(1, deadline - Date.now()));
    if (res.status >= 300 && res.status < 400 && res.location) {
      if (hop >= (opts.maxRedirects ?? 0)) throw new RemoteFetchError(opts.maxRedirects ? "download_falhou" : "url_recusada");
      current = new URL(res.location, url).toString();
      continue;
    }
    return { status: res.status, body: res.body };
  }
}

function once(url: URL, opts: Parameters<typeof fetchRemote>[1], timeoutMs: number): Promise<{ status: number; body: Uint8Array; location?: string }> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: opts.method ?? "GET",
        headers: { "user-agent": `${NOME_PRODUTO.replace(/[^A-Za-z0-9]/g, "")}/1`, ...(opts.headers ?? {}) },
        lookup: safeLookup,
        timeout: timeoutMs,
        // Só nos testes: o servidor https local usa certificado autoassinado.
        ...(testMode ? { rejectUnauthorized: false } : {}),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > opts.maxBytes) {
            if (opts.excess === "cortar") {
              // Já basta: devolve o status e o começo do corpo, sem ler o resto.
              resolve({ status: res.statusCode ?? 0, body: new Uint8Array(Buffer.concat(chunks)), location: res.headers.location });
              req.destroy();
              return;
            }
            req.destroy();
            reject(new RemoteFetchError("grande_demais"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: new Uint8Array(Buffer.concat(chunks)), location: res.headers.location }));
        res.on("error", () => reject(new RemoteFetchError("download_falhou")));
      },
    );
    const timer = setTimeout(() => req.destroy(new RemoteFetchError("download_falhou")), timeoutMs);
    req.on("close", () => clearTimeout(timer));
    req.on("timeout", () => req.destroy(new RemoteFetchError("download_falhou")));
    req.on("error", (e) => reject(e instanceof RemoteFetchError ? e : (e as NodeJS.ErrnoException).message === "url_recusada" ? new RemoteFetchError("url_recusada") : new RemoteFetchError("download_falhou")));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}
