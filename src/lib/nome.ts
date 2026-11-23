// Nome legível (uso real, 23/11/2026): o Google às vezes devolve o nome todo em maiúsculas
// ("ALEXANDRE SIQUEIRA"), e ele chegava assim aos e-mails ({{recrutador}}) e aos formulários.
// Recebe um nome; se veio todo em maiúsculas ou todo em minúsculas, devolve com a inicial de cada
// palavra em maiúscula e as partículas (da, de, do, das, dos, e) em minúsculas; senão, devolve
// como está (quem escreveu "McDonald" escreveu de propósito).
const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e", "di", "du", "del", "della", "van", "von"]);

export function nomeLegivel(nome: string): string {
  const n = nome.trim().replace(/\s+/g, " ");
  if (!/\p{L}/u.test(n) || (n !== n.toLocaleUpperCase("pt-BR") && n !== n.toLocaleLowerCase("pt-BR"))) return n;
  return n
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toLocaleUpperCase("pt-BR"))))
    .join(" ");
}
