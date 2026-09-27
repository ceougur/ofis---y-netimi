// Bağımlılıksız PDF yazıcı (v2.0.1): kasa dökümü gibi tablolu raporlar için.
// Türkçe karakterlerin her görüntüleyicide doğru çıkması için TrueType yazı tipi gömülür (Type0 / CIDFontType2,
// Identity-H). Dosya küçük kalsın diye yalnız kullanılan glifler tutulur: glif numaraları değişmez (CIDToGIDMap
// Identity), kullanılmayan gliflerin çizimi boşaltılır. Metin kopyalanabilsin/aranabilsin diye ToUnicode eşlemesi
// eklenir. Koordinatlar sol üst köşeden, punto cinsindendir (A4: 595 × 842).
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

export const A4 = { width: 595.28, height: 841.89 };

// ---------------------------------------------------------------- TrueType okuma ve alt küme
export function loadFont(file) {
  const data = readFileSync(file);
  const tables = new Map();
  const count = data.readUInt16BE(4);
  for (let index = 0; index < count; index += 1) {
    const at = 12 + index * 16;
    tables.set(data.toString("latin1", at, at + 4), { offset: data.readUInt32BE(at + 8), length: data.readUInt32BE(at + 12) });
  }
  const table = tag => {
    const entry = tables.get(tag);
    return entry ? data.subarray(entry.offset, entry.offset + entry.length) : null;
  };
  const head = table("head");
  const hhea = table("hhea");
  const maxp = table("maxp");
  const hmtx = table("hmtx");
  const loca = table("loca");
  const glyf = table("glyf");
  const os2 = table("OS/2");
  if (!head || !hhea || !maxp || !hmtx || !loca || !glyf) throw new Error("Yazı tipi TrueType biçiminde değil.");
  const unitsPerEm = head.readUInt16BE(18);
  const longLoca = head.readInt16BE(50) === 1;
  const numGlyphs = maxp.readUInt16BE(4);
  const numberOfHMetrics = hhea.readUInt16BE(34);
  const advance = gid => hmtx.readUInt16BE(4 * Math.min(gid, numberOfHMetrics - 1));
  const glyphRange = gid => (longLoca ? [loca.readUInt32BE(gid * 4), loca.readUInt32BE(gid * 4 + 4)] : [loca.readUInt16BE(gid * 2) * 2, loca.readUInt16BE(gid * 2 + 2) * 2]);
  const cmap = readCmap(table("cmap"));
  const scale = value => Math.round((value * 1000) / unitsPerEm);
  const name = readName(table("name")) || "Font";
  return {
    name,
    unitsPerEm,
    numGlyphs,
    cmap,
    advance,
    glyphRange,
    table,
    glyf,
    width: gid => scale(advance(gid)),
    metrics: {
      ascent: scale(hhea.readInt16BE(4)),
      descent: scale(hhea.readInt16BE(6)),
      capHeight: scale(os2 && os2.readUInt16BE(0) >= 2 ? os2.readInt16BE(88) : hhea.readInt16BE(4) * 0.7),
      bbox: [36, 38, 40, 42].map(at => scale(head.readInt16BE(at))),
      bold: os2 ? os2.readUInt16BE(4) >= 600 : false,
    },
  };
}

function readName(name) {
  if (!name) return "";
  const count = name.readUInt16BE(2);
  const strings = name.readUInt16BE(4);
  for (let index = 0; index < count; index += 1) {
    const at = 6 + index * 12;
    const [platform, , , nameId, length, offset] = [0, 2, 4, 6, 8, 10].map(step => name.readUInt16BE(at + step));
    if (nameId !== 6) continue; // PostScript adı
    const raw = name.subarray(strings + offset, strings + offset + length);
    const text = platform === 3 || platform === 0 ? Buffer.from(raw).swap16().toString("utf16le") : raw.toString("latin1");
    return text.replace(/[^A-Za-z0-9-]/g, "");
  }
  return "";
}

