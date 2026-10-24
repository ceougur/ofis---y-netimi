// Rapor PDF'i ve Excel'inin metni (test yardımcısı; test/raporlar-224.test.mjs'teki okuyucuların aynısı): PDF'in ToUnicode eşlemesiyle metin
// satırları, Excel'in ilk sayfasının hücreleri (metin ya da sayı). 2.4.5 madde 6d testleri (birim + e2e) kullanır.
import { inflateSync } from "node:zlib";
import { readZip } from "../../server/lib/zip.mjs";

export function pdfText(buffer) {
  const text = buffer.toString("latin1");
  const objects = new Map([...text.matchAll(/(\d+) 0 obj\n?([\s\S]*?)\nendobj/g)].map(match => [Number(match[1]), match[2]]));
  const stream = body => {
    const match = /stream\n([\s\S]*?)\nendstream/.exec(body || "");
    if (!match) return "";
    try {
      return /FlateDecode/.test(body) ? inflateSync(Buffer.from(match[1], "latin1")).toString("latin1") : match[1];
    } catch {
      return "";
    }
  };
  const fonts = new Map();
  for (const body of objects.values()) {
    for (const [, name, id] of (/\/Font << ([^>]*) >>/.exec(body)?.[1] || "").matchAll(/\/(\w+) (\d+) 0 R/g)) {
      if (fonts.has(name)) continue;
      const cmap = new Map();
      const unicode = /\/ToUnicode (\d+) 0 R/.exec(objects.get(Number(id)) || "");
      for (const [, gid, hex] of stream(objects.get(Number(unicode?.[1]))).matchAll(/<([0-9A-F]{4})> <([0-9A-F]+)>/g)) cmap.set(gid, String.fromCodePoint(...hex.match(/.{4}/g).map(part => parseInt(part, 16))));
      fonts.set(name, cmap);
    }
  }
  const out = [];
  for (const body of objects.values()) {
    if (!/\/Length/.test(body) || /ToUnicode|FontFile|beginbfchar|DCTDecode/.test(body)) continue;
    for (const [, font, glyphs] of stream(body).matchAll(/\/(\w+) [\d.]+ Tf [^<]*<([0-9A-F]*)> Tj/g)) out.push((glyphs.match(/.{4}/g) || []).map(gid => fonts.get(font)?.get(gid) ?? "?").join(""));
  }
  return out.join("\n");
}
const xmlText = value => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
export function xlsxRows(buffer) {
  const entries = readZip(buffer);
  const file = name => entries.find(entry => entry.name === name)?.data.toString("utf8") || "";
  const shared = [...file("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(match => xmlText([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
  const sheet = file("xl/worksheets/sheet1.xml");
  return [...sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(row =>
    [...row[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].reduce((cells, [, attrs, body = ""]) => {
      const letters = /r="([A-Z]+)\d+"/.exec(attrs)?.[1] || "";
      const index = letters ? [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1 : cells.length;
      const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(body);
      const v = /<v>([\s\S]*?)<\/v>/.exec(body);
      while (cells.length < index) cells.push("");
      cells[index] = t ? xmlText(t[1]) : !v ? "" : /t="s"/.test(attrs) ? shared[Number(v[1])] : Number(v[1]);
      return cells;
    }, []),
  );
}
