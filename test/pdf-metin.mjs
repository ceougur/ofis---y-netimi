// Bağımlılıksız, en küçük PDF metin okuyucu (yalnız testler için): Chromium/Skia'nın page.pdf ile ürettiği kılavuz PDF'i
// (docs/kilavuz/pdf-uret.mjs) okunur. pdftotext (poppler) Windows CI koşucusunda yok; bu okuyucu yalnız Node'un zlib'ini kullanır.
// Kapsam: düz (sıkıştırılmamış) nesne tablosu, FlateDecode akışlar, sayfa /Resources → /Font → /ToUnicode (bfchar/bfrange),
// içerik akışında Tf + Tj/TJ (onaltılı ya da parantezli dizgi). Nesne akışı (ObjStm) ya da şifreli PDF desteklenmez → hata atar
// (sessizce boş metin dönmez; ders 4). Sayfalar belge sırasıyla, sayfa içi metin akış sırasıyla; satırlar "\n" ile birleşir.
import { inflateSync } from "node:zlib";

export function pdfText(buffer) {
  const src = buffer.toString("latin1");
  if (/\/Encrypt\s/.test(src)) throw new Error("şifreli PDF okunamaz");
  if (/\/Type\s*\/ObjStm/.test(src)) throw new Error("nesne akışlı (ObjStm) PDF desteklenmiyor");
  const objects = new Map();
  const head = /(?:^|[\r\n\s])(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = head.exec(src))) {
    const start = m.index + m[0].length;
    const streamAt = src.indexOf("stream", start);
    const endAt = src.indexOf("endobj", start);
    if (endAt < 0) break;
    let dict = src.slice(start, endAt);
    let stream = null;
    if (streamAt >= 0 && streamAt < endAt) {
      dict = src.slice(start, streamAt);
      let dataStart = streamAt + 6;
      if (src[dataStart] === "\r") dataStart++;
      if (src[dataStart] === "\n") dataStart++;
      const lenMatch = /\/Length\s+(\d+)(\s+\d+\s+R)?/.exec(dict);
      let length = lenMatch && !lenMatch[2] ? Number(lenMatch[1]) : -1;
      if (length < 0) length = src.indexOf("endstream", dataStart) - dataStart; // dolaylı uzunluk: endstream'e kadar
      stream = buffer.subarray(dataStart, dataStart + length);
      const close = src.indexOf("endobj", dataStart + length);
      head.lastIndex = close < 0 ? src.length : close;
    } else head.lastIndex = endAt;
    objects.set(Number(m[1]), { dict, stream });
  }
  if (!objects.size) throw new Error("PDF nesnesi bulunamadı");
  const resolve = value => { const r = /^\s*(\d+)\s+\d+\s+R/.exec(value || ""); return r ? objects.get(Number(r[1])) : null; };
  const decode = obj => {
    if (!obj?.stream) return "";
    if (/\/Filter\s*\/FlateDecode/.test(obj.dict)) return inflateSync(obj.stream).toString("latin1");
    if (/\/Filter/.test(obj.dict)) throw new Error("desteklenmeyen akış süzgeci");
    return obj.stream.toString("latin1");
  };
  // << … >> sözlüğünden bir anahtarın değerini (iç içe sözlük dahil) çıkarır.
  const dictValue = (dict, key) => {
    const at = dict.search(new RegExp(`/${key}(?![A-Za-z0-9])`));
    if (at < 0) return null;
    let i = at + key.length + 1;
    while (/\s/.test(dict[i])) i++;
    if (dict.startsWith("<<", i)) {
      let depth = 0, j = i;
      for (; j < dict.length; j++) {
        if (dict.startsWith("<<", j)) { depth++; j++; } else if (dict.startsWith(">>", j)) { depth--; j++; if (!depth) break; }
      }
      return dict.slice(i, j + 1);
    }
    return /^[^/>\]]*/.exec(dict.slice(i))[0].trim();
  };
  const cmapCache = new Map();
  const toUnicode = fontObj => {
    if (cmapCache.has(fontObj)) return cmapCache.get(fontObj);
    const map = new Map();
    let width = 2;
    const cmapObj = resolve(dictValue(fontObj.dict, "ToUnicode"));
    if (cmapObj) {
      const cmap = decode(cmapObj);
      const hexToStr = hex => { let s = ""; for (let k = 0; k + 4 <= hex.length; k += 4) s += String.fromCharCode(parseInt(hex.slice(k, k + 4), 16)); return s; };
      const range = /begincodespacerange\s*<([0-9A-Fa-f]+)>/.exec(cmap);
      if (range) width = range[1].length / 2;
      for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
        for (const e of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g)) map.set(parseInt(e[1], 16), hexToStr(e[2]));
      for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))
        for (const e of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<([0-9A-Fa-f]+)>|\[([^\]]*)\])/g)) {
          const lo = parseInt(e[1], 16), hi = parseInt(e[2], 16);
          if (e[4] !== undefined) { const base = parseInt(e[4], 16); for (let c = lo; c <= hi; c++) map.set(c, String.fromCharCode(base + c - lo)); }
          else [...e[5].matchAll(/<([0-9A-Fa-f]*)>/g)].forEach((x, k) => map.set(lo + k, hexToStr(x[1])));
        }
    } else width = 1;
    const out = { map, width, hasMap: Boolean(cmapObj) };
    cmapCache.set(fontObj, out);
    return out;
  };
  const literalBytes = lit => {
    const bytes = [];
    for (let i = 0; i < lit.length; i++) {
      const ch = lit[i];
      if (ch !== "\\") { bytes.push(ch.charCodeAt(0) & 0xff); continue; }
      const n = lit[++i];
      const esc = { n: 10, r: 13, t: 9, b: 8, f: 12, "(": 40, ")": 41, "\\": 92 }[n];
      if (esc !== undefined) bytes.push(esc);
      else if (/[0-7]/.test(n)) { let oct = n; while (oct.length < 3 && /[0-7]/.test(lit[i + 1])) oct += lit[++i]; bytes.push(parseInt(oct, 8) & 0xff); }
      else if (n === "\r" || n === "\n") { if (n === "\r" && lit[i + 1] === "\n") i++; }
      else bytes.push(n.charCodeAt(0) & 0xff);
    }
    return bytes;
  };
  const show = (bytes, font) => {
    if (!font || !font.hasMap) return String.fromCharCode(...bytes);
    let s = "";
    for (let i = 0; i + font.width <= bytes.length; i += font.width) {
      let code = 0;
      for (let k = 0; k < font.width; k++) code = code * 256 + bytes[i + k];
      s += font.map.get(code) ?? "";
    }
    return s;
  };
  const hexBytes = hex => { const h = hex.replace(/\s+/g, ""); const p = h.length % 2 ? `${h}0` : h; const b = []; for (let k = 0; k < p.length; k += 2) b.push(parseInt(p.slice(k, k + 2), 16)); return b; };
  // Sayfa sırası: kök /Pages ağacı; bulunamazsa nesne sırası.
  const pages = [];
  const walk = obj => {
    if (!obj) return;
    if (/\/Type\s*\/Pages\b/.test(obj.dict)) for (const ref of (dictValue(obj.dict, "Kids") || /\/Kids\s*\[([^\]]*)\]/.exec(obj.dict)?.[1] || "").matchAll(/(\d+)\s+\d+\s+R/g)) walk(objects.get(Number(ref[1])));
    else if (/\/Type\s*\/Page\b/.test(obj.dict)) pages.push(obj);
  };
  const catalog = [...objects.values()].find(o => /\/Type\s*\/Catalog\b/.test(o.dict));
  walk(catalog && resolve(dictValue(catalog.dict, "Pages")));
  if (!pages.length) for (const o of objects.values()) if (/\/Type\s*\/Page\b/.test(o.dict)) pages.push(o);
  if (!pages.length) throw new Error("PDF sayfası bulunamadı");
  const texts = [];
  for (const page of pages) {
    let resources = dictValue(page.dict, "Resources") || "";
    if (/^\d+\s+\d+\s+R/.test(resources)) resources = resolve(resources)?.dict || "";
    let fontDict = dictValue(resources, "Font") || "";
    if (/^\d+\s+\d+\s+R/.test(fontDict)) fontDict = resolve(fontDict)?.dict || "";
    const fonts = new Map([...fontDict.matchAll(/\/([^\s/<>\[\]()]+)\s+(\d+)\s+\d+\s+R/g)].map(f => [f[1], objects.get(Number(f[2]))]));
    const contentsVal = dictValue(page.dict, "Contents") || "";
    const refs = [...(/^\[/.test(contentsVal) ? /\/Contents\s*\[([^\]]*)\]/.exec(page.dict)[1] : contentsVal).matchAll(/(\d+)\s+\d+\s+R/g)];
    const content = refs.map(r => decode(objects.get(Number(r[1])))).join("\n");
    let font = null, line = "";
    const lines = [];
    // Belirteçler: dizgi (…), <onaltılı>, dizi [ … ], ad /X, sayı, işleç.
    const tok = /\((?:\\[\s\S]|[^\\()]|\((?:\\[\s\S]|[^\\()])*\))*\)|<<|>>|<[0-9A-Fa-f\s]*>|\[|\]|\/[^\s/<>\[\]()]+|[-+.\d]+|[A-Za-z'"*]+/g;
    const stack = [];
    let t;
    while ((t = tok.exec(content))) {
      const v = t[0];
      if (v === "Tf") { const name = stack.filter(x => x.startsWith("/")).pop()?.slice(1); const fo = fonts.get(name); font = fo ? toUnicode(fo) : null; stack.length = 0; }
      else if (v === "Tj" || v === "'" || v === "\"" || v === "TJ") {
        if (v !== "Tj" && v !== "TJ" && line) { lines.push(line); line = ""; }
        for (const s of stack) {
          if (s.startsWith("(")) line += show(literalBytes(s.slice(1, -1)), font);
          else if (s.startsWith("<") && !s.startsWith("<<")) line += show(hexBytes(s.slice(1, -1)), font);
          else if (v === "TJ" && /^[-+.\d]+$/.test(s) && Number(s) < -200) line += " ";
        }
        stack.length = 0;
      } else if (v === "Td" || v === "TD" || v === "T*" || v === "Tm" || v === "ET") {
        if (v === "Td" || v === "TD") { const dy = Number(stack[stack.length - 1]); if (dy !== 0 && line) { lines.push(line); line = ""; } else if (line && !line.endsWith(" ")) line += ""; }
        else if (line) { lines.push(line); line = ""; }
        stack.length = 0;
      } else if (/^[A-Za-z'"*]+$/.test(v) && v !== "R" && v !== "true" && v !== "false" && v !== "null") stack.length = 0;
      else stack.push(v);
    }
    if (line) lines.push(line);
    texts.push(lines.join("\n"));
  }
  return texts.join("\n\f");
}