function readCmap(cmap) {
  const map = new Map();
  if (!cmap) return map;
  const count = cmap.readUInt16BE(2);
  let best = null;
  for (let index = 0; index < count; index += 1) {
    const at = 4 + index * 8;
    const platform = cmap.readUInt16BE(at);
    const encoding = cmap.readUInt16BE(at + 2);
    const offset = cmap.readUInt32BE(at + 4);
    const format = cmap.readUInt16BE(offset);
    const rank = platform === 3 && encoding === 10 && format === 12 ? 3 : platform === 0 && format === 12 ? 2 : platform === 3 && encoding === 1 && format === 4 ? 1 : 0;
    if (rank && (!best || rank > best.rank)) best = { rank, offset, format };
  }
  if (!best) return map;
  const at = best.offset;
  if (best.format === 12) {
    const groups = cmap.readUInt32BE(at + 12);
    for (let index = 0; index < groups; index += 1) {
      const group = at + 16 + index * 12;
      const start = cmap.readUInt32BE(group);
      const end = cmap.readUInt32BE(group + 4);
      const glyph = cmap.readUInt32BE(group + 8);
      for (let code = start; code <= end && code - start < 0x10000; code += 1) map.set(code, glyph + code - start);
    }
    return map;
  }
  const segments = cmap.readUInt16BE(at + 6) / 2;
  const ends = at + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const ranges = deltas + segments * 2;
  for (let segment = 0; segment < segments; segment += 1) {
    const end = cmap.readUInt16BE(ends + segment * 2);
    const start = cmap.readUInt16BE(starts + segment * 2);
    const delta = cmap.readInt16BE(deltas + segment * 2);
    const rangeAt = ranges + segment * 2;
    const range = cmap.readUInt16BE(rangeAt);
    for (let code = start; code <= end && code !== 0xffff; code += 1) {
      let glyph;
      if (range === 0) glyph = (code + delta) & 0xffff;
      else {
        const glyphAt = rangeAt + range + (code - start) * 2;
        glyph = glyphAt + 2 <= cmap.length ? cmap.readUInt16BE(glyphAt) : 0;
        if (glyph) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph) map.set(code, glyph);
    }
  }
  return map;
}

// Bileşik glifler (ör. "İ", "ş") başka gliflere başvurur; onlar da alt kümeye girer.
function withComponents(font, used) {
  const all = new Set([0, ...used]);
  const queue = [...all];
  while (queue.length) {
    const gid = queue.pop();
    const [start, end] = font.glyphRange(gid);
    if (end - start < 10 || font.glyf.readInt16BE(start) >= 0) continue;
    let at = start + 10;
    for (;;) {
      const flags = font.glyf.readUInt16BE(at);
      const component = font.glyf.readUInt16BE(at + 2);
      if (!all.has(component)) {
        all.add(component);
        queue.push(component);
      }
      at += 4 + (flags & 0x1 ? 4 : 2) + (flags & 0x8 ? 2 : flags & 0x40 ? 4 : flags & 0x80 ? 8 : 0);
      if (!(flags & 0x20)) break;
    }
  }
  return all;
}

const checksum = buffer => {
  const padded = buffer.length % 4 ? Buffer.concat([buffer, Buffer.alloc(4 - (buffer.length % 4))]) : buffer;
  let sum = 0;
  for (let at = 0; at < padded.length; at += 4) sum = (sum + padded.readUInt32BE(at)) >>> 0;
  return sum;
};

