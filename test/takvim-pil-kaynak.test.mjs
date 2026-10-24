// 2.4.5 madde 6a (kullanıcı bulgusu 24.10.2026): Tahsilat Takvimi pil kartı, zil ve Anlık Durum → Vade Takip takvim kalemini KAYNAĞINA göre işler.
// Bulgu: pil kartı ve zil yalnız taksit / çek (zil ayrıca planlı banka) kaynağını tanıyordu; fatura (source "invoice") ve planlı banka (source "bank")
// kalemini tablo kaydı sayıyordu — "Kayda Git" → revealRecord("") "Kayıt tabloda bulunamadı", "Ödendi Say" → 400 "Kalem tanınmadı", "Tahsilat Gir" →
// workspace.payment({ key: "" }) SEÇİLİ tablo kaydının carisine fatura tutarıyla dolu form (para riski; alış faturasında yön de ters). Vade Takip'te fatura
// ve planlı banka satırı tıklanınca hiçbir şey olmuyordu.
// Bu test (1) sunucunun takvime (GET /api/workspace/dues) koyduğu her kaynağı kaynak koddan toplar ve istemcinin her yüzeyinde (pil kartı, zil, Vade Takip)
// o kaynak için bir dal arar (sunucuya yeni kaynak eklenip istemci unutulursa kırılır); (2) ortak yardımcıyı (hof-promises.js HOF.dues.actions / openRef)
// sahte HOF ile çalıştırıp her kaynağın düğmesinin NEYİ açtığını sınar. Madde 3: tablo kaleminin "Tahsilat Gir"i tutar ve tablo borcu taşımaz.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = process.env.PIL_KAYNAK_KOK ? path.resolve(process.env.PIL_KAYNAK_KOK) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(path.join(ROOT, file), "utf8");
const walk = dir => readdirSync(path.join(ROOT, dir)).flatMap(name => (statSync(path.join(ROOT, dir, name)).isDirectory() ? walk(path.join(dir, name)) : name.endsWith(".mjs") ? [path.join(dir, name)] : []));
// Yorumlar taramaya girmez (yorumda geçen `source === "x"` dal sayılmaz). Satır bölme CRLF'yi bilir (ders 27).
const code = text => text.replace(/\/\*[\s\S]*?\*\//g, "").split(/\r?\n/).filter(line => !line.trim().startsWith("//")).join("\n");
const sourceChecks = text => new Set([...code(text).matchAll(/source\s*===\s*"([A-Za-z]+)"/g)].map(match => match[1]));
/** `const <name> = { … };` nesnesinin üst düzey anahtarları (yoksa boş küme). */
function topKeys(text, name) {
  const body = code(text);
  const at = body.indexOf(`const ${name} = {`);
  if (at < 0) return new Set();
  const keys = new Set();
  let depth = 0;
  let line = "";
  for (let index = body.indexOf("{", at); index < body.length; index += 1) {
    const ch = body[index];
    if (ch === "\n") {
      line = "";
      continue;
    }
    if (depth === 1 && !line.trim()) {
      const key = /^\s*([A-Za-z]+)\s*:/.exec(body.slice(index, index + 40));
      if (key) keys.add(key[1]);
    }
    line += ch;
    if (ch === "{") depth += 1;
    else if (ch === "}" && (depth -= 1) === 0) break;
  }
  return keys;
}

// ---------- Sunucu: takvim kalemi kaynakları ----------
// Takvime giren her kalem üreticisi (routes/dues.mjs: plans/cheques/invoices/bank plans .dueItems; madde 6 cari vadesi) kalemi `id: \`<önek>|…\`` ve
// `source: "<kaynak>"` ile yazar. Tablodaki kaydın kalemi kaynaksızdır, kimliği "due|" ile başlar (lib/insight/dues.mjs dueId).
const serverFiles = walk("server");
const serverSources = new Set();
for (const file of serverFiles) {
  const lines = read(file).split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!/\bid:\s*`[A-Za-z]+\|/.test(line)) return;
    const near = lines.slice(index, index + 4).join("\n");
    const match = /\bsource:\s*"([A-Za-z]+)"/.exec(near);
    if (match) serverSources.add(match[1]);
  });
}
// Sözleşme K6.3 (docs/2.4.5-IS-LISTESI.md BAŞ MİMAR KARARLARI): madde 6 carinin vadeli borç kalemini source "account" ile ekler (sunucuda henüz olmasa da).
const CONTRACT_SOURCES = ["account"];
const expectedSources = [...new Set([...serverSources, ...CONTRACT_SOURCES])].sort();

// ---------- Sunucu: Vade Takip satırlarının kaynak türleri ----------
const overviewText = read("server/routes/overview.mjs");
const vadeBody = (() => {
  const text = code(overviewText);
  const start = text.indexOf("async function vadeTakip(");
  const end = text.indexOf('router.get("/api/workspace/overview/vade-takip"', start);
  return start >= 0 && end > start ? text.slice(start, end) : "";
})();
const refFiles = ["server/routes/overview.mjs", "server/routes/plans.mjs", "server/routes/cheques.mjs", "server/lib/bank/vouchers.mjs", "server/lib/bank/pos.mjs"];
const serverRefTypes = new Set(refFiles.flatMap(file => [...code(read(file)).matchAll(/\{ type: "([A-Za-z]+)"(?:, (?:id|key):| \})/g)].map(match => match[1])));
// Yalnız Nakit Akış Projeksiyonu'na giren (satırı tıklanmayan) kaynaklar; Vade Takip bunları toplamaz (aşağıda vadeTakip gövdesinden doğrulanır).
const CASHFLOW_ONLY = { pos: /pos\?\.flows|\.pos\.flows/, bankAccount: /cardDues/ };

describe("Takvim kalemi kaynağı — sunucu ↔ istemci dalları (kaynak tarama)", () => {
  it("sunucu taraması boş değil: taksit, çek / senet, fatura ve planlı banka kaynakları bulundu (ders 4)", () => {
    for (const source of ["plan", "cheque", "invoice", "bank"]) assert.ok(serverSources.has(source), `sunucuda "${source}" kaynaklı takvim kalemi bulunamadı (tarama bozuk): ${[...serverSources].join(", ")}`);
  });

  it("Tahsilat Takvimi pil kartı (hof-promises.js) sunucunun her takvim kaynağı için ayrı dal taşır", () => {
    const text = read("client/assets/hof-promises.js");
    const handled = new Set([...sourceChecks(text), ...topKeys(text, "DUE_SOURCES")]);
    const missing = expectedSources.filter(source => !handled.has(source));
    assert.deepEqual(missing, [], `Tahsilat Takvimi pil kartında ${missing.map(source => `"${source}"`).join(", ")} kaynakları için dal yok: bu kalemler tablo kaydı gibi işlenir (Kayda Git → revealRecord(""), Ödendi Say → 400, Tahsilat Gir → workspace.payment({ key: "" }) seçili kaydın carisine). Dal bulunanlar: ${[...handled].join(", ")}`);
    assert.ok(handled.has("table") || /startsWith\("due\|"\)/.test(code(text)), "tablodaki kaydın kalemi (due|) ayrı dal");
  });

  it("zil (hof-alerts.js) pil kartının yardımcısını kullanır ya da her kaynak için kendi dalını taşır; kalemi kendi başına workspace.payment'a göndermez", () => {
    const text = read("client/assets/hof-alerts.js");
    const shared = /HOF\.dues\??\.actions/.test(code(text));
    const handled = shared ? new Set([...sourceChecks(read("client/assets/hof-promises.js")), ...topKeys(read("client/assets/hof-promises.js"), "DUE_SOURCES")]) : sourceChecks(text);
    const missing = expectedSources.filter(source => !handled.has(source));
    assert.deepEqual(missing, [], `zilde ${missing.map(source => `"${source}"`).join(", ")} kaynakları için dal yok (ortak yardımcı ${shared ? "kullanılıyor" : "kullanılmıyor"}): "Tahsilat Gir" bu kalemi tablo kaydı sayıp seçili kaydın carisine gönderir`);
    assert.ok(!/workspace\??\.payment\s*\(/.test(code(text)), "zil workspace.payment'ı doğrudan çağırıyor: kaynağı tanınmayan kalem tablo kaydı yoluna düşer (ortak yardımcıdan geçmeli)");
  });

  it("madde 3: tablo kaleminin Tahsilat Gir'i (pil kartı ve zil) tutar ve tablo borcu taşımaz", () => {
    for (const file of ["client/assets/hof-promises.js", "client/assets/hof-alerts.js"]) {
      for (const [, args] of code(read(file)).matchAll(/workspace\??\.payment\s*\(\s*\{([^}]*)\}/g)) {
        assert.ok(!/\b(amount|debt|debtColumn)\s*:/.test(args), `${file}: workspace.payment'a tablodan tutar / borç gidiyor (${args.trim().slice(0, 160)})`);
      }
    }
  });

  it("Vade Takip openRef (hof-overview.js) sunucunun Vade Takip satırlarındaki her kaynak türünü açar", () => {
    assert.ok(vadeBody, "routes/overview.mjs vadeTakip gövdesi bulunamadı (tarama bozuk)");
    for (const [type, pattern] of Object.entries(CASHFLOW_ONLY)) assert.ok(!pattern.test(vadeBody), `Vade Takip artık "${type}" satırı da topluyor; openRef'e dalı eklenmeli (bu testte CASHFLOW_ONLY'den çıkarın)`);
    for (const type of ["plan", "cheque", "invoice", "bankPlan", "account", "cash", "record"]) assert.ok(serverRefTypes.has(type), `sunucuda "${type}" türlü satır kaynağı bulunamadı (tarama bozuk): ${[...serverRefTypes].join(", ")}`);
    const expected = [...serverRefTypes].filter(type => !Object.hasOwn(CASHFLOW_ONLY, type)).sort();
    const overview = read("client/assets/hof-overview.js");
    const delegates = /HOF\.dues\??\.openRef/.test(code(overview));
    const handled = new Set([...code(overview).matchAll(/ref\.type\s*===\s*"([A-Za-z]+)"/g)].map(match => match[1]));
    if (delegates) for (const key of topKeys(read("client/assets/hof-promises.js"), "DUE_REFS")) handled.add(key);
    const missing = expected.filter(type => !handled.has(type));
    assert.deepEqual(missing, [], `Vade Takip'te ${missing.map(type => `"${type}"`).join(", ")} satırı tıklanınca hiçbir şey açılmaz (openRef dalı yok). Dal bulunanlar: ${[...handled].join(", ")}`);
  });
});

