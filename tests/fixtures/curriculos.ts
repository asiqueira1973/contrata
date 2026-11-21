// Arquivos de teste do currículo (seção 22: PDF com texto, PDF escaneado sem texto, DOCX, DOCX
// corrompido), montados em código para não versionar binários.
import { crc32 } from "node:zlib";

// PDF mínimo e válido. Com `texto`, uma página com esse texto; sem, uma página vazia (como um
// escaneado sem camada de texto).
export function pdf(texto?: string): Uint8Array {
  const conteudo = texto ? `BT /F1 18 Tf 72 720 Td (${texto.replace(/[()\\]/g, "")}) Tj ET` : "";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}

// Zip sem compressão (método 0) com as entradas dadas.
function zip(entradas: Record<string, string>): Uint8Array {
  const partes: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [nome, texto] of Object.entries(entradas)) {
    const dados = Buffer.from(texto, "utf8");
    const nomeB = Buffer.from(nome, "utf8");
    const crc = crc32(dados);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc >>> 0, 14); local.writeUInt32LE(dados.length, 18); local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nomeB.length, 26); local.writeUInt16LE(0, 28);
    partes.push(local, nomeB, dados);
    const cab = Buffer.alloc(46);
    cab.writeUInt32LE(0x02014b50, 0); cab.writeUInt16LE(20, 4); cab.writeUInt16LE(20, 6); cab.writeUInt16LE(0, 8); cab.writeUInt16LE(0, 10);
    cab.writeUInt32LE(0, 12); cab.writeUInt32LE(crc >>> 0, 16); cab.writeUInt32LE(dados.length, 20); cab.writeUInt32LE(dados.length, 24);
    cab.writeUInt16LE(nomeB.length, 28); cab.writeUInt32LE(offset, 42);
    central.push(cab, nomeB);
    offset += 30 + nomeB.length + dados.length;
  }
  const dir = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(Object.keys(entradas).length, 8); fim.writeUInt16LE(Object.keys(entradas).length, 10);
  fim.writeUInt32LE(dir.length, 12); fim.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...partes, dir, fim]));
}

// DOCX mínimo com um parágrafo.
export function docx(texto: string): Uint8Array {
  return zip({
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "_rels/.rels": '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${texto}</w:t></w:r></w:p></w:body></w:document>`,
  });
}

// DOCX corrompido: parece zip com word/document.xml, mas o XML não fecha.
export function docxCorrompido(): Uint8Array {
  return zip({ "[Content_Types].xml": "<Types", "word/document.xml": "<w:document><w:body><w:p>" });
}

// Executável renomeado para .pdf (MZ…).
export function exe(): Uint8Array {
  return new Uint8Array(Buffer.concat([Buffer.from("MZ\x90\x00", "latin1"), Buffer.alloc(200)]));
}
