// 2.4.3 — form durumu izole (kullanıcı kararı 17.10.2026: "Dosya/resim yükleme işlemleri formun genel state'ini re-render etmesin ve
// uncommitted (kaydedilmemiş) verileri ezmesin"). Kaynak tarama testi: istemcideki her dosya / resim seçimi işleyicisi (input.files,
// dataTransfer.files) — doğrudan ya da çağırdığı aynı dosyadaki işlevler üzerinden — dosya seçme kutusunu (type="file") içeren formu
// yeniden çizen bir işlevi çağırmaz. Böyle bir çağrı formu kayıtlı veriden yeniden kurar ve kullanıcının yazdıklarını siler (D1: Fatura
// Ayarları'nda Logo / Kaşe seçimi renderSettings() ile unvan, adres, IBAN… alanlarını eski değerine döndürüyordu).
// Ayrıca ortak çekirdeğin taslak koruması yerinde mi (HOF.swap → keepFocus → taslak geri yazımı; pencere kapanırken ortak soru).
// Satırlar /\r?\n/ ile bölünür; Windows'ta git CRLF çıkarır (ders 27).
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";

const ASSETS = new URL("../client/assets/", import.meta.url);
const FILES = readdirSync(ASSETS).filter(name => /^(hof-[a-z-]+|admin)\.js$/.test(name) && name !== "hof-excel-worker.js");
const read = name => readFileSync(new URL(name, ASSETS), "utf8");

// Kod maskesi: yorumlar, dizgiler, şablon metni ve düzenli ifadeler boşlukla değiştirilir (konumlar korunur); şablonun ${…} kısmı koddur.
export function maskCode(source) {
  const out = source.split("");
  const blank = (from, to) => {
    for (let i = from; i < to; i += 1) if (out[i] !== "\n" && out[i] !== "\r") out[i] = " ";
  };
  let i = 0;
  const stack = []; // şablon içindeki ${ derinlikleri
  let lastSignificant = "";
  const regexAllowed = () => !lastSignificant || /[(,=:[!&|?{};+\-*%<>~^]$/.test(lastSignificant) || /\b(return|typeof|case|in|of|delete|void|throw|new|else|do|yield|await)$/.test(lastSignificant);
  const readTemplate = start => {
    // start: ` karakterinin konumu; ${ görünce koda döner (yığına yazar).
    let j = start + 1;
    while (j < source.length) {
      const ch = source[j];
      if (ch === "\\") {
        j += 2;
        continue;
      }
      if (ch === "`") {
        blank(start + 1, j);
        return { end: j + 1, open: false };
      }
      if (ch === "$" && source[j + 1] === "{") {
        blank(start + 1, j);
        return { end: j + 2, open: true };
      }
      j += 1;
    }
    blank(start + 1, source.length);
    return { end: source.length, open: false };
  };
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      const stop = end < 0 ? source.length : end;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end < 0 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < source.length && source[j] !== ch && source[j] !== "\n") j += source[j] === "\\" ? 2 : 1;
      blank(i + 1, j);
      i = j + 1;
      lastSignificant = "a";
      continue;
    }
    if (ch === "`") {
      const part = readTemplate(i);
      if (part.open) stack.push(0);
      i = part.end;
      lastSignificant = part.open ? "{" : "a";
      continue;
    }
    if (ch === "/" && regexAllowed()) {
      let j = i + 1;
      let inClass = false;
      while (j < source.length && source[j] !== "\n") {
        if (source[j] === "\\") {
          j += 2;
          continue;
        }
        if (source[j] === "[") inClass = true;
        else if (source[j] === "]") inClass = false;
        else if (source[j] === "/" && !inClass) break;
        j += 1;
      }
      blank(i + 1, j);
      i = j + 1;
      while (/[a-z]/i.test(source[i] || "")) i += 1;
      lastSignificant = "a";
      continue;
    }
    if (stack.length) {
      if (ch === "{") stack[stack.length - 1] += 1;
      else if (ch === "}") {
        if (stack[stack.length - 1] === 0) {
          // ${…} bitti: şablon metni sürer.
          stack.pop();
          const part = readTemplate(i);
          if (part.open) stack.push(0);
          i = part.end;
          lastSignificant = part.open ? "{" : "a";
          continue;
        }
        stack[stack.length - 1] -= 1;
      }
    }
    if (!/\s/.test(ch)) {
      lastSignificant = /[\w$]/.test(ch) ? (/[\w$]/.test(lastSignificant.slice(-1)) ? lastSignificant + ch : ch) : ch;
      if (lastSignificant.length > 20) lastSignificant = lastSignificant.slice(-20);
    }
    i += 1;
  }
  return out.join("");
}

