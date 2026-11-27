// 2.5.0 BİRLEŞİK TUR 3 — iyimser kilit ailesinin kalan formları (birleşik tur 2 dar kontrolü YAN-A, YAN-B; DOĞRULANMADI 3a önce yeniden üretildi; sakınca süzgeci:
// sessiz veri kaybı). Sözleşme lib/row-version.mjs (birleşik tur 1): form açıldığı andaki sürümü gövdede gönderir; satır o andan sonra değiştiyse 409 *-stale,
// hiçbir şey yazılmaz; gövdede sürüm yoksa (eski istemci) eskisi gibi yazılır.
//  YAN-A Kasa → Açılış Bakiyesi (POST /api/workspace/cash/opening): openingId (form açılırken açılış yoktu = "") + updatedAt. Eski kodda (3360687f) B 5.000 → 4.000 yapınca
//        yalnız tarihi değiştiren A'nın formu 5.000'i geri yazıyordu; açılış yokken açılan form B'nin girdiği 3.000'in üstüne 7.000 yazıyordu.
//  YAN-B Taksit düzelt (PUT /plans/:id/items/:itemId): B 500 → 300, A yalnız vadeyi değiştirdi → eski kod 500.
//  3a    Taksit kartı (PUT /plans/:id): B tutarı 1.000 → 1.200, A yalnız not → eski kod 1.000. Stok kartı (PUT /stock/:id): B Satış Fiyatı 15 → 20 → eski kod 15;
//        arada girilen alımın Alış Fiyatı 12 → eski kod 10.
// Yarışlar zorla üretilir (ders 20): gövde yoldayken öbür yazım biter (raceWrite) ya da İKİNCİ SÜREÇ yazım kilidini tutar (outsideWriter; Windows'a duyarlı — dosya
// kilidi, ders 48). Saat AKAN sahte saat (sabit saatte iki yazımın damgası aynı olur, sürüm değişmez). Lisans servisi ölü adres (ders 30).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { after, before, describe, test } from "node:test";
import { apiOf, boot, must } from "./banka-210-ortak.mjs";
import { createUser } from "./helpers.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const DAY = "2026-10-08";
const PAST = "2026-09-01";
const ACC = "/api/workspace/accounts";
const STOCK = "/api/workspace/stock";
const PLANS = "/api/workspace/plans";
const CASH = "/api/workspace/cash";
const OPENING = "/api/workspace/cash/opening";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Yarış (zorla): başlıklar gider, gövde bekletilir; `during` BİTER, sonra gövde gönderilir. */
async function raceWrite(ctx, { method = "PUT", path, body, during }) {
  const text = JSON.stringify(body);
  const { port } = new URL(ctx.server.base);
  let mid = null;
  const reply = await new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path, headers: { cookie: ctx.api.client.cookie, "content-type": "application/json", "content-length": Buffer.byteLength(text) } }, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = { error: data };
        }
        resolve({ status: res.statusCode, body: parsed || {} });
      });
    });
    req.on("error", reject);
    req.flushHeaders();
    setTimeout(async () => {
      try {
        mid = await during();
      } catch (error) {
        mid = { status: 0, error };
      }
      req.end(text);
    }, 300);
  });
  return { reply, mid };
}