// ---------- Ortak yardımcının davranışı (sahte HOF ile) ----------
const ALL = ["accounts.view", "accounts.collect", "accounts.manage", "plans.collect", "cheques.view", "cheques.manage", "invoices.view", "bank.view", "records.edit"];
function helper(permissions = ALL) {
  const calls = [];
  const spy = name => (...args) => {
    calls.push([name, ...args]);
  };
  const granted = new Set(permissions);
  const HOF = {
    esc: value => String(value ?? ""),
    whenReady: () => {},
    can: permission => granted.has(permission),
    normalize: value => String(value || "").toLocaleLowerCase("tr-TR"),
    formatMoney: value => String(value),
    toast: spy("toast"),
    revealRecord: spy("revealRecord"),
    sessions: { select: spy("sessions.select") },
    workspace: { payment: spy("workspace.payment") },
    plans: { pay: spy("plans.pay"), open: spy("plans.open") },
    cheques: { open: spy("cheques.open") },
    invoices: { payDoc: spy("invoices.payDoc"), openDoc: spy("invoices.openDoc") },
    bank: { openPlans: spy("bank.openPlans") },
    accounts: { collect: spy("accounts.collect"), pay: spy("accounts.pay"), open: spy("accounts.open") },
  };
  // Aynı ortamda (realm) çalışır: yardımcının ürettiği nesneler deepStrictEqual ile karşılaştırılabilsin.
  new Function("window", read("client/assets/hof-promises.js"))({ HOF });
  assert.equal(typeof HOF.dues?.actions, "function", "hof-promises.js HOF.dues.actions (ortak yardımcı) yok");
  return { actions: HOF.dues.actions, openRef: HOF.dues.openRef, calls, reset: () => calls.splice(0) };
}
const run = (h, action) => {
  h.reset();
  assert.ok(action, "düğme beklendi");
  action.run();
  return h.calls.map(call => call.slice());
};
const SAMPLES = {
  table: { id: "due|Sayfa1|k1|Söz|2026-10-20", caseKey: "k1", tab: "Sayfa1", person: "Ali Veli", phone: "0532 111 11 11", label: "Ödeme sözü", dueText: "20.10.2026", amount: 5000, debt: 12000, debtColumn: "Kalan", promise: true, state: "overdue" },
  plan: { id: "plan|p1|i1", source: "plan", planId: "p1", itemId: "i1", person: "Ayşe Kaya", caseKey: "k9", label: "1. taksit", dueText: "20.10.2026", amount: 3000 },
  cheque: { id: "cheque|c1", source: "cheque", chequeId: "c1", direction: "in", person: "Çek Sahibi", label: "Tahsil Edilecek çek", dueText: "20.10.2026", amount: 2500 },
  invoice: { id: "invoice|f1", source: "invoice", invoiceId: "f1", direction: "in", person: "Fatura Müşteri", caseKey: "", tab: "", label: "Tahsil Edilecek Fatura SF1", dueText: "20.10.2026", amount: 1200 },
  bank: { id: "bank|b1", source: "bank", bankPlanId: "b1", direction: "out", person: "Ziraat · Ana", caseKey: "", tab: "", label: "Kira", dueText: "20.10.2026", amount: 100 },
  account: { id: "account|e1", source: "account", accountId: "a1", entryId: "e1", direction: "in", person: "Cari Bir", label: "Tahsil Edilecek Borç", dueText: "20.10.2026", amount: 1500 },
};

