// 2.1.0 — Aşama 2, Dilim 3: K6 statik katmanı (docs/BANKA-MODULU-PLAN.md §3.3/a).
// Para tablolarına (payments, cash_entries, account_entries, plan_entries, stock_moves, cheque_events, bank_lines, fin_events,
// pos_sales, pos_items, cheque_collections) yazan her SQL çağrı yeri iki yerden birinde olmalı:
//   (i)  bank.post(...)'a verilen argümanların (write geri çağrısı) içinde;
//   (ii) test/bank-post-izinli.json listesinde — dosya, işlev, tablo, tür ve gerekçeyle.
// Listedeki türler: "yardimci" (yalnız bank.post'un write geri çağrısından çağrılan ortak yazıcı; para satırına olayını
// bank.eventFor ile yazar — çalışma anında (c) ve money:event denetler), "para-disi" (yalnız para OLMAYAN satır yazar; yazımdan
// önce bank.assertNonMoney çağırır), "ham" (göç, şirket sıfırlaması: store.raw kapsamı), "ayri-baglanti" (canlı uygulamanın
// dışında, ayrı veri tabanı bağlantısıyla çalışan yedek geri yükleme), "cekirdek" (bank.post'un kendisi: işlem başlığını açar ve
// kopyasını yeniler), "bag" (yalnız para alanı olmayan kolona UPDATE: açıklama, taksit bağı, etki kaydı — çalışma anında da K6 (c)
// dışıdır; test SET kolonlarını denetler), "tablo-disi" (dinamik tablo adı yalnız para tablosu olmayan tablolar).
//
// NASIL BOZARIM: yeni bir dosyada/işlevde para tablosuna ham INSERT/UPDATE/DELETE (ya da tablo adı ${…} ile dinamik) → test
// kırılır; listedeki bir yazım yeri koddan kalkarsa liste eskir → test kırılır (liste kod incelemesi ister); "para-disi" türündeki
// işlev assertNonMoney çağırmazsa → kırılır; olay türü sözlükte yoksa → kırılır. Tarayıcının kendisi de sınanır (yorumdaki SQL,
// düzenli ifadedeki ters tırnak, iç içe şablon).
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { functionBodies, writeSites } from "./bank-post-tarayici.mjs";
import { FREE_COLUMNS, LEDGER_TABLES } from "../server/lib/bank/money-lines.mjs";
import { EVENT_TYPES, typeOf } from "../server/lib/bank/event-types.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALLOW = JSON.parse(readFileSync(path.join(ROOT, "test/bank-post-izinli.json"), "utf8"));
const TABLES = new Set(LEDGER_TABLES);

function serverFiles(dir = path.join(ROOT, "server")) {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return serverFiles(full);
    return /\.(mjs|js)$/.test(name) ? [full] : [];
  });
}
const allowed = (file, site) =>
  ALLOW.find(entry => entry.file === file && (entry.function === "*" || entry.function === site.fn) && (entry.tables || ["*"]).some(table => table === "*" || table === site.table) && (!entry.verbs || entry.verbs.includes(site.verb)));
const sitesOf = entry => {
  const source = readFileSync(path.join(ROOT, entry.file), "utf8");
  return writeSites(source, TABLES).filter(site => !site.inPost && allowed(entry.file, site) === entry);
};

