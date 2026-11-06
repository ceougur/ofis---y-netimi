// 2.5.0 BİRLEŞİK TUR 2 — YAN-3 (birleşik tur 1 dar kontrolünün dişsiz bulduğu yollar; prensip §4: yalnız test, aynı tur). Birleşik tur 1 (800ce6e0) dört düzeltme
// ucunda hareketi yazım işleminin İÇİNDE (bank.post prepare) yeniden okuyor; bu dosya o kararın üç yolunu dişli yapar:
//  (a) Kasa ↔ Banka transferi ÖBÜR bacaktan (banka tarafı) düzeltilirken Kasa tarafının düzeltmesi yolda: Kasa "Engelle" güncel bacakla hesaplanır.
//      Eski kodda (03c04532) Kasa −50 olur ve Mutabakat Testi yine "ok" der (dar kontrol probe1 S3).
//  (b) Gövde yoldayken dönem kilitlenir (dört uç) ya da taksit kartının kapanış günü kilitli döneme girer: karar işlemin içinde → 409 period-locked, yazılmaz.
//  (c) İKİNCİ SÜREÇ (ayrı bağlantı) yazım kilidini tutarken düzeltme gelir: aynı süreçteki yarışta "gövdeden sonra ama işlemin DIŞINDA okuma" mutantı ayırt
//      edilemiyordu (okuma ile işlem arasına aynı süreçten istek giremez); ikinci süreç arada yazar → mutant bayat satırla (Kasa −50, kayıp güncelleme,
//      iyimser kilit atlanır) yazar, gerçek kod kilit alındıktan sonra okur (dar kontrol probe3 + dis-yazar.mjs deseni).
// Yarış zorla üretilir (ders 20): başlıklar gider, gövde bekletilir, arada öbür isteğin BİTTİĞİ (ya da dış sürecin kilidi aldığı) okunur, sonra gövde gider.
// Sahte saat (ders 13); lisans servisi ölü adres (ders 30). Dış süreç yalnız SQLite bağlantısıdır (program açmaz). Windows'a duyarlı (ders 48): dosya kilidi.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { after, before, describe, test } from "node:test";
import { apiOf, boot, must } from "./banka-210-ortak.mjs";
import { createUser } from "./helpers.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const DAY = "2026-10-08";
const PAST = "2026-10-05";
const LOCK = "2026-10-06";
const ACC = "/api/workspace/accounts";
const STOCK = "/api/workspace/stock";
const PLANS = "/api/workspace/plans";
const CASH = "/api/workspace/cash";

