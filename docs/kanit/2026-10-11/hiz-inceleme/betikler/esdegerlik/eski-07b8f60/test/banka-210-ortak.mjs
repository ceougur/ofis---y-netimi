// 2.1.0 Aşama 2 (dilim 4) testlerinin ortak yardımcıları: sunucu açma, yanıt açma, PDF metni ve Excel satırları, ham veri yazımı.
// (Bu dosya test değildir: adı ".test.mjs" ile bitmez, npm test onu tek başına koşmaz.)
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { readZip } from "../server/lib/zip.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const pad = n => String(n).padStart(2, "0");
export const localDay = (offset = 0, base = new Date()) => {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && r.data.ok === true ? r.data.data : r.data, code: r.data?.code, error: r.data?.error });
export const apiOf = client => ({
  client,
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
  raw: (method, url, options) => client.raw(method, url, options),
});
export async function boot(options = {}) {
  const server = await startTestServer(options);
  const api = apiOf(await loginAdmin(server));
  return { server, api, app: server.app, store: server.app.store, db: server.app.db, bank: server.app.context.bank };
}
export const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 600)}`);
  return res.data;
};
export const integrityOf = async api => must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
export const integrityOk = async (api, label) => {
  const result = await integrityOf(api);
  assert.equal(result.ok, true, `${label}: mutabakat bozuk ${JSON.stringify(result.failures).slice(0, 900)}`);
  return result;
};
/** Store'u atlayarak (K6 ve kapı dışı) veri tabanına doğrudan yazar: eski sürümün ya da elle düzenlemenin yaptığı gibi. */
export const rawRun = (db, sql, ...args) => db.prepare(sql).run(...args);
export const rawGet = (db, sql, ...args) => db.prepare(sql).get(...args);
export const rawAll = (db, sql, ...args) => db.prepare(sql).all(...args);

/** Banka hesabı kartı (Aşama 3 gelene kadar testte doğrudan yazılır). */
export function insertBankAccount(db, { id, code, kind = "demand", gl = kind === "card" ? "309" : kind === "loan" ? "300" : "102", glSub, name = code, currency = "TRY", openingDate = "2026-01-01" }) {
  rawRun(
    db,
    "INSERT INTO bank_accounts (id, code, gl, gl_sub, kind, bank_name, name, currency, opening_date, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'Test Bankası', ?, ?, ?, 'test', ?)",
    id, code, gl, glSub, kind, name, currency, openingDate, new Date().toISOString(),
  );
}
export function insertPos(db, { id, code, glSub, bankAccountId }) {
  rawRun(db, "INSERT INTO pos_terminals (id, code, gl_sub, name, bank_account_id, kind, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'physical', 'test', ?)", id, code, glSub, code, bankAccountId, new Date().toISOString());
}

// ---------- PDF ve Excel okuyucular (raporlar-224 ile aynı yöntem) ----------
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
/** Excel dosyasının sayfaları: { ad: [[hücre…]…] } (hücre metin ya da sayı). */
export function xlsxSheets(buffer) {
  const entries = readZip(buffer);
  const file = name => entries.find(entry => entry.name === name)?.data.toString("utf8") || "";
  const shared = [...file("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(match => xmlText([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
  const names = [...file("xl/workbook.xml").matchAll(/<sheet [^>]*name="([^"]*)"/g)].map(match => xmlText(match[1]));
  const out = {};
  names.forEach((name, index) => {
    const sheet = file(`xl/worksheets/sheet${index + 1}.xml`);
    out[name] = [...sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(row =>
      [...row[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].reduce((cells, [, attrs, body = ""]) => {
        const letters = /r="([A-Z]+)\d+"/.exec(attrs)?.[1] || "";
        const at = letters ? [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1 : cells.length;
        const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(body);
        const v = /<v>([\s\S]*?)<\/v>/.exec(body);
        while (cells.length < at) cells.push("");
        cells[at] = t ? xmlText(t[1]) : !v ? "" : /t="s"/.test(attrs) ? shared[Number(v[1])] : Number(v[1]);
        return cells;
      }, []),
    );
  });
  return out;
}