export function subsetFont(font, used) {
  const keep = withComponents(font, used);
  const glyphs = [];
  const loca = Buffer.alloc((font.numGlyphs + 1) * 4);
  let offset = 0;
  for (let gid = 0; gid < font.numGlyphs; gid += 1) {
    loca.writeUInt32BE(offset, gid * 4);
    if (!keep.has(gid)) continue;
    const [start, end] = font.glyphRange(gid);
    if (end <= start) continue;
    const body = font.glyf.subarray(start, end);
    const pad = (4 - (body.length % 4)) % 4;
    glyphs.push(body, Buffer.alloc(pad));
    offset += body.length + pad;
  }
  loca.writeUInt32BE(offset, font.numGlyphs * 4);
  const head = Buffer.from(font.table("head"));
  head.writeUInt32BE(0, 8); // checkSumAdjustment: aşağıda hesaplanır
  head.writeInt16BE(1, 50); // uzun loca
  const tables = new Map([
    ["head", head],
    ["hhea", font.table("hhea")],
    ["maxp", font.table("maxp")],
    ["hmtx", font.table("hmtx")],
    ["loca", loca],
    ["glyf", Buffer.concat(glyphs)],
  ]);
  for (const tag of ["cvt ", "fpgm", "prep"]) if (font.table(tag)) tables.set(tag, font.table(tag));
  const tags = [...tables.keys()].sort();
  const count = tags.length;
  const power = 2 ** Math.floor(Math.log2(count));
  const header = Buffer.alloc(12 + count * 16);
  header.writeUInt32BE(0x00010000, 0);
  header.writeUInt16BE(count, 4);
  header.writeUInt16BE(power * 16, 6);
  header.writeUInt16BE(Math.log2(power), 8);
  header.writeUInt16BE(count * 16 - power * 16, 10);
  const parts = [header];
  let at = header.length;
  tags.forEach((tag, index) => {
    const body = tables.get(tag);
    const record = 12 + index * 16;
    header.write(tag, record, "latin1");
    header.writeUInt32BE(checksum(body), record + 4);
    header.writeUInt32BE(at, record + 8);
    header.writeUInt32BE(body.length, record + 12);
    const pad = (4 - (body.length % 4)) % 4;
    parts.push(body, Buffer.alloc(pad));
    at += body.length + pad;
  });
  const file = Buffer.concat(parts);
  const headAt = header.readUInt32BE(12 + tags.indexOf("head") * 16 + 8);
  file.writeUInt32BE((0xb1b0afba - checksum(file)) >>> 0, headAt + 8);
  return file;
}

// ---------------------------------------------------------------- PDF belgesi
const num = value => {
  const fixed = Number(value).toFixed(2);
  return fixed.replace(/\.?0+$/, "") || "0";
};
const hex4 = value => value.toString(16).padStart(4, "0").toUpperCase();
const utf16Hex = text => {
  let out = "FEFF";
  for (let index = 0; index < text.length; index += 1) out += hex4(text.charCodeAt(index));
  return `<${out}>`;
};
const rgb = color => {
  const value = String(color || "#000").replace("#", "");
  const full = value.length === 3 ? [...value].map(char => char + char).join("") : value;
  return [0, 2, 4].map(at => num(parseInt(full.slice(at, at + 2), 16) / 255)).join(" ");
};
const pdfDate = date => {
  const pad = value => String(value).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return `D:${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}${sign}${pad(Math.floor(Math.abs(offset) / 60))}'${pad(Math.abs(offset) % 60)}'`;
};

export class PdfDocument {
  constructor({ fonts, size = A4, title = "", author = "", subject = "" }) {
    this.size = size;
    this.info = { title, author, subject };
    this.fonts = Object.fromEntries(
      Object.entries(fonts).map(([key, font], index) => [key, { font, resource: `F${index + 1}`, used: new Map() }]),
    );
    this.pages = [];
  }

  // Metni glif numaralarına çevirir; yazı tipinde olmayan karakterler (ör. emoji) atlanır.
  glyphs(text, key) {
    const entry = this.fonts[key];
    const result = [];
    for (const char of String(text ?? "").normalize("NFC")) {
      const code = char.codePointAt(0);
      const gid = code < 32 ? 0 : entry.font.cmap.get(code) || 0;
      if (!gid) continue;
      result.push(gid);
      if (!entry.used.has(gid)) entry.used.set(gid, char);
    }
    return result;
  }

  measure(text, key = "regular", size = 10) {
    const font = this.fonts[key].font;
    let width = 0;
    for (const char of String(text ?? "").normalize("NFC")) {
      const code = char.codePointAt(0);
      const gid = code < 32 ? 0 : font.cmap.get(code) || 0;
      if (gid) width += font.width(gid);
    }
    return (width * size) / 1000;
  }