// İkinci süreç: ayrı SQLite bağlantısı yazım kilidini alır (BEGIN IMMEDIATE), satırı değiştirir, "KILITLI" yazar, `wait` ms sonra COMMIT.
const OUTSIDE = `import { DatabaseSync } from "node:sqlite";
const [file, sql, wait, ...args] = process.argv.slice(1);
const db = new DatabaseSync(file);
db.exec("PRAGMA busy_timeout = 5000");
db.exec("BEGIN IMMEDIATE");
const result = db.prepare(sql).run(...args);
process.stdout.write("KILITLI " + result.changes + "\\n");
setTimeout(() => { db.exec("COMMIT"); db.close(); process.stdout.write("COMMIT\\n"); }, Number(wait));`;
function outsideWriter(file, sql, args, wait = 700) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "--input-type=module", "-e", OUTSIDE, file, sql, String(wait), ...args.map(String)], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    let locked = false;
    const done = new Promise(finish => child.on("exit", code => finish({ code, out, err })));
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`dış süreç kilidi alamadı (20 sn): ${err.slice(0, 300)}`));
    }, 20000);
    child.stdout.on("data", chunk => {
      out += chunk;
      if (!locked && out.includes("KILITLI")) {
        locked = true;
        clearTimeout(timer);
        resolve({ changes: Number(/KILITLI (\d+)/.exec(out)?.[1]), done });
      }
    });
    child.stderr.on("data", chunk => (err += chunk));
    child.on("error", error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", code => {
      if (!locked) {
        clearTimeout(timer);
        reject(new Error(`dış süreç kilitten önce çıktı (${code}): ${err.slice(0, 300)}`));
      }
    });
  });
}