describe("Takvim kalemi kaynağı — ortak yardımcının düğmeleri (pil kartı = zil = Vade Takip)", () => {
  it("sunucunun her kaynağı (ve sözleşmedeki account) için bu testte bir örnek var", () => {
    const missing = expectedSources.filter(source => !Object.hasOwn(SAMPLES, source));
    assert.deepEqual(missing, [], `yeni takvim kaynağı için örnek ve beklenen davranış ekleyin: ${missing.join(", ")}`);
  });

  it("satış faturası: Fatura Kartını Aç + Tahsilat Gir faturanın kendi formu; Ödendi Say yok; seçili kayda gitmez", () => {
    const h = helper();
    const acts = h.actions(SAMPLES.invoice);
    assert.equal(acts.kind, "invoice");
    assert.equal(acts.pay?.label, "Tahsilat Gir");
    assert.deepEqual(run(h, acts.pay), [["invoices.payDoc", "f1"]], "Tahsilat Gir faturanın kendi ödeme formunu açar (workspace.payment değil)");
    assert.equal(acts.go?.label, "Fatura Kartını Aç");
    assert.equal(acts.go?.allowed, true);
    assert.deepEqual(run(h, acts.go), [["invoices.openDoc", "f1"]]);
    assert.equal(acts.settle, false, "Ödendi Say faturada yok (sunucu yalnız due| kabul eder)");
    assert.equal(acts.cancel, false);
  });

  it("alış faturası: Ödeme Gir (yetki: accounts.manage); tahsilat yetkisi yetmez", () => {
    const purchase = { ...SAMPLES.invoice, direction: "out", label: "Ödenecek Fatura AF1" };
    const h = helper();
    const acts = h.actions(purchase);
    assert.equal(acts.pay?.label, "Ödeme Gir");
    assert.deepEqual(run(h, acts.pay), [["invoices.payDoc", "f1"]]);
    assert.equal(helper(ALL.filter(p => p !== "accounts.manage")).actions(purchase).pay, null, "accounts.manage yoksa Ödeme Gir yok");
    assert.equal(helper(ALL.filter(p => p !== "accounts.collect")).actions(SAMPLES.invoice).pay, null, "accounts.collect yoksa satış faturasında Tahsilat Gir yok");
    const viewer = helper(ALL.filter(p => p !== "invoices.view")).actions(SAMPLES.invoice);
    assert.equal(viewer.pay, null);
    assert.equal(viewer.go?.allowed, false, "fatura görme yetkisi yoksa Fatura Kartını Aç düğmesi çıkmaz");
  });

  it("planlı banka işlemi: yalnız Planlı İşlemleri Aç (tahsilat formu ve Ödendi Say yok)", () => {
    const h = helper();
    const acts = h.actions(SAMPLES.bank);
    assert.equal(acts.pay, null);
    assert.equal(acts.settle, false);
    assert.equal(acts.go?.label, "Planlı İşlemleri Aç");
    assert.deepEqual(run(h, acts.go), [["bank.openPlans"]]);
    assert.equal(helper(ALL.filter(p => p !== "bank.view")).actions(SAMPLES.bank).go?.allowed, false, "Banka Görüntüleme yetkisi yoksa düğme çıkmaz");
  });

  it("tablodaki kayıt (madde 3): Tahsilat Gir kaydın carisine — tutar ve tablo borcu YOK, kişi/telefon/not var; Ödendi Say ve Söz İptal var", () => {
    const h = helper();
    const acts = h.actions(SAMPLES.table);
    assert.equal(acts.kind, "table");
    const [[name, target]] = run(h, acts.pay);
    assert.equal(name, "workspace.payment");
    assert.equal(target.key, "k1");
    assert.equal(target.person, "Ali Veli");
    assert.equal(target.phone, "0532 111 11 11");
    assert.equal(target.note, "Ödeme sözü · 20.10.2026");
    for (const field of ["amount", "debt", "debtColumn"]) assert.ok(!Object.hasOwn(target, field), `tablo kaleminden "${field}" forma gitmemeli (madde 3)`);
    assert.equal(acts.settle, true);
    assert.equal(acts.cancel, true, "ödeme sözünde Söz İptal");
    assert.deepEqual(run(h, acts.go), [["revealRecord", "k1", { tab: "Sayfa1" }]]);
    assert.equal(helper(ALL.filter(p => p !== "records.edit")).actions(SAMPLES.table).settle, false, "Kayıt Düzenleme yetkisi yoksa Ödendi Say yok");
  });

  it("kayıt anahtarı boş tablo kalemi seçili kayda düşmez: Tahsilat Gir ve Kayda Git yok", () => {
    const acts = helper().actions({ ...SAMPLES.table, caseKey: "" });
    assert.equal(acts.pay, null);
    assert.equal(acts.go, null);
  });

  it("öbür sayfanın tablo kalemi: tahsilat o sayfada; Kayda Git sayfa adıyla o sayfaya geçer; Ödendi Say çalışır", () => {
    const h = helper();
    const acts = h.actions({ ...SAMPLES.table, foreign: true, session: "s2", pageName: "Müşteriler Yeni" });
    assert.equal(acts.pay, null);
    assert.equal(acts.settle, true);
    assert.equal(acts.go?.label, "Kayda Git (“Müşteriler Yeni”)");
    assert.deepEqual(run(h, acts.go), [["sessions.select", "s2", { reveal: { caseKey: "k1", tab: "Sayfa1" } }]]);
  });

  it("taksit ve çek / senet bugünkü yollarında", () => {
    const h = helper();
    const plan = h.actions(SAMPLES.plan);
    assert.equal(plan.pay?.label, "Tahsilat Gir");
    assert.deepEqual(run(h, plan.pay), [["plans.pay", SAMPLES.plan]]);
    assert.equal(plan.go?.label, "Taksit Kartını Aç");
    assert.deepEqual(run(h, plan.go), [["plans.open", "p1"]]);
    assert.equal(plan.settle, false);
    const cheque = h.actions(SAMPLES.cheque);
    assert.equal(cheque.pay?.label, "Tahsil Et");
    assert.deepEqual(run(h, cheque.pay), [["cheques.open", { id: "c1", action: "collect" }]]);
    const given = h.actions({ ...SAMPLES.cheque, direction: "out" });
    assert.equal(given.pay?.label, "Ödeme Gir");
    assert.deepEqual(run(h, given.pay), [["cheques.open", { id: "c1", action: "pay" }]]);
    assert.equal(cheque.go?.label, "Çek / Senet Kartını Aç");
    assert.deepEqual(run(h, cheque.go), [["cheques.open", { id: "c1" }]]);
    assert.equal(cheque.settle, false);
  });

  it("carinin vadeli borcu (madde 6, K6.3): Cariyi Aç + Tahsilat Gir / Ödeme Gir carinin formu, tutar = Kalan", () => {
    const h = helper();
    const debt = h.actions(SAMPLES.account);
    assert.equal(debt.pay?.label, "Tahsilat Gir");
    assert.deepEqual(run(h, debt.pay), [["accounts.collect", "a1", { amount: 1500, note: "Tahsil Edilecek Borç · 20.10.2026" }]]);
    assert.equal(debt.go?.label, "Cariyi Aç");
    assert.deepEqual(run(h, debt.go), [["accounts.open", "a1"]]);
    assert.equal(debt.settle, false);
    const credit = h.actions({ ...SAMPLES.account, direction: "out", label: "Ödenecek Borç" });
    assert.equal(credit.pay?.label, "Ödeme Gir");
    assert.deepEqual(run(h, credit.pay), [["accounts.pay", "a1", { amount: 1500, note: "Ödenecek Borç · 20.10.2026" }]]);
    assert.equal(helper(ALL.filter(p => p !== "accounts.manage")).actions({ ...SAMPLES.account, direction: "out" }).pay, null, "ödeme accounts.manage ister");
  });

  it("tanınmayan kaynak tablo kaydı gibi işlenmez: hiçbir düğme yok", () => {
    const acts = helper().actions({ id: "yeni|x1", source: "yeni", caseKey: "", person: "X", amount: 10 });
    assert.deepEqual([acts.pay, acts.go, acts.settle, acts.cancel], [null, null, false, false]);
  });

  it("Vade Takip openRef aynı yolu açar: fatura → Fatura Kartı, planlı banka → Planlı İşlemler, cari, taksit, çek; kayıt ve Kasa hof-overview'da kalır", () => {
    const h = helper();
    const open = ref => {
      h.reset();
      const handled = h.openRef(ref);
      return [handled, h.calls.map(call => call.slice())];
    };
    assert.deepEqual(open({ type: "invoice", id: "f1" }), [true, [["invoices.openDoc", "f1"]]]);
    assert.deepEqual(open({ type: "bankPlan", id: "b1" }), [true, [["bank.openPlans"]]]);
    assert.deepEqual(open({ type: "account", id: "a1" }), [true, [["accounts.open", "a1"]]]);
    assert.deepEqual(open({ type: "plan", id: "p1" }), [true, [["plans.open", "p1"]]]);
    assert.deepEqual(open({ type: "cheque", id: "c1" }), [true, [["cheques.open", { id: "c1" }]]]);
    assert.deepEqual(open({ type: "record", key: "k1" }), [false, []]);
    assert.deepEqual(open({ type: "cash" }), [false, []]);
    const noCheque = helper(ALL.filter(p => p !== "cheques.view"));
    noCheque.openRef({ type: "cheque", id: "c1" });
    assert.deepEqual(noCheque.calls.map(call => call[0]), ["toast"], "çek görme yetkisi yoksa ileti (kart açılmaz)");
  });
});
