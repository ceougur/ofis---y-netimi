// K6 statik katmanı (docs/BANKA-MODULU-PLAN.md §3.3/a) için küçük JavaScript tarayıcısı (bağımlılıksız).
// Kaynaktaki her SQL yazım yerini (INSERT/UPDATE/DELETE/REPLACE + tablo) bulur, içinde bulunduğu adlı işlevi ve bir
// bank.post(...) çağrısının argümanları içinde olup olmadığını söyler. Yorumlar ve dizgi/şablon içerikleri ayrıştırılır;
// düzenli ifade (regex) değişmezleri atlanır (içlerindeki tırnak/ters tırnak dizgi sanılmaz).

/** Kaynağı tarar: { mask, strings } — mask: yorum ve dizgi içerikleri boşlukla örtülü kod (parantez/küme eşleştirmesi için);
 * strings: her dizgi ya da şablon değişmezinin { start, end, text } bilgisi (text tırnaklar hariç, ${…} ifadeleri olduğu gibi). */
export function lex(source) {
  const mask = source.split("");
  const strings = [];
  const blank = (from, to) => {
    for (let k = from; k < to; k += 1) if (mask[k] !== "\n") mask[k] = " ";
  };
  let i = 0;
  let lastSignificant = "";
  const regexAllowed = () => !lastSignificant || /[(,=:[!&|?{};+\-*%<>~^]$/.test(lastSignificant) || /\b(return|typeof|case|do|else|in|of|void|yield|await)$/.test(lastSignificant);
  // Şablon içindeki ${ … } ifadesi: kapanan }'yi bulur (iç içe dizgi ve şablonlarla).
  function skipExpression(start) {
    let depth = 1;
    let k = start;
    while (k < source.length && depth > 0) {
      const ch = source[k];
      if (ch === "'" || ch === '"') k = skipQuoted(k, ch);
      else if (ch === "`") k = skipTemplate(k).end;
      else {
        if (ch === "{") depth += 1;
        else if (ch === "}") depth -= 1;
        k += 1;
      }
    }
    return k;
  }
  function skipQuoted(start, quote) {
    let k = start + 1;
    while (k < source.length && source[k] !== quote) {
      if (source[k] === "\\") k += 1;
      else if (source[k] === "\n") break;
      k += 1;
    }
    return k + 1;
  }
  function skipTemplate(start) {
    let k = start + 1;
    while (k < source.length && source[k] !== "`") {
      if (source[k] === "\\") k += 2;
      else if (source[k] === "$" && source[k + 1] === "{") k = skipExpression(k + 2);
      else k += 1;
    }
    return { end: k + 1 };
  }
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
    if (ch === "'" || ch === '"') {
      const end = skipQuoted(i, ch);
      strings.push({ start: i, end, text: source.slice(i + 1, end - 1) });
      blank(i + 1, end - 1);
      i = end;
      lastSignificant = "x";
      continue;
    }
    if (ch === "`") {
      const { end } = skipTemplate(i);
      strings.push({ start: i, end, text: source.slice(i + 1, end - 1) });
      blank(i + 1, end - 1);
      i = end;
      lastSignificant = "x";
      continue;
    }
    if (ch === "/" && regexAllowed()) {
      // Düzenli ifade değişmezi: sınıf ([…]) içindeki / sonlandırmaz.
      let k = i + 1;
      let inClass = false;
      while (k < source.length && source[k] !== "\n") {
        if (source[k] === "\\") k += 2;
        else if (inClass) {
          if (source[k] === "]") inClass = false;
          k += 1;
        } else if (source[k] === "[") {
          inClass = true;
          k += 1;
        } else if (source[k] === "/") break;
        else k += 1;
      }
      if (source[k] === "/") {
        k += 1;
        while (/[a-z]/i.test(source[k] || "")) k += 1;
        blank(i, k);
        i = k;
        lastSignificant = "x";
        continue;
      }
    }
    if (!/\s/.test(ch)) {
      // Anahtar sözcüklerden sonra (return /x/) düzenli ifade gelebilir: son belirgin parça kelime olarak tutulur.
      if (/[A-Za-z_$]/.test(ch)) {
        let k = i;
        while (k < source.length && /[\w$]/.test(source[k])) k += 1;
        lastSignificant = source.slice(i, k);
        i = k;
        continue;
      }
      lastSignificant = ch;
    }
    i += 1;
  }
  return { mask: mask.join(""), strings };
}

/** Örtülü kodda açılış parantezinin/kümesinin eşini bulur (konum; bulunamazsa -1). */
export function matchClose(mask, open) {
  const pairs = { "(": ")", "{": "}", "[": "]" };
  const want = pairs[mask[open]];
  if (!want) return -1;
  let depth = 0;
  for (let k = open; k < mask.length; k += 1) {
    const ch = mask[k];
    if (ch === "(" || ch === "{" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) return ch === want ? k : -1;
    }
  }
  return -1;
}

const CONTROL = new Set(["if", "for", "while", "switch", "catch", "function", "return", "typeof", "await", "async", "new", "else", "do", "try", "with"]);