async function world() {
  const ctx = await boot({ now: { time: NOW }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
  ctx.other = apiOf(await createUser(ctx.server, ctx.api.client, { username: "tur3yon", role: "admin", password: "Yonetici-Uc-2026!" }));
  let seq = 0;
  ctx.next = () => (seq += 1);
  ctx.file = ctx.store.all("PRAGMA database_list").find(row => row.name === "main").file;
  ctx.policy = async cash => must(`politika ${cash}`, ctx.api.put("/api/admin/negative-policy", { cash }));
  ctx.kasa = async () => (await must("Kasa", ctx.api.get(CASH))).byMethod.cash;
  ctx.opening = () => ctx.store.all("SELECT id, amount, date, updated_by AS updatedBy FROM cash_entries WHERE is_opening = 1");
  ctx.audits = (kind, ref) => ctx.store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = ? AND entity_id = ?", kind, ref)?.n ?? -1;
  // Açılışı sıfırlar: varsa siler (Silinenler'e gider; sayılmaz).
  ctx.clearOpening = async () => {
    for (const row of ctx.opening()) await must("açılışı sil", ctx.api.del(`${CASH}/${row.id}`));
    assert.equal(ctx.opening().length, 0, "ön koşul: açılış yok");
  };
  // Form açılışı: GET'in verdiği açılış (yoksa null) → gövdeye openingId + updatedAt (istemci hof-workspace.js cashOpeningForm gibi).
  ctx.openingForm = async api => {
    const state = await must("Açılış Bakiyesi formu", (api || ctx.api).get(OPENING));
    return { opening: state.opening, version: { openingId: state.opening?.id || "", updatedAt: state.opening ? state.opening.updatedAt || "" : "" } };
  };
  return ctx;
}

// Kartlar
async function makePlan(ctx, total = "1000") {
  const account = await must("cari", ctx.api.post(ACC, { name: `Tur3 Cari ${ctx.next()}`, type: "customer", registeredOn: PAST }));
  return must("kart", ctx.api.post(PLANS, { accountId: account.id, name: `Tur3 Kart ${ctx.next()}`, total, mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: PAST }));
}
// Kart düzenleme formunun gövdesi (hof-plans.js editPlan onSubmit; tam form).
const planForm = p => ({ name: p.name, refNo: p.refNo, registeredOn: p.registeredOn, phone: p.phone || "", total: String(p.total), note: p.note || "", caseKey: p.caseKey || "", caseSource: p.caseSource || "", caseTitle: p.caseTitle || "", accountId: p.accountId, groupId: p.groupId || "", subgroupId: p.subgroupId || "", updatedAt: p.updatedAt || "" });
const itemForm = (item, change = {}) => ({ dueDate: item.dueDate, amount: String(item.amount), note: item.note || "", updatedAt: item.updatedAt || "", ...change });
async function makeStock(ctx) {
  return must("ürün", ctx.api.post(STOCK, { name: `Tur3 Ürün ${ctx.next()}`, unit: "Adet", unitPrice: "10", salePrice: "15" }));
}
// Stok kartı düzenleme formunun gövdesi (hof-stock.js editItem; tam form).
const stockForm = s => ({ kind: s.kind, code: s.code || "", name: s.name, unit: s.unit, category: s.category || "", minQty: s.minQty ? String(s.minQty) : "", unitPrice: String(s.unitPrice || ""), salePrice: String(s.salePrice || ""), vatRate: s.vatRate ?? "", note: s.note || "", updatedAt: s.updatedAt || "" });

describe("2.5.0 BİRLEŞİK TUR 3 — YAN-A Kasa Açılış Bakiyesi formu", () => {
  let ctx;
  before(async () => {
    ctx = await world();
  });
  after(async () => ctx?.server.close());

  test("A formu açar, B açılışı 5.000 → 4.000 düzeltir, A yalnız tarihi değiştirip formdaki 5.000'le kaydeder → 409 cash-opening-stale; açılış 4.000 / B'nin tarihi, A yazmadı", async () => {
    await ctx.clearOpening();
    await must("açılış", ctx.api.post(OPENING, { amount: "5.000", date: PAST }));
    const formA = await ctx.openingForm();
    await sleep(5);
    const formB = await ctx.openingForm(ctx.other);
    await must("B 4.000", ctx.other.post(OPENING, { amount: "4.000", date: formB.opening.date, ...formB.version }));
    const corrected = ctx.audits("cash.opening.corrected", formA.opening.id);
    const res = await ctx.api.post(OPENING, { amount: String(formA.opening.amount), date: "2026-08-31", ...formA.version });
    const rows = ctx.opening();
    assert.equal(res.status, 409, `A'nın eskimiş formu 409 almalı (gelen ${res.status} ${JSON.stringify(res.data).slice(0, 200)}); veri tabanında ${JSON.stringify(rows)}`);
    assert.equal(res.data?.code, "cash-opening-stale");
    assert.match(String(res.error || res.data?.error || ""), /siz formu açtıktan sonra başka biri tarafından girildi, değiştirildi ya da silindi; kaydınız yapılmadı/);
    assert.deepEqual(rows.map(row => [row.amount, row.date]), [[4000, PAST]], "B'nin 4.000'i duruyor, A'nın tarihi yazılmadı");
    assert.equal(ctx.audits("cash.opening.corrected", formA.opening.id), corrected, "Değişiklik Geçmişi'ne A'nın düzeltmesi yazılmadı");
  });

  test("açılış YOKKEN açılan form: B arada 3.000 girer, A 7.000 gönderir → 409; tek açılış 3.000", async () => {
    await ctx.clearOpening();
    const formA = await ctx.openingForm();
    assert.equal(formA.opening, null, "ön koşul: form açılırken açılış yok");
    await must("B 3.000", ctx.other.post(OPENING, { amount: "3.000", date: PAST, ...(await ctx.openingForm(ctx.other)).version }));
    const res = await ctx.api.post(OPENING, { amount: "7.000", date: PAST, ...formA.version });
    const rows = ctx.opening();
    assert.equal(res.status, 409, `açılışsız açılan eskimiş form 409 almalı (gelen ${res.status}); veri tabanında ${JSON.stringify(rows)}`);
    assert.equal(res.data?.code, "cash-opening-stale");
    assert.deepEqual(rows.map(row => row.amount), [3000], "B'nin 3.000'i duruyor (A'nın 7.000'i yazılmadı, ikinci açılış da açılmadı)");
  });

  test("form açılışla açıldı, B açılışı SİLDİ, A kaydeder → 409; yeni açılış açılmaz", async () => {
    await ctx.clearOpening();
    await must("açılış", ctx.api.post(OPENING, { amount: "2.000", date: PAST }));
    const formA = await ctx.openingForm();
    await must("B siler", ctx.other.del(`${CASH}/${formA.opening.id}`));
    const res = await ctx.api.post(OPENING, { amount: "2.500", date: PAST, ...formA.version });
    assert.equal(res.status, 409, `silinmiş açılışın eskimiş formu 409 almalı (gelen ${res.status}); veri tabanında ${JSON.stringify(ctx.opening())}`);
    assert.equal(res.data?.code, "cash-opening-stale");
    assert.equal(ctx.opening().length, 0, "yeni açılış yazılmadı");
  });

  test("Kasa Engelle: eskimiş form açılışı düşürüp Kasa'yı eksiye düşürecek olsa da önce 409 cash-opening-stale (yanıltıcı Kasa iletisi önce çıkmaz)", async () => {
    await ctx.clearOpening();
    await ctx.policy("off");
    await must("açılış", ctx.api.post(OPENING, { amount: "5.000", date: PAST }));
    const formA = await ctx.openingForm();
    await sleep(5);
    await must("B 6.000", ctx.other.post(OPENING, { amount: "6.000", date: PAST, ...(await ctx.openingForm(ctx.other)).version }));
    // Kasa'yı ayarla: açılış 1 TL'ye inerse Kasa eksiye düşsün.
    const kasa = await ctx.kasa();
    if (kasa > 100) await must("Kasa çıkışı", ctx.api.post(CASH, { kind: "out", amount: String(Math.round((kasa - 100) * 100) / 100), date: DAY, description: `Tur3 Çıkış ${ctx.next()}` }));
    await ctx.policy("block");
    const res = await ctx.api.post(OPENING, { amount: "1", date: PAST, ...formA.version });
    await ctx.policy("off");
    assert.equal(res.status, 409);
    assert.equal(res.data?.code, "cash-opening-stale", `eskimiş formda önce sürüm iletisi (gelen ${res.data?.code}: ${res.error || res.data?.error})`);
    assert.deepEqual(ctx.opening().map(row => row.amount), [6000]);
  });

  test("GERİLEME: sürüm göndermeyen istemci eskisi gibi yazar; güncel formla düzeltme 200, kendi kaydından sonra ardışık ikinci düzeltme de 200; değişmeyen gövde 'değişiklik yok'", async () => {
    await ctx.clearOpening();
    const empty = await ctx.openingForm();
    const created = await ctx.api.post(OPENING, { amount: "1.000", date: PAST, ...empty.version });
    assert.equal(created.status, 200, `açılışsız formla ilk açılış 200 (${created.status} ${created.error || ""})`);
    const legacy = await ctx.api.post(OPENING, { amount: "1.100", date: PAST });
    assert.equal(legacy.status, 200, "sürümsüz (eski istemci) düzeltme 200");
    await sleep(5);
    const first = await ctx.openingForm();
    const one = await ctx.api.post(OPENING, { amount: "1.200", date: PAST, ...first.version });
    assert.equal(one.status, 200, `güncel formla düzeltme 200 (${one.status} ${one.error || ""})`);
    await sleep(5);
    const second = await ctx.openingForm();
    assert.notEqual(second.version.updatedAt, first.version.updatedAt, "ön koşul: kendi düzeltmesi sürümü ilerletti");
    const two = await ctx.api.post(OPENING, { amount: "1.300", date: PAST, ...second.version });
    assert.equal(two.status, 200, `ardışık ikinci düzeltme 200 (${two.status} ${two.error || ""})`);
    const same = await ctx.api.post(OPENING, { amount: "1.300", date: PAST, ...second.version });
    assert.equal(same.status, 200);
    assert.equal(same.data?.unchanged, true, "güncel açılışla aynı gövde: değişiklik yok (eskimiş sürümle de yazılmaz)");
    assert.deepEqual(ctx.opening().map(row => row.amount), [1300]);
  });

  test("İKİNCİ SÜREÇ: dış bağlantı yazım kilidini tutarken açılışı 8.000 yapar; A'nın düzeltmesi kilit alındıktan sonra GÜNCEL sürümü görür → 409, 8.000 durur", async () => {
    await ctx.clearOpening();
    await must("açılış", ctx.api.post(OPENING, { amount: "5.000", date: PAST }));
    const formA = await ctx.openingForm();
    const outside = await outsideWriter(ctx.file, "UPDATE cash_entries SET amount = ?, updated_at = ? WHERE id = ?", [8000, "2026-10-08T09:30:00.000Z", formA.opening.id]);
    assert.equal(outside.changes, 1, "ön koşul: dış süreç satırı değiştirdi ve kilidi tutuyor");
    const res = await ctx.api.post(OPENING, { amount: "5.500", date: PAST, ...formA.version });
    const end = await outside.done;
    assert.equal(end.code, 0, `dış süreç COMMIT etti (${end.err.slice(0, 200)})`);
    assert.equal(res.status, 409, `kilitten sonra güncel sürüm okunmalı (gelen ${res.status} ${res.error || ""}); veri tabanında ${JSON.stringify(ctx.opening())}`);
    assert.equal(res.data?.code, "cash-opening-stale");
    assert.deepEqual(ctx.opening().map(row => row.amount), [8000]);
  });
});

describe("2.5.0 BİRLEŞİK TUR 3 — YAN-B taksit düzelt (plan_items)", () => {
  let ctx;
  before(async () => {
    ctx = await world();
  });
  after(async () => ctx?.server.close());

  test("A formu açar, B taksiti 500 → 300 yapar, A yalnız vadeyi değiştirip formdaki 500'le kaydeder → 409 plan-item-stale; taksit 300 / eski vade", async () => {
    const plan = await makePlan(ctx);
    const item = plan.items[0];
    assert.ok(item.updatedAt, "taksitin sürümü kart yanıtında (items[].updatedAt)");
    await sleep(5);
    await must("B 300", ctx.other.put(`${PLANS}/${plan.id}/items/${item.id}`, itemForm(item, { amount: "300" })));
    const res = await ctx.api.put(`${PLANS}/${plan.id}/items/${item.id}`, itemForm(item, { dueDate: "2026-11-03" }));
    const row = ctx.store.get("SELECT amount, due_date AS dueDate FROM plan_items WHERE id = ?", item.id);
    assert.equal(res.status, 409, `A'nın eskimiş formu 409 almalı (gelen ${res.status}); veri tabanında ${JSON.stringify(row)}`);
    assert.equal(res.data?.code, "plan-item-stale");
    assert.match(String(res.error || res.data?.error || ""), /Bu taksit siz açtıktan sonra başka biri tarafından değiştirildi; düzeltmeniz kaydedilmedi/);
    assert.deepEqual({ ...row }, { amount: 300, dueDate: item.dueDate }, "B'nin 300'ü duruyor, A'nın vadesi yazılmadı");
  });

  test("GÖVDE YOLDAYKEN: A'nın düzeltmesinin gövdesi beklenirken B taksiti düzeltir → karar işlemin içinde güncel taksitle: 409", async () => {
    const plan = await makePlan(ctx);
    const item = plan.items[0];
    await sleep(5);
    const race = await raceWrite(ctx, {
      path: `${PLANS}/${plan.id}/items/${item.id}`,
      body: itemForm(item, { dueDate: "2026-11-04" }),
      during: async () => ctx.other.put(`${PLANS}/${plan.id}/items/${item.id}`, itemForm(item, { amount: "250" })),
    });
    assert.equal(race.mid.status, 200, "ön koşul: B'nin düzeltmesi gövde yoldayken bitti");
    const row = ctx.store.get("SELECT amount, due_date AS dueDate FROM plan_items WHERE id = ?", item.id);
    assert.equal(race.reply.status, 409, `gövde yoldayken değişen taksit 409 (gelen ${race.reply.status}); veri tabanında ${JSON.stringify(row)}`);
    assert.equal(race.reply.body?.code, "plan-item-stale");
    assert.deepEqual({ ...row }, { amount: 250, dueDate: item.dueDate });
  });

  test("GERİLEME: sürümsüz (eski istemci) 200; güncel sürümle 200; kendi kaydından sonra ardışık ikinci düzeltme 200; silinmiş taksit 404", async () => {
    const plan = await makePlan(ctx);
    const [first, second] = plan.items;
    assert.equal((await ctx.api.put(`${PLANS}/${plan.id}/items/${first.id}`, { dueDate: first.dueDate, amount: "450", note: "" })).status, 200, "sürümsüz 200");
    const fresh = (await must("kart", ctx.api.get(`${PLANS}/${plan.id}`))).items.find(item => item.id === first.id);
    await sleep(5);
    const one = await must("güncel 1", ctx.api.put(`${PLANS}/${plan.id}/items/${first.id}`, itemForm(fresh, { note: "bir" })));
    const again = one.items.find(item => item.id === first.id);
    assert.notEqual(again.updatedAt, fresh.updatedAt, "ön koşul: kendi düzeltmesi sürümü ilerletti");
    await sleep(5);
    await must("ardışık 2", ctx.api.put(`${PLANS}/${plan.id}/items/${first.id}`, itemForm(again, { note: "iki" })));
    assert.equal(ctx.store.get("SELECT note FROM plan_items WHERE id = ?", first.id).note, "iki");
    await must("B siler", ctx.other.del(`${PLANS}/${plan.id}/items/${second.id}`));
    const gone = await ctx.api.put(`${PLANS}/${plan.id}/items/${second.id}`, itemForm(second, { note: "x" }));
    assert.equal(gone.status, 404);
    assert.match(String(gone.error || gone.data?.error || ""), /Taksit bulunamadı. Başka biri silmiş olabilir./);
  });
});

describe("2.5.0 BİRLEŞİK TUR 3 — 3a taksit kartı (plans) ve stok kartı (stock_items)", () => {
  let ctx;
  before(async () => {
    ctx = await world();
  });
  after(async () => ctx?.server.close());

  test("Taksit kartı: B tutarı 1.000 → 1.200 yapar, A yalnız notu değiştirip formdaki 1.000'le kaydeder → 409 plan-stale; kart 1.200, not boş", async () => {
    const plan = await makePlan(ctx);
    await sleep(5);
    await must("B 1.200", ctx.other.put(`${PLANS}/${plan.id}`, { ...planForm(plan), total: "1200" }));
    const res = await ctx.api.put(`${PLANS}/${plan.id}`, { ...planForm(plan), note: "A'nın notu" });
    const row = ctx.store.get("SELECT total, note FROM plans WHERE id = ?", plan.id);
    assert.equal(res.status, 409, `A'nın eskimiş formu 409 almalı (gelen ${res.status}); veri tabanında ${JSON.stringify(row)}`);
    assert.equal(res.data?.code, "plan-stale");
    assert.match(String(res.error || res.data?.error || ""), /Bu taksit kartı siz açtıktan sonra başka biri tarafından değiştirildi; değişikliğiniz kaydedilmedi/);
    assert.deepEqual({ ...row }, { total: 1200, note: plan.note || "" });
  });

  test("Taksit kartı: kart adı cari adıyla aynıyken cari yeniden adlandırılır (kartın adı da değişir, sürüm ilerler) → eskimiş kart formu 409; kartın yeni adı durur", async () => {
    const name = `Tur3 Ortak Ad ${ctx.next()}`;
    const account = await must("cari", ctx.api.post(ACC, { name, type: "customer", registeredOn: PAST }));
    const plan = await must("kart", ctx.api.post(PLANS, { accountId: account.id, name, total: "1000", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: PAST }));
    const card = await must("cari kartı", ctx.api.get(`${ACC}/${account.id}`));
    await sleep(5);
    await must("B cariyi yeniden adlandırır", ctx.other.put(`${ACC}/${account.id}`, { name: `${name} Yeni`, type: "customer", registeredOn: PAST, updatedAt: card.updatedAt }));
    const renamed = ctx.store.get("SELECT name FROM plans WHERE id = ?", plan.id).name;
    assert.equal(renamed, `${name} Yeni`, "ön koşul: cari adı kartın adını da değiştirdi");
    const res = await ctx.api.put(`${PLANS}/${plan.id}`, { ...planForm(plan), note: "A" });
    assert.equal(res.status, 409, `kartın adı değişti; eskimiş form (eski adla) 409 almalı (gelen ${res.status}); kartın adı ${ctx.store.get("SELECT name FROM plans WHERE id = ?", plan.id).name}`);
    assert.equal(res.data?.code, "plan-stale");
    assert.equal(ctx.store.get("SELECT name FROM plans WHERE id = ?", plan.id).name, renamed);
  });

  test("Taksit kartı GÖVDE YOLDAYKEN: B kartı düzeltir → karar işlemin içinde güncel kartla: 409 (kart isteğin başında okunan hâliyle denetlenmez)", async () => {
    const plan = await makePlan(ctx);
    await sleep(5);
    const race = await raceWrite(ctx, {
      path: `${PLANS}/${plan.id}`,
      body: { ...planForm(plan), note: "A yolda" },
      during: async () => ctx.other.put(`${PLANS}/${plan.id}`, { ...planForm(plan), total: "1300" }),
    });
    assert.equal(race.mid.status, 200, "ön koşul: B'nin düzeltmesi gövde yoldayken bitti");
    const row = ctx.store.get("SELECT total, note FROM plans WHERE id = ?", plan.id);
    assert.equal(race.reply.status, 409, `gövde yoldayken değişen kart 409 (gelen ${race.reply.status}); veri tabanında ${JSON.stringify(row)}`);
    assert.equal(race.reply.body?.code, "plan-stale");
    assert.deepEqual({ ...row }, { total: 1300, note: plan.note || "" });
  });

  test("Taksit kartı GERİLEME: sürümsüz 200; güncel sürümle 200 ve ardışık ikinci 200; Kartı Kapat (yalnız status, sürümsüz) 200; tahsilat kartın sürümünü ilerletmez", async () => {
    const plan = await makePlan(ctx);
    assert.equal((await ctx.api.put(`${PLANS}/${plan.id}`, { ...planForm(plan), updatedAt: undefined, note: "sürümsüz" })).status, 200);
    const fresh = await must("kart", ctx.api.get(`${PLANS}/${plan.id}`));
    await must("tahsilat", ctx.api.post(`${PLANS}/${plan.id}/entries`, { kind: "in", amount: "100", date: DAY, method: "cash" }));
    await sleep(5);
    const one = await must("güncel 1 (tahsilattan sonra)", ctx.api.put(`${PLANS}/${plan.id}`, { ...planForm(fresh), note: "bir" }));
    assert.notEqual(one.updatedAt, fresh.updatedAt, "ön koşul: kendi düzeltmesi sürümü ilerletti");
    await sleep(5);
    await must("ardışık 2", ctx.api.put(`${PLANS}/${plan.id}`, { ...planForm(one), note: "iki" }));
    await must("Kartı Kapat", ctx.api.put(`${PLANS}/${plan.id}`, { status: "closed" }));
    assert.deepEqual({ ...ctx.store.get("SELECT note, status FROM plans WHERE id = ?", plan.id) }, { note: "iki", status: "closed" });
  });

  test("Stok kartı: B Satış Fiyatı'nı 15 → 20 yapar, A yalnız notu değiştirip kaydeder → 409 stock-item-stale; 20 durur", async () => {
    const item = await makeStock(ctx);
    await sleep(5);
    await must("B 20", ctx.other.put(`${STOCK}/${item.id}`, { ...stockForm(item), salePrice: "20" }));
    const res = await ctx.api.put(`${STOCK}/${item.id}`, { ...stockForm(item), note: "A'nın notu" });
    const row = ctx.store.get("SELECT sale_price AS salePrice, note FROM stock_items WHERE id = ?", item.id);
    assert.equal(res.status, 409, `A'nın eskimiş formu 409 almalı (gelen ${res.status}); veri tabanında ${JSON.stringify(row)}`);
    assert.equal(res.data?.code, "stock-item-stale");
    assert.match(String(res.error || res.data?.error || ""), /Bu stok kartı siz açtıktan sonra başka biri tarafından değiştirildi; değişikliğiniz kaydedilmedi/);
    assert.deepEqual({ ...row }, { salePrice: 20, note: item.note || "" });
  });

  test("Stok kartı: form açıkken B fiyatlı ALIM girer (Alış Fiyatı 10 → 12) → A'nın eskimiş formu 409; Alış Fiyatı 12 durur", async () => {
    const item = await makeStock(ctx);
    await sleep(5);
    await must("B alım 12", ctx.other.post(`${STOCK}/${item.id}/moves`, { kind: "in", qty: 1, unitPrice: "12", pay: "none", date: DAY }));
    assert.equal(ctx.store.get("SELECT unit_price AS p FROM stock_items WHERE id = ?", item.id).p, 12, "ön koşul: alım kartın Alış Fiyatı'nı güncelledi");
    const res = await ctx.api.put(`${STOCK}/${item.id}`, { ...stockForm(item), note: "A" });
    assert.equal(res.status, 409, `gelen ${res.status}; Alış Fiyatı ${ctx.store.get("SELECT unit_price AS p FROM stock_items WHERE id = ?", item.id).p}`);
    assert.equal(res.data?.code, "stock-item-stale");
    assert.equal(ctx.store.get("SELECT unit_price AS p FROM stock_items WHERE id = ?", item.id).p, 12);
  });

  test("Stok kartı GÖVDE YOLDAYKEN: B kartı düzeltir → 409 (güncel kartla)", async () => {
    const item = await makeStock(ctx);
    await sleep(5);
    const race = await raceWrite(ctx, {
      path: `${STOCK}/${item.id}`,
      body: { ...stockForm(item), note: "A yolda" },
      during: async () => ctx.other.put(`${STOCK}/${item.id}`, { ...stockForm(item), salePrice: "25" }),
    });
    assert.equal(race.mid.status, 200, "ön koşul: B'nin düzeltmesi gövde yoldayken bitti");
    const row = ctx.store.get("SELECT sale_price AS salePrice, note FROM stock_items WHERE id = ?", item.id);
    assert.equal(race.reply.status, 409, `gelen ${race.reply.status}; veri tabanında ${JSON.stringify(row)}`);
    assert.equal(race.reply.body?.code, "stock-item-stale");
    assert.deepEqual({ ...row }, { salePrice: 25, note: item.note || "" });
  });

  test("Stok kartı GERİLEME: sürümsüz 200; güncel sürümle 200 ve ardışık ikinci 200; silinmiş ürün 404", async () => {
    const item = await makeStock(ctx);
    assert.equal((await ctx.api.put(`${STOCK}/${item.id}`, { ...stockForm(item), updatedAt: undefined, note: "sürümsüz" })).status, 200);
    const fresh = await must("kart", ctx.api.get(`${STOCK}/${item.id}`));
    await sleep(5);
    const one = await must("güncel 1", ctx.api.put(`${STOCK}/${item.id}`, { ...stockForm(fresh), note: "bir" }));
    assert.notEqual(one.updatedAt, fresh.updatedAt, "ön koşul: kendi düzeltmesi sürümü ilerletti");
    await sleep(5);
    await must("ardışık 2", ctx.api.put(`${STOCK}/${item.id}`, { ...stockForm(one), note: "iki" }));
    assert.equal(ctx.store.get("SELECT note FROM stock_items WHERE id = ?", item.id).note, "iki");
    await must("B siler", ctx.other.del(`${STOCK}/${item.id}`));
    const gone = await ctx.api.put(`${STOCK}/${item.id}`, { ...stockForm(one), note: "x" });
    assert.equal(gone.status, 404);
  });
});