/** Yarış (zorla): başlıklar gider, gövde bekletilir; `during` BİTER, sonra gövde gönderilir. */
async function raceWrite(ctx, { path, body, during }) {
  const text = JSON.stringify(body);
  const { port } = new URL(ctx.server.base);
  let mid = null;
  const reply = await new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method: "PUT", path, headers: { cookie: ctx.api.client.cookie, "content-type": "application/json", "content-length": Buffer.byteLength(text) } }, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = { error: data };
        }
        resolve({ status: res.statusCode, body: parsed || {}, text: data });
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
  const ctx = await boot({ now: { time: NOW, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
  ctx.other = apiOf(await createUser(ctx.server, ctx.api.client, { username: "tur2muh", role: "muhasebe" }));
  let seq = 0;
  ctx.next = () => (seq += 1);
  ctx.kasa = async () => (await must("Kasa", ctx.api.get(CASH))).byMethod.cash;
  ctx.policy = async cash => must(`politika ${cash}`, ctx.api.put("/api/admin/negative-policy", { cash }));
  ctx.setKasa = async target => {
    await ctx.policy("off");
    const delta = Math.round((target - (await ctx.kasa())) * 100) / 100;
    if (Math.abs(delta) >= 0.005) await must("Kasa ayarı", ctx.api.post(CASH, { kind: delta > 0 ? "in" : "out", amount: String(Math.abs(delta)), date: DAY, description: `Ayar ${ctx.next()}` }));
    assert.equal(await ctx.kasa(), target, "ön koşul: Kasa hedefte");
  };
  ctx.lock = async until => must(`dönem kilidi ${until || "kaldır"}`, ctx.api.put("/api/admin/period-lock", { lockedUntil: until }));
  ctx.file = ctx.store.all("PRAGMA database_list").find(row => row.name === "main").file;
  ctx.integrity = async () => must("Mutabakat Testi", ctx.api.get("/api/workspace/ledger/integrity"));
  return ctx;
}

// Dört uç: make(yön, tutar, tarih) hareketi açar ("out" Kasa'dan çıkış, "in" Kasa'ya giriş); body(tutar) düzeltme gövdesi; outside(id, tutar) dış sürecin SQL'i.
function routes(ctx) {
  return {
    cari: {
      table: "account_entries",
      async make(way, amount, date = DAY, note = "ilk not") {
        const account = await must("cari", ctx.api.post(ACC, { name: `Tur2 Cari ${ctx.next()}`, type: way === "out" ? "supplier" : "customer", registeredOn: "2026-09-01" }));
        const made = await must("hareket", ctx.api.post(`${ACC}/${account.id}/entries`, { kind: way, amount: String(amount), date, method: "cash", note }));
        return { id: made.entryId, path: `${ACC}/${account.id}/entries/${made.entryId}`, kind: way, date };
      },
      body: (made, amount) => ({ amount: String(amount) }),
      outside: ["UPDATE account_entries SET amount = ?, updated_at = ? WHERE id = ?", amount => [amount]],
      amountOf: id => Number(ctx.store.get("SELECT amount FROM account_entries WHERE id = ?", id)?.amount),
    },
    stok: {
      table: "stock_moves",
      async make(way, amount, date = DAY, note = "ilk not") {
        const item = await must("ürün", ctx.api.post(STOCK, { name: `Tur2 Ürün ${ctx.next()}`, unit: "Adet", unitPrice: 10, openingQty: "10", openingDate: "2026-09-01" }));
        const made = await must("hareket", ctx.api.post(`${STOCK}/${item.id}/moves`, { kind: way === "out" ? "in" : "out", qty: 1, unitPrice: amount, pay: "cash", method: "cash", date, note }));
        return { id: made.moveId, path: `${STOCK}/${item.id}/moves/${made.moveId}`, date };
      },
      body: (made, amount) => ({ unitPrice: amount }),
      outside: ["UPDATE stock_moves SET unit_price = ?, amount = ?, updated_at = ? WHERE id = ?", amount => [amount, amount]],
      amountOf: id => Number(ctx.store.get("SELECT amount FROM stock_moves WHERE id = ?", id)?.amount),
    },
    taksit: {
      table: "plan_entries",
      async make(way, amount, date = DAY, note = "ilk not") {
        const account = await must("cari", ctx.api.post(ACC, { name: `Tur2 Kart ${ctx.next()}`, type: "customer", registeredOn: "2026-09-01" }));
        const plan = await must("kart", ctx.api.post(PLANS, { accountId: account.id, name: `Tur2 Kart ${ctx.next()}`, total: "5000", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: "2026-09-01" }));
        if (way === "out") await must("tahsilat", ctx.api.post(`${PLANS}/${plan.id}/entries`, { kind: "in", amount: "2000", date, method: "cash" }));
        const made = await must("hareket", ctx.api.post(`${PLANS}/${plan.id}/entries`, { kind: way, amount: String(amount), date, method: "cash", note }));
        return { id: made.entryId, planId: plan.id, path: `${PLANS}/${plan.id}/entries/${made.entryId}`, date };
      },
      body: (made, amount) => ({ amount: String(amount) }),
      outside: ["UPDATE plan_entries SET amount = ?, updated_at = ? WHERE id = ?", amount => [amount]],
      amountOf: id => Number(ctx.store.get("SELECT amount FROM plan_entries WHERE id = ?", id)?.amount),
    },
    kasa: {
      table: "cash_entries",
      async make(way, amount, date = DAY, note = "") {
        const description = note || `Tur2 Kasa ${ctx.next()}`;
        const made = await must("hareket", ctx.api.post(CASH, { kind: way, amount: String(amount), date, description }));
        return { id: made.id, path: `${CASH}/${made.id}`, kind: way, date, description };
      },
      // Kasa düzeltmesi bütün alanları ister.
      body: (made, amount) => ({ kind: made.kind, amount: String(amount), date: made.date, description: made.description }),
      outside: ["UPDATE cash_entries SET amount = ?, updated_at = ? WHERE id = ?", amount => [amount]],
      amountOf: id => Number(ctx.store.get("SELECT amount FROM cash_entries WHERE id = ?", id)?.amount),
    },
  };
}
const NAMES = ["cari", "stok", "taksit", "kasa"];

describe("2.5.0 BİRLEŞİK TUR 2 (a) — transfer ÖBÜR bacaktan düzeltilirken Kasa tarafının düzeltmesi yolda", () => {
  let ctx;
  before(async () => {
    ctx = await world();
  });
  after(async () => ctx?.server.close());

  test("Kasa Engelle: banka bacağı 300 → 400 (Kasa 150) yazılırken yöneticinin Kasa bacağını 300 → 200 düzeltmesi güncel bacakla 409 cash-blocked; Kasa 150, iki bacak 400, Mutabakat ok", async () => {
    await ctx.setKasa(0);
    const made = await must("transfer", ctx.api.post(`${CASH}/transfer`, { direction: "to-cash", amount: "300", date: DAY, description: "Tur2 Transfer" }));
    await must("çıkış 250", ctx.api.post(CASH, { kind: "out", amount: "250", date: DAY, description: "Tur2 Çıkış 250" }));
    assert.equal(await ctx.kasa(), 50, "ön koşul: Kasa 50");
    await ctx.policy("block");
    const bankLeg = ctx.store.get("SELECT kind FROM cash_entries WHERE id = ?", made.bankId);
    const race = await raceWrite(ctx, {
      path: `${CASH}/${made.id}`,
      body: { kind: "in", amount: "200", date: DAY, description: "Tur2 Transfer" },
      during: async () => {
        const res = await ctx.other.put(`${CASH}/${made.bankId}`, { kind: bankLeg.kind, amount: "400", date: DAY, description: "Tur2 Transfer" });
        return { status: res.status, error: res.error, kasa: await ctx.kasa() };
      },
    });
    await ctx.policy("off");
    assert.deepEqual([race.mid.status, race.mid.kasa], [200, 150], `ön koşul: öbür kullanıcı banka bacağını 400 yaptı, Kasa 150 (${race.mid.status} ${race.mid.error})`);
    const problems = [];
    if (race.reply.status !== 409 || race.reply.body.code !== "cash-blocked") problems.push(`Kasa bacağının düzeltmesi güncel bacakla engellenmeli (409 cash-blocked) — ${race.reply.status} ${race.reply.body.code || ""} ${race.reply.text.slice(0, 120)}`);
    else if (!/400,00 TL'den 200,00 TL'ye düzeltilince Nakit Kasa'dan 200,00 TL düşer; Nakit Kasa 150,00 TL iken -50,00 TL olur\./.test(race.reply.body.error)) problems.push(`ileti güncel bacağı söylemeli — “${race.reply.body.error}”`);
    const kasa = await ctx.kasa();
    if (kasa !== 150) problems.push(`Kasa ${kasa} (beklenen 150; Engelle politikasında eksiye düşmez)`);
    const legs = ctx.store.all("SELECT method, amount FROM cash_entries WHERE transfer_id = ? ORDER BY method", made.transferId).map(leg => [leg.method, Number(leg.amount)]);
    if (JSON.stringify(legs) !== JSON.stringify([["bank", 400], ["cash", 400]])) problems.push(`bacaklar ${JSON.stringify(legs)} (beklenen ikisi de 400)`);
    const integrity = await ctx.integrity();
    if (integrity.ok !== true) problems.push(`Mutabakat Testi: ${JSON.stringify(integrity.failures).slice(0, 200)}`);
    assert.deepEqual(problems, [], problems.join(" | "));
  });

  test("iyimser kilit transferde: öbür bacaktan düzeltme açılan bacağın sürümünü de ilerletir — Kasa bacağının eski sürümüyle gelen düzeltme 409 cash-entry-stale", async () => {
    const made = await must("transfer", ctx.api.post(`${CASH}/transfer`, { direction: "to-cash", amount: "300", date: DAY, description: "Tur2 Transfer S" }));
    const opened = ctx.store.get("SELECT updated_at AS u FROM cash_entries WHERE id = ?", made.id).u || "";
    const bankLeg = ctx.store.get("SELECT kind FROM cash_entries WHERE id = ?", made.bankId);
    const res = await ctx.other.put(`${CASH}/${made.bankId}`, { kind: bankLeg.kind, amount: "320", date: DAY, description: "Tur2 Transfer S", updatedAt: "" });
    assert.equal(res.status, 200, `ön koşul: öbür bacak düzeltildi (${res.status} ${res.error})`);
    const stale = await ctx.api.put(`${CASH}/${made.id}`, { kind: "in", amount: "300", date: DAY, description: "Tur2 Transfer S yeni not", updatedAt: opened });
    assert.deepEqual([stale.status, stale.code], [409, "cash-entry-stale"], `${stale.status} ${stale.error}`);
    const legs = ctx.store.all("SELECT amount, description FROM cash_entries WHERE transfer_id = ?", made.transferId);
    assert.ok(legs.every(leg => Number(leg.amount) === 320 && leg.description === "Tur2 Transfer S"), `bacaklar öbür kullanıcının değerinde: ${JSON.stringify(legs)}`);
  });
});

describe("2.5.0 BİRLEŞİK TUR 2 (b) — gövde yoldayken dönem kilitlenir / kartın kapanış günü kilitli döneme girer", () => {
  let ctx;
  let R;
  before(async () => {
    ctx = await world();
    R = routes(ctx);
    await ctx.policy("off");
  });
  after(async () => ctx?.server.close());

  test("dört uç: hareket 05.10 tarihli; düzeltme yoldayken dönem 06.10'a kadar kilitlenir → 409 period-locked (işlemin içinde), tutar değişmez", async () => {
    const problems = [];
    for (const name of NAMES) {
      const route = R[name];
      const made = await route.make("in", 100, PAST);
      const race = await raceWrite(ctx, { path: made.path, body: route.body(made, 150), during: async () => ctx.lock(LOCK) });
      await ctx.lock("");
      if (race.reply.status !== 409 || race.reply.body.code !== "period-locked") problems.push(`${name}: 409 period-locked olmalı — ${race.reply.status} ${race.reply.body.code || ""} ${race.reply.text.slice(0, 120)}`);
      else if (!/05\.10\.2026 tarihli; 06\.10\.2026 ve öncesi kapatılmış \(kilitli\) dönemdir\./.test(race.reply.body.error)) problems.push(`${name}: ileti — “${race.reply.body.error}”`);
      if (route.amountOf(made.id) !== 100) problems.push(`${name}: tutar ${route.amountOf(made.id)} (beklenen 100)`);
    }
    assert.deepEqual(problems, [], problems.join(" | "));
  });

  test("taksit: kart 08.10'da kapatıldı, tahsilatı 10.10 tarihli; düzeltme yoldayken dönem 09.10'a kadar kilitlenir → kartın kapanışı kilitli: 409, tutar değişmez", async () => {
    const account = await must("cari", ctx.api.post(ACC, { name: "Tur2 Kapanan Kart", type: "customer", registeredOn: "2026-09-01" }));
    const plan = await must("kart", ctx.api.post(PLANS, { accountId: account.id, name: "Tur2 Kapanan Kart", total: "5000", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: "2026-09-01" }));
    await must("kartı kapat", ctx.api.put(`${PLANS}/${plan.id}`, { status: "closed" }));
    ctx.server.clock.set("2026-10-10T12:00:00+03:00");
    try {
      const made = await must("kapalı kartta tahsilat", ctx.api.post(`${PLANS}/${plan.id}/entries`, { kind: "in", amount: "100", date: "2026-10-10", method: "cash" }));
      const path = `${PLANS}/${plan.id}/entries/${made.entryId}`;
      const race = await raceWrite(ctx, { path, body: { amount: "150" }, during: async () => ctx.lock("2026-10-09") });
      await ctx.lock("");
      const problems = [];
      if (race.reply.status !== 409 || race.reply.body.code !== "period-locked") problems.push(`409 period-locked olmalı — ${race.reply.status} ${race.reply.body.code || ""} ${race.reply.text.slice(0, 160)}`);
      else if (!/Bu kart 08\.10\.2026 tarihinde kapatıldı/.test(race.reply.body.error)) problems.push(`ileti kartın kapanışını söylemeli — “${race.reply.body.error}”`);
      const amount = Number(ctx.store.get("SELECT amount FROM plan_entries WHERE id = ?", made.entryId).amount);
      if (amount !== 100) problems.push(`tutar ${amount} (beklenen 100)`);
      assert.deepEqual(problems, [], problems.join(" | "));
    } finally {
      ctx.server.clock.set(NOW);
    }
  });
});

describe("2.5.0 BİRLEŞİK TUR 2 (c) — İKİNCİ SÜREÇ yazım kilidini tutarken düzeltme gelir: karar kilit alındıktan SONRA okunan satırla", () => {
  let ctx;
  let R;
  before(async () => {
    ctx = await world();
    R = routes(ctx);
  });
  after(async () => ctx?.server.close());

  test("Kasa Engelle (dört uç): dış süreç hareketi 100 → 10 yapıp kilidi tutarken yöneticinin 100 → 650 düzeltmesi gelir → 409 cash-blocked güncel satırla; Kasa 590", async () => {
    const problems = [];
    for (const name of NAMES) {
      const route = R[name];
      await ctx.policy("off");
      const made = await route.make("out", 100);
      await ctx.setKasa(500);
      await ctx.policy("block");
      const [sql, values] = route.outside;
      const writer = await outsideWriter(ctx.file, sql, [...values(10), "2026-10-08T09:30:00.000Z", made.id]);
      assert.equal(writer.changes, 1, `${name}: ön koşul — dış süreç satırı değiştirdi ve kilidi tutuyor`);
      const reply = await ctx.api.put(made.path, route.body(made, 650));
      const exit = await writer.done;
      await ctx.policy("off");
      assert.equal(exit.code, 0, `${name}: dış süreç COMMIT etti (${exit.err.slice(0, 200)})`);
      if (reply.status !== 409 || reply.code !== "cash-blocked") problems.push(`${name}: güncel satırla 409 cash-blocked olmalı — ${reply.status} ${reply.code || ""} ${String(reply.error || "").slice(0, 120)}`);
      else if (!/10,00 TL'den 650,00 TL'ye/.test(reply.error)) problems.push(`${name}: ileti güncel satırı söylemeli — “${reply.error}”`);
      if (route.amountOf(made.id) !== 10) problems.push(`${name}: hareket ${route.amountOf(made.id)} (beklenen dış sürecin 10'u)`);
      const kasa = await ctx.kasa();
      if (kasa !== 590) problems.push(`${name}: Kasa ${kasa} (beklenen 590)`);
    }
    assert.deepEqual(problems, [], problems.join(" | "));
  });

  test("kayıp güncelleme + iyimser kilit (cari): dış süreç açıklamayı değiştirir → yalnız tutarlı düzeltme açıklamayı KORUR; dış süreç sürümü ilerletince eski sürümle gelen düzeltme 409", async () => {
    await ctx.policy("off");
    const route = R.cari;
    const made = await route.make("out", 300);
    const w1 = await outsideWriter(ctx.file, "UPDATE account_entries SET note = ? WHERE id = ?", ["dış süreç notu", made.id]);
    const r1 = await ctx.api.put(made.path, { amount: "350" });
    await w1.done;
    const row1 = ctx.store.get("SELECT amount, note FROM account_entries WHERE id = ?", made.id);
    assert.equal(r1.status, 200, `${r1.status} ${r1.error}`);
    assert.deepEqual([Number(row1.amount), row1.note], [350, "dış süreç notu"], "tutar düzeltildi, dış sürecin açıklaması korundu (bayat satır gövdeyle birleşmedi)");
    const opened = ctx.store.get("SELECT updated_at AS u FROM account_entries WHERE id = ?", made.id).u || "";
    const w2 = await outsideWriter(ctx.file, "UPDATE account_entries SET amount = 10, updated_at = ? WHERE id = ?", ["2026-10-08T09:45:00.000Z", made.id]);
    const r2 = await ctx.api.put(made.path, { amount: "350", note: "yöneticinin notu", updatedAt: opened });
    await w2.done;
    assert.deepEqual([r2.status, r2.code], [409, "account-entry-stale"], `${r2.status} ${r2.error}`);
    const row2 = ctx.store.get("SELECT amount, note FROM account_entries WHERE id = ?", made.id);
    assert.deepEqual([Number(row2.amount), row2.note], [10, "dış süreç notu"], "satır dış sürecin değerinde");
  });
});