/** Adlı işlev gövdeleri: { name, start, end } (start = gövdenin {'si). */
export function functionRanges(mask, source) {
  const out = [];
  const bodyAfterParams = (paramsOpen, name) => {
    const close = matchClose(mask, paramsOpen);
    if (close < 0) return;
    let k = close + 1;
    while (/\s/.test(mask[k] || "")) k += 1;
    if (mask.startsWith("=>", k)) {
      k += 2;
      while (/\s/.test(mask[k] || "")) k += 1;
    }
    if (mask[k] !== "{") return;
    const end = matchClose(mask, k);
    if (end > 0) out.push({ name, start: k, end });
  };
  // function ad( … ) { … }
  for (const m of mask.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g)) bodyAfterParams(m.index + m[0].length - 1, m[1]);
  // const ad = (async) ( … ) => { … }  |  const ad = (async) function ( … ) { … }  |  ad: (async) ( … ) => { … }
  for (const m of mask.matchAll(/(?:\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=|([A-Za-z_$][\w$]*)\s*:)\s*(?:async\s*)?(?:function\s*\*?\s*[\w$]*\s*)?\(/g)) bodyAfterParams(m.index + m[0].length - 1, m[1] || m[2]);
  // const ad = (async) x => { … }
  for (const m of mask.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?[A-Za-z_$][\w$]*\s*=>\s*\{/g)) {
    const open = m.index + m[0].length - 1;
    const end = matchClose(mask, open);
    if (end > 0) out.push({ name: m[1], start: open, end });
  }
  // nesne yöntemi: ad( … ) { … }  (satır başında; denetim sözcükleri hariç)
  for (const m of mask.matchAll(/(^|[\n{,;])\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (CONTROL.has(m[2])) continue;
    bodyAfterParams(m.index + m[0].length - 1, m[2]);
  }
  // router.post("/api/…", async (…) => { … })
  for (const m of mask.matchAll(/\brouter\.(get|post|put|delete|patch)\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const close = matchClose(mask, open);
    if (close < 0) continue;
    const literal = /^\s*["'`]([^"'`]*)["'`]/.exec(source.slice(open + 1, close));
    const arrow = mask.indexOf("=>", open);
    if (arrow < 0 || arrow > close) continue;
    let k = arrow + 2;
    while (/\s/.test(mask[k] || "")) k += 1;
    if (mask[k] !== "{") continue;
    const end = matchClose(mask, k);
    if (end > 0) out.push({ name: `${m[1].toUpperCase()} ${literal ? literal[1] : "?"}`, start: k, end });
  }
  return out;
}

const WRITE = /(INSERT(?:\s+OR\s+\w+)?\s+INTO|UPDATE(?:\s+OR\s+\w+)?|DELETE\s+FROM|REPLACE\s+INTO)\s+["`]?(?:main\.)?(\$\{|\w+)/gi;

/**
 * Kaynaktaki yazım yerleri: { line, table ('$' = dinamik), verb, fn (en içteki adlı işlev; yoksa ""), inPost, set (UPDATE'in SET
 * kolonları; çözülemeyen ifade "?") }.
 * tables: para tabloları kümesi; yalnız onlara (ya da tablo adı dinamik olanlara) yazan yerler döner.
 */
export function writeSites(source, tables) {
  const { mask, strings } = lex(source);
  const fns = functionRanges(mask, source);
  const posts = [];
  for (const m of mask.matchAll(/\bbank\s*\.\s*post\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const close = matchClose(mask, open);
    if (close > 0) posts.push({ start: open, end: close });
  }
  const lineOf = offset => source.slice(0, offset).split("\n").length;
  const out = [];
  for (const literal of strings) {
    for (const m of literal.text.matchAll(WRITE)) {
      const raw = m[2] === "${" ? "$" : m[2].toLowerCase();
      if (raw !== "$" && !tables.has(raw)) continue;
      const at = literal.start;
      const inside = fns.filter(range => range.start < at && at < range.end).sort((a, b) => b.start - a.start);
      const verb = m[1].split(/\s+/)[0].toUpperCase();
      out.push({ line: lineOf(at), table: raw, verb, fn: inside[0]?.name || "", inPost: posts.some(range => range.start < at && at < range.end), set: verb === "UPDATE" ? setColumns(literal.text.slice(m.index)) : [] });
    }
  }
  return out;
}

// UPDATE … SET a = ?, b = REPLACE(b, ?, ?) WHERE … → ["a", "b"]; ${…} ile kurulan SET parçası "?" sayılır (çözülemez).
function setColumns(sql) {
  const at = /\bSET\b/i.exec(sql);
  if (!at) return ["?"];
  let depth = 0;
  let end = sql.length;
  for (let k = at.index + 3; k < sql.length; k += 1) {
    const ch = sql[k];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    else if (depth === 0 && /^\sWHERE\b/i.test(sql.slice(k, k + 7))) {
      end = k;
      break;
    }
  }
  const parts = [];
  let start = at.index + 3;
  depth = 0;
  for (let k = start; k < end; k += 1) {
    if (sql[k] === "(") depth += 1;
    else if (sql[k] === ")") depth -= 1;
    else if (sql[k] === "," && depth === 0) {
      parts.push(sql.slice(start, k));
      start = k + 1;
    }
  }
  parts.push(sql.slice(start, end));
  return parts.map(part => (/^\s*["`]?(\w+)["`]?\s*=/.exec(part)?.[1] || "?").toLowerCase());
}

/** İşlevin gövdesi (adla; aynı adlı birden çok varsa hepsi birleşik). */
export function functionBodies(source, name) {
  const { mask } = lex(source);
  return functionRanges(mask, source)
    .filter(range => range.name === name)
    .map(range => source.slice(range.start, range.end + 1))
    .join("\n");
}