const matchBrace = (code, open) => {
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}") {
      depth -= 1;
      if (!depth) return i;
    }
  }
  return code.length;
};
// Bir ifade gövdesinin sonu: parantez derinliği 0'da ilk ";" ya da "," ya da kapanan parantez / yeni satır.
const expressionEnd = (code, from) => {
  let depth = 0;
  for (let i = from; i < code.length; i += 1) {
    const ch = code[i];
    if ("([{".includes(ch)) depth += 1;
    else if (")]}".includes(ch)) {
      if (!depth) return i;
      depth -= 1;
    } else if (!depth && (ch === ";" || ch === "," || ch === "\n")) return i;
  }
  return code.length;
};

/** Dosyadaki işlevler: { name, start, end } (adsızlar name ""). */
export function functionsOf(code) {
  const out = [];
  for (const match of code.matchAll(/\bfunction\b\s*\*?\s*([\w$]*)\s*\(/g)) {
    const open = code.indexOf("{", code.indexOf(")", match.index + match[0].length - 1));
    out.push({ name: match[1] || "", start: match.index, end: matchBrace(code, open) });
  }
  for (const match of code.matchAll(/=>/g)) {
    // Ok işlevinin adı: "const ad = (…) =>" ya da "ad: (…) =>".
    const head = code.slice(Math.max(0, match.index - 240), match.index);
    const named = /(?:\b(?:const|let|var)\s+([\w$]+)\s*=|([\w$]+)\s*:)\s*(?:async\s*)?(?:\([^()]*(?:\([^()]*\)[^()]*)*\)|[\w$]+)\s*$/.exec(head);
    let bodyStart = match.index + 2;
    while (/\s/.test(code[bodyStart] || "")) bodyStart += 1;
    const end = code[bodyStart] === "{" ? matchBrace(code, bodyStart) : expressionEnd(code, bodyStart);
    out.push({ name: named ? named[1] || named[2] : "", start: named ? match.index - (head.length - named.index) : match.index, end });
  }
  return out;
}

const FILE_INPUT = /type=\\?"file\\?"|type:\s*["']file["']/;
// Dosya seçme kutusunu içeren formu yeniden çizen işlev: kaynak aralığında type="file" işaretini üretir.
function offendersOf(name) {
  const source = read(name);
  const code = maskCode(source);
  const fns = functionsOf(code);
  const named = new Map();
  for (const fn of fns) if (fn.name && !named.has(fn.name)) named.set(fn.name, fn);
  const handlers = [];
  for (const hit of code.matchAll(/\.files\b/g)) {
    const around = fns.filter(fn => fn.start <= hit.index && hit.index <= fn.end).sort((a, b) => a.end - a.start - (b.end - b.start));
    if (around[0]) handlers.push({ fn: around[0], at: hit.index });
  }
  const problems = [];
  for (const { fn, at } of handlers) {
    // İşleyicinin çağırdığı adlı işlevler (aynı dosyada, 3 adım derinliğe kadar).
    const seen = new Set();
    let frontier = [fn];
    for (let depth = 0; depth < 4 && frontier.length; depth += 1) {
      const nextFrontier = [];
      for (const current of frontier) {
        const range = code.slice(current.start, current.end + 1);
        // İşlevin kendi kaynağı type="file" üretiyorsa (başlangıç işleyicisi dışında) form yeniden çiziliyor demektir.
        if (current !== fn && FILE_INPUT.test(source.slice(current.start, current.end + 1))) {
          problems.push(`${name}:${source.slice(0, at).split(/\r?\n/).length} dosya seçimi işleyicisi "${fn.name || "(adsız)"}" ${depth + 1}. adımda ${current.name}() çağırıyor: type="file" içeren formu yeniden çiziyor`);
          continue;
        }
        for (const call of range.matchAll(/(?<![\w$.])([\w$]+)\s*\(/g)) {
          const target = named.get(call[1]);
          if (!target || target === current || seen.has(target.name)) continue;
          // İşlevin içinde tanımlanan iç işlevler kendi kapsamıdır; dışarıdaki aynı adlı işlev değildir.
          if (target.start >= current.start && target.end <= current.end) continue;
          seen.add(target.name);
          nextFrontier.push(target);
        }
      }
      frontier = nextFrontier;
    }
  }
  return { handlers, problems };
}

describe("form izolasyonu (2.4.3) — kaynak taraması", () => {
  it("kod maskesi şablonun ${…} kısmını kod sayar, metni ve yorumu boşaltır", () => {
    const sample = 'const a = `x ${b({ c: "}" })} y`; // { yorum\nfunction f() { return /}/.test(a); }\n';
    const masked = maskCode(sample);
    assert.equal(masked.length, sample.length);
    assert.equal((masked.match(/\{/g) || []).length, (masked.match(/\}/g) || []).length, masked);
    const fns = functionsOf(masked);
    const f = fns.find(fn => fn.name === "f");
    assert.ok(f, "f bulundu");
    assert.equal(masked.slice(f.end, f.end + 1), "}");
    assert.ok(maskCode("a\r\nb // c\r\n").split(/\r?\n/).length === 3, "CRLF satırları korunur");
  });

  it("dosya / resim seçimi işleyicileri bulunuyor (test boşa geçmesin)", () => {
    const found = Object.fromEntries(FILES.map(name => [name, offendersOf(name).handlers.length]));
    for (const name of ["hof-invoices.js", "hof-documents.js", "hof-free.js", "hof-sources.js", "hof-plans.js"]) assert.ok(found[name] > 0, `${name} içinde dosya seçimi işleyicisi bulunamadı: ${JSON.stringify(found)}`);
    // Fatura Ayarları'nda Logo ve Kaşe / İmza seçimi (D1).
    const invoices = offendersOf("hof-invoices.js").handlers.length;
    assert.ok(invoices >= 1, `hof-invoices.js: ${invoices}`);
  });

  it("hiçbir dosya seçimi işleyicisi dosya kutusunu içeren formu yeniden çizmez (D1)", () => {
    const problems = FILES.flatMap(name => offendersOf(name).problems);
    assert.deepEqual(problems, [], `Dosya seçimi formu yeniden çiziyor:\n${problems.join("\n")}`);
  });

  it("Fatura Ayarları: Logo / Kaşe seçme ve kaldırma renderSettings() çağırmaz", () => {
    const source = read("hof-invoices.js");
    const code = maskCode(source);
    const fns = functionsOf(code);
    const lines = [];
    for (const label of ["pickLogo", "pickStamp", "pickImage", "paintImageBox"]) {
      const fn = fns.find(item => item.name === label);
      if (!fn) continue;
      lines.push(label);
      assert.ok(!/\brenderSettings\s*\(/.test(code.slice(fn.start, fn.end + 1)), `${label} renderSettings() çağırıyor`);
    }
    assert.ok(lines.includes("pickLogo") && lines.includes("pickStamp"), `pickLogo / pickStamp bulunamadı: ${lines}`);
    // Logoyu / kaşeyi kaldırma düğmesi de formu yeniden çizmez.
    const action = fns.find(item => item.name === "settingsAction");
    assert.ok(action, "settingsAction bulunamadı");
    const body = code.slice(action.start, action.end + 1);
    const clear = /if\s*\(\s*act\s*===\s*"logo-clear"[\s\S]*?\n {4}\}/.exec(source.slice(action.start, action.end + 1));
    assert.ok(clear, "logo-clear dalı bulunamadı");
    assert.ok(!/renderSettings\s*\(/.test(clear[0]), `Logoyu Kaldır renderSettings() çağırıyor:\n${clear[0]}`);
    assert.ok(body.length > 0);
  });

  it("ortak çekirdek: HOF.swap taslağı korur, pencere kapanırken kaydedilmemiş değişikliği sorar", () => {
    const core = read("hof-core.js");
    const keep = /HOF\.keepFocus\s*=\s*\(root, render\)\s*=>\s*\{([\s\S]*?)\n {2}\};/.exec(core);
    assert.ok(keep, "HOF.keepFocus bulunamadı");
    assert.match(keep[1], /draftSnapshot\(root\)/, "keepFocus yeniden çizimden önce taslağı almıyor");
    assert.match(keep[1], /draftRestore\(root, drafts\)/, "keepFocus yeniden çizimden sonra taslağı geri yazmıyor");
    const modal = /HOF\.modal\s*=\s*\(([\s\S]*?)\n {2}\};/.exec(core);
    assert.ok(modal, "HOF.modal bulunamadı");
    assert.match(modal[0], /isDirty\(\)\s*\?\s*HOF\.closeQuestion\(\)/, "kullanıcının kapatması kaydedilmemiş değişikliği sormuyor");
    assert.match(core, /addEventListener\("beforeunload"/, "F5 / sekme kapatma sorusu yok");
    assert.match(core, /addEventListener\("popstate"/, "Geri tuşu açık pencereyi kapatmıyor");
  });
});