describe("K6 statik: para tablosuna yazan her yer bank.post içinde ya da izinli listede", () => {
  it("tarayıcı kendini sınar", () => {
    const sample = `
      // INSERT INTO cash_entries (yorum sayılmaz)
      const RE = /^\\s*(?:INSERT\\s+INTO)\\s+["\`]?(\\w+)/i;
      function helper(user) {
        store.run("INSERT INTO cash_entries (id) VALUES (?)", 1);
      }
      const other = (a, b) => {
        store.run(\`UPDATE payments SET amount = \${a ? "?" : "?"} WHERE id = ?\`, b);
      };
      const obj = {
        removeFor(id) {
          store.run("DELETE FROM account_entries WHERE id = ?", id);
        },
      };
      router.post("/api/x", async ({ req }) => {
        bank.post({ user, module: "cash", op: "create", write: () => {
          store.run("INSERT INTO cash_entries (id) VALUES (?)", 2);
        } });
        store.run(\`DELETE FROM \${table} WHERE id = ?\`, 3);
        store.run("INSERT INTO notes (id) VALUES (?)", 4);
        db.exec(\`DELETE FROM main.\${quote(name)}\`);
        store.run("UPDATE plan_entries SET note = REPLACE(note, ?, ?), item_id = NULL WHERE id = ?", 1, 2, 3);
      });
    `;
    const sites = writeSites(sample, TABLES);
    const summary = sites.map(site => `${site.verb} ${site.table} ${site.fn || "-"} ${site.inPost ? "post" : "ham"}`);
    assert.deepEqual(summary, ["INSERT cash_entries helper ham", "UPDATE payments other ham", "DELETE account_entries removeFor ham", "INSERT cash_entries write post", "DELETE $ POST /api/x ham", "DELETE $ POST /api/x ham", "UPDATE plan_entries POST /api/x ham"]);
    assert.deepEqual(sites.at(-1).set, ["note", "item_id"], "SET kolonları (iç içe parantezli ifade)");
    assert.deepEqual(sites[1].set, ["amount"]);
  });

  it("izinli liste geçerli: her girdinin dosyası, işlevi, türü ve gerekçesi var", () => {
    const kinds = new Set(["cekirdek", "yardimci", "para-disi", "bag", "ham", "ayri-baglanti", "tablo-disi"]);
    assert.ok(ALLOW.length > 0);
    for (const entry of ALLOW) {
      assert.ok(entry.file && entry.function, JSON.stringify(entry));
      assert.ok(kinds.has(entry.tur), `${entry.file} ${entry.function}: tür ${entry.tur}`);
      assert.ok(String(entry.gerekce || "").length >= 20, `${entry.file} ${entry.function}: gerekçe yazılmalı`);
    }
  });

  it("gerçek kod: liste dışında ham yazım yeri yok; listede eskimiş girdi yok", () => {
    const outside = [];
    const used = new Set();
    let total = 0;
    for (const full of serverFiles()) {
      const file = path.relative(ROOT, full).split(path.sep).join("/");
      for (const site of writeSites(readFileSync(full, "utf8"), TABLES)) {
        total += 1;
        if (site.inPost) continue;
        const entry = allowed(file, site);
        if (entry) used.add(entry);
        else outside.push(`${file}:${site.line} ${site.verb} ${site.table} (${site.fn || "işlev dışı"})`);
      }
    }
    assert.ok(total > 40, `yazım yeri sayısı ${total}`);
    assert.deepEqual(outside, [], "bank.post dışında, izinli listede olmayan para tablosu yazımı");
    const stale = ALLOW.filter(entry => !used.has(entry)).map(entry => `${entry.file} ${entry.function}`);
    assert.deepEqual(stale, [], "listede artık kodda olmayan girdi (listeyi güncelleyin)");
  });

  it("'para-disi' yazıcılar yazımdan önce assertNonMoney, 'yardimci' yazıcılar olayı eventFor ile yazar; 'bag' yalnız para alanı olmayan kolona", () => {
    for (const entry of ALLOW.filter(item => ["para-disi", "yardimci", "bag"].includes(item.tur))) {
      const sites = sitesOf(entry);
      assert.ok(sites.length, `${entry.file} ${entry.function}: yazım yeri bulunamadı`);
      const writes = sites.some(site => site.verb !== "DELETE");
      const body = functionBodies(readFileSync(path.join(ROOT, entry.file), "utf8"), entry.function);
      if (entry.tur === "para-disi" && writes) assert.match(body, /assertNonMoney\s*\(/, `${entry.file} ${entry.function}: assertNonMoney yok`);
      if (entry.tur === "yardimci" && writes) assert.match(body, /eventFor\s*\(/, `${entry.file} ${entry.function}: olay yazımı (bank.eventFor) yok`);
      if (entry.tur === "bag") {
        for (const site of sites) {
          assert.equal(site.verb, "UPDATE", `${entry.file} ${entry.function}: yalnız UPDATE`);
          const free = site.table === "$" ? new Set(["note"]) : FREE_COLUMNS[site.table];
          assert.ok(site.set.length && site.set.every(column => free?.has(column)), `${entry.file}:${site.line} ${entry.function}: para alanı olmayan kolon dışında SET (${site.set.join(", ")})`);
        }
      }
    }
  });

  it("olay türleri sözlükte (CHECK yerine kod sözlüğü, §3.6)", () => {
    const samples = [
      ["payments", {}],
      ["cash_entries", { kind: "in" }],
      ["cash_entries", { kind: "out" }],
      ["cash_entries", { kind: "in", transfer_id: "trf-1" }],
      ["account_entries", { kind: "in", source: "" }],
      ["account_entries", { kind: "out", source: "" }],
      ["account_entries", { kind: "in", source: "invoice" }],
      ["plan_entries", { kind: "in" }],
      ["plan_entries", { kind: "out" }],
      ["stock_moves", { kind: "out", pay: "cash" }],
      ["cheque_events", { kind: "collect" }],
      ["cheque_events", { kind: "pay" }],
    ];
    for (const [table, row] of samples) assert.ok(EVENT_TYPES.has(typeOf(table, row)), `${table} ${JSON.stringify(row)} → ${typeOf(table, row)}`);
    for (const type of ["opening", "fee", "transfer", "cash_transfer", "party_in", "party_out", "invoice_cash", "plan_in", "plan_out", "record_in", "stock_cash", "cheque_collect", "cheque_pay", "reversal"]) assert.ok(EVENT_TYPES.has(type), type);
  });
});