  // Satırlara böler (kelime sınırından; tek başına sığmayan uzun kelime harf harf bölünür).
  wrap(text, width, key = "regular", size = 10) {
    const lines = [];
    for (const paragraph of String(text ?? "").split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (this.measure(candidate, key, size) <= width) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        line = "";
        let rest = word;
        while (this.measure(rest, key, size) > width) {
          let cut = 1;
          while (cut < rest.length && this.measure(rest.slice(0, cut + 1), key, size) <= width) cut += 1;
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }
      lines.push(line);
    }
    return lines;
  }

  // Sığmayan metni "…" ile kısaltır.
  fit(text, width, key = "regular", size = 10) {
    const value = String(text ?? "");
    if (this.measure(value, key, size) <= width) return value;
    let cut = value.length;
    while (cut > 0 && this.measure(`${value.slice(0, cut)}…`, key, size) > width) cut -= 1;
    return `${value.slice(0, cut).trimEnd()}…`;
  }

  addPage() {
    const page = new PdfPage(this);
    this.pages.push(page);
    return page;
  }

  toBuffer({ now = new Date() } = {}) {
    const objects = [];
    const add = body => {
      objects.push(body);
      return objects.length;
    };
    const stream = (dictionary, data, compress = true) => {
      const body = compress ? deflateSync(data) : data;
      return Buffer.concat([Buffer.from(`<< ${dictionary}${compress ? " /Filter /FlateDecode" : ""} /Length ${body.length} >>\nstream\n`, "latin1"), body, Buffer.from("\nendstream", "latin1")]);
    };
    const catalog = add(null);
    const pagesId = add(null);
    const fontRefs = [];
    for (const entry of Object.values(this.fonts)) {
      if (!entry.used.size) continue;
      const { font } = entry;
      const gids = [...entry.used.keys()].sort((a, b) => a - b);
      const tag = [...createHash("sha1").update(`${font.name}:${gids.join(",")}`).digest()].slice(0, 6).map(byte => String.fromCharCode(65 + (byte % 26))).join("");
      const baseFont = `${tag}+${font.name}`;
      const program = subsetFont(font, gids);
      const fileId = add(stream(`/Length1 ${program.length}`, program));
      const m = font.metrics;
      const descriptorId = add(
        `<< /Type /FontDescriptor /FontName /${baseFont} /Flags 32 /FontBBox [${m.bbox.join(" ")}] /ItalicAngle 0 /Ascent ${m.ascent} /Descent ${m.descent} /CapHeight ${m.capHeight} /StemV ${m.bold ? 140 : 80} /FontFile2 ${fileId} 0 R >>`,
      );
      const widths = gids.map(gid => `${gid} [${font.width(gid)}]`).join(" ");
      const cidId = add(
        `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${baseFont} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptorId} 0 R /DW 1000 /W [${widths}] /CIDToGIDMap /Identity >>`,
      );
      const unicode = char => {
        let out = "";
        for (let index = 0; index < char.length; index += 1) out += hex4(char.charCodeAt(index));
        return out;
      };
      const chunks = [];
      for (let index = 0; index < gids.length; index += 100) {
        const part = gids.slice(index, index + 100);
        chunks.push(`${part.length} beginbfchar\n${part.map(gid => `<${hex4(gid)}> <${unicode(entry.used.get(gid))}>`).join("\n")}\nendbfchar`);
      }
      const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${chunks.join("\n")}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
      const toUnicodeId = add(stream("", Buffer.from(cmap, "latin1")));
      const fontId = add(`<< /Type /Font /Subtype /Type0 /BaseFont /${baseFont} /Encoding /Identity-H /DescendantFonts [${cidId} 0 R] /ToUnicode ${toUnicodeId} 0 R >>`);
      fontRefs.push(`/${entry.resource} ${fontId} 0 R`);
    }
    const resources = `<< /Font << ${fontRefs.join(" ")} >> >>`;
    const pageIds = this.pages.map(page => {
      const contentId = add(stream("", Buffer.from(page.ops.join("\n"), "latin1")));
      return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(this.size.width)} ${num(this.size.height)}] /Resources ${resources} /Contents ${contentId} 0 R >>`);
    });
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
    objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R /ViewerPreferences << /DisplayDocTitle true >> /Lang (tr-TR) >>`;
    const infoParts = [`/Producer ${utf16Hex("DestekOfis")}`, `/CreationDate (${pdfDate(now)})`];
    if (this.info.title) infoParts.push(`/Title ${utf16Hex(this.info.title)}`);
    if (this.info.author) infoParts.push(`/Author ${utf16Hex(this.info.author)}`);
    if (this.info.subject) infoParts.push(`/Subject ${utf16Hex(this.info.subject)}`);
    const infoId = add(`<< ${infoParts.join(" ")} >>`);

    const chunks = [Buffer.from("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n", "latin1")];
    let length = chunks[0].length;
    const offsets = [];
    objects.forEach((body, index) => {
      offsets.push(length);
      const buffer = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, "latin1"), Buffer.isBuffer(body) ? body : Buffer.from(body, "latin1"), Buffer.from("\nendobj\n", "latin1")]);
      chunks.push(buffer);
      length += buffer.length;
    });
    const id = createHash("md5").update(Buffer.concat(chunks)).digest("hex").toUpperCase();
    const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${infoId} 0 R /ID [<${id}> <${id}>] >>\nstartxref\n${length}\n%%EOF\n`;
    chunks.push(Buffer.from(xref, "latin1"));
    return Buffer.concat(chunks);
  }
}

class PdfPage {
  constructor(doc) {
    this.doc = doc;
    this.ops = [];
  }

  y(top) {
    return this.doc.size.height - top;
  }

  // top: metnin taban çizgisi (baseline) yüksekliği, sol üstten.
  text(x, top, value, { font = "regular", size = 10, color = "#1f2937", align = "left", width = 0 } = {}) {
    const glyphs = this.doc.glyphs(value, font);
    if (!glyphs.length) return this;
    let left = x;
    if (align !== "left" && width) {
      const measured = this.doc.measure(value, font, size);
      left = align === "right" ? x + width - measured : x + (width - measured) / 2;
    }
    this.ops.push(`BT ${rgb(color)} rg /${this.doc.fonts[font].resource} ${num(size)} Tf 1 0 0 1 ${num(left)} ${num(this.y(top))} Tm <${glyphs.map(hex4).join("")}> Tj ET`);
    return this;
  }

  rect(x, top, width, height, { fill = null, stroke = null, lineWidth = 0.6, radius = 0 } = {}) {
    const bottom = this.y(top + height);
    const parts = ["q"];
    if (fill) parts.push(`${rgb(fill)} rg`);
    if (stroke) parts.push(`${rgb(stroke)} RG ${num(lineWidth)} w`);
    if (radius) {
      const r = Math.min(radius, width / 2, height / 2);
      const k = r * 0.5523;
      const [l, b, rr, t] = [x, bottom, x + width, bottom + height];
      parts.push(
        `${num(l + r)} ${num(b)} m ${num(rr - r)} ${num(b)} l ${num(rr - r + k)} ${num(b)} ${num(rr)} ${num(b + r - k)} ${num(rr)} ${num(b + r)} c`,
        `${num(rr)} ${num(t - r)} l ${num(rr)} ${num(t - r + k)} ${num(rr - r + k)} ${num(t)} ${num(rr - r)} ${num(t)} c`,
        `${num(l + r)} ${num(t)} l ${num(l + r - k)} ${num(t)} ${num(l)} ${num(t - r + k)} ${num(l)} ${num(t - r)} c`,
        `${num(l)} ${num(b + r)} l ${num(l)} ${num(b + r - k)} ${num(l + r - k)} ${num(b)} ${num(l + r)} ${num(b)} c h`,
      );
    } else parts.push(`${num(x)} ${num(bottom)} ${num(width)} ${num(height)} re`);
    parts.push(fill && stroke ? "B" : fill ? "f" : "S", "Q");
    this.ops.push(parts.join(" "));
    return this;
  }

  line(x1, top1, x2, top2, { color = "#d1d5db", width = 0.6 } = {}) {
    this.ops.push(`q ${rgb(color)} RG ${num(width)} w ${num(x1)} ${num(this.y(top1))} m ${num(x2)} ${num(this.y(top2))} l S Q`);
    return this;
  }
}
