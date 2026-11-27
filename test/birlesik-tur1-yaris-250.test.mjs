// 2.5.0 BİRLEŞİK TUR 1 — YB-1 / YB-2 (docs/2.5.0-IS-LISTESI.md E "05.11 23:05 BİRLEŞİK DAR KONTROL BİTTİ"; dar kontrol betikleri kasa-kilit-yaris.mjs,
// yan-kasa-yaris.mjs). Dört hareket düzeltme ucu — cari (PUT /accounts/:id/entries/:id), stok (PUT /stock/:id/moves/:id), taksit kartı
// (PUT /plans/:id/entries/:id), Kasa (PUT /cash/:id) — hareketi isteğin BAŞINDA okuyup gövdeyi bekliyordu; korumalar bu bayat satırla hesaplanıyordu.
// Nasıl bozulur (testler buradan): (1) gövde yoldayken öbür kullanıcı aynı hareketi küçültür → Kasa "Engelle" bayat satırla geçer, Kasa eksiye düşer;
// (2) aynısı "Uyar"da → soru hiç sorulmaz; (3) gövde yoldayken hareket silinir → önce yanıltıcı Kasa sorusu, Kasa ucunda 200 + sahte "cash.entry.updated";
// (4) transferin öbür tarafı yok olur; (5) küçülen tahsilat "büyümüyor" sayılıp K8 (Fazlasını Avans Yaz) sorusu atlanır; (6) gövdede yalnız değişen alan →
// bayat satır gövdeyle birleşip öbür kullanıcının düzeltmesini siler, Değişiklik Geçmişi'nin "önceki"si yanlış; (7) form açıldıktan sonra değişen satırın
// üstüne yazılır (iyimser kilit yok); (8) düzeltme yarışsızken bozulur (gerileme: Kontrol Yok / Uyar / Engelle, yinelenen istek).
// BAŞ MİMAR KARARI (iş listesi E 23:05): korumalar, gövdeyle birleştirme ve Değişiklik Geçmişi'nin "önceki"si yazım İŞLEMİNİN İÇİNDE (bank.post prepare) yeniden
// okunan güncel satırla; silinmişse 404 BS-3 iletisi; gövdede updatedAt varsa iyimser kilit (lib/row-version.mjs; staff-stale / cheque-stale kalıbı), yoksa bugünkü
// davranış. Yarış zorla üretilir (ders 20): başlıklar gider, gövde bekletilir, arada öbür kullanıcının isteği BİTER (ön koşul okunur), sonra gövde gider.
// Eski kodda (03c04532) beklenen kırmızı (ders 38): (1) "yanıt 200" + Kasa −50; (2) "soru yok (200)"; (3) "409 cash-negative" / "200"; (5) "200, net 1200";
// (6) açıklama "ilk not"; (7) "yanıt 200". Sahte saat (ders 13); lisans servisi ölü adres (ders 30).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import http from "node:http";
import { after, before, describe, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { apiOf, boot, must, rawRun } from "./banka-210-ortak.mjs";
import { createUser } from "./helpers.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const DAY = "2026-10-08";
const ACC = "/api/workspace/accounts";
const STOCK = "/api/workspace/stock";
const PLANS = "/api/workspace/plans";
const CASH = "/api/workspace/cash";
const STALE = {
  cari: { code: "account-entry-stale", message: "Bu cari hareketi siz açtıktan sonra başka biri tarafından değiştirildi; düzeltmeniz kaydedilmedi. Listeyi yenileyip yeniden deneyin." },
  stok: { code: "stock-move-stale", message: "Bu stok hareketi siz açtıktan sonra başka biri tarafından değiştirildi; düzeltmeniz kaydedilmedi. Listeyi yenileyip yeniden deneyin." },
  taksit: { code: "plan-entry-stale", message: "Bu taksit hareketi siz açtıktan sonra başka biri tarafından değiştirildi; düzeltmeniz kaydedilmedi. Kartı yenileyip yeniden deneyin." },
  kasa: { code: "cash-entry-stale", message: "Bu Kasa hareketi siz açtıktan sonra başka biri tarafından değiştirildi; düzeltmeniz kaydedilmedi. Listeyi yenileyip yeniden deneyin." },
};
const GONE = {
  cari: "Hareket bulunamadı. Başka biri silmiş olabilir.",
  stok: "Stok hareketi bulunamadı. Başka biri silmiş olabilir.",
  taksit: "Hareket bulunamadı. Başka biri silmiş olabilir.",
  kasa: "Kasa hareketi bulunamadı. Başka biri silmiş olabilir.",
};

/** Yarış (zorla): başlıklar gider, gövde bekletilir; `during` (öbür kullanıcının isteği) BİTER, sonra gövde gönderilir. */
async function raceWrite(ctx, { path, body, during, cookie = ctx.api.client.cookie }) {
  const text = JSON.stringify(body);
  const { port } = new URL(ctx.server.base);
  let mid = null;
  const reply = await new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method: "PUT", path, headers: { cookie, "content-type": "application/json", "content-length": Buffer.byteLength(text) } }, res => {
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

async function world() {
  const ctx = await boot({ now: NOW, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
  await must("kurulum", ctx.api.post("/api/workspace/bank/setup/dismiss", {}));
  ctx.other = apiOf(await createUser(ctx.server, ctx.api.client, { username: "tur1muh", role: "muhasebe" }));
  let seq = 0;
  ctx.next = () => (seq += 1);
  ctx.kasa = async () => (await must("Kasa", ctx.api.get(CASH))).byMethod.cash;
  ctx.policy = async cash => must(`politika ${cash}`, ctx.api.put("/api/admin/negative-policy", { cash }));
  // Kasa'yı hedefe getirir (Kontrol Yok iken elle Kasa girişi / çıkışı).
  ctx.setKasa = async target => {
    await ctx.policy("off");
    const delta = Math.round((target - (await ctx.kasa())) * 100) / 100;
    if (Math.abs(delta) >= 0.005) await must("Kasa ayarı", ctx.api.post(CASH, { kind: delta > 0 ? "in" : "out", amount: String(Math.abs(delta)), date: DAY, description: `Ayar ${ctx.next()}` }));
    assert.equal(await ctx.kasa(), target, "ön koşul: Kasa hedefte");
  };
  // Bütün tabloların satır sayısı ve içerik özeti (sqlite_master; tablo eklense de kapsar).
  ctx.snapshot = () => {
    const out = {};
    for (const { name } of ctx.store.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")) {
      const rows = ctx.store.all(`SELECT * FROM "${name}"`).map(row => JSON.stringify(row)).sort();
      out[name] = `${rows.length}:${createHash("sha256").update(rows.join("\n")).digest("hex").slice(0, 16)}`;
    }
    return out;
  };
  ctx.changedTables = beforeSnap => {
    const now = ctx.snapshot();
    return Object.keys({ ...beforeSnap, ...now }).filter(key => beforeSnap[key] !== now[key]).map(key => `${key} ${beforeSnap[key] ?? "YOK"} → ${now[key] ?? "YOK"}`);
  };
  ctx.audits = (type, id) => ctx.store.all("SELECT payload_json AS p FROM audit_events WHERE type = ? AND entity_id = ? ORDER BY rowid", type, id).map(row => JSON.parse(row.p));
  return ctx;
}

// Dört uç: make(yön, tutar) hareketi açar; Kasa'ya etkisi yön ile ("out" Kasa'dan çıkış, "in" Kasa'ya giriş). body(tutar) düzeltme gövdesi.
function routes(ctx) {
  return {
    cari: {
      table: "account_entries",
      audit: "account.entry.updated",
      async make(way, amount, note = "") {
        const account = await must("cari", ctx.api.post(ACC, { name: `Tur1 Cari ${ctx.next()}`, type: way === "out" ? "supplier" : "customer", registeredOn: "2026-09-01" }));
        const made = await must("hareket", ctx.api.post(`${ACC}/${account.id}/entries`, { kind: way, amount: String(amount), date: DAY, method: "cash", ...(note ? { note } : {}) }));
        return { id: made.entryId, path: `${ACC}/${account.id}/entries/${made.entryId}`, del: `${ACC}/${account.id}/entries/${made.entryId}?cashForce=1` };
      },
      body: amount => ({ amount: String(amount) }),
      amountOf: id => Number(ctx.store.get("SELECT amount FROM account_entries WHERE id = ?", id)?.amount),
    },
    stok: {
      table: "stock_moves",
      audit: "stock.move.updated",
      async make(way, amount, note = "") {
        const item = await must("ürün", ctx.api.post(STOCK, { name: `Tur1 Ürün ${ctx.next()}`, unit: "Adet", unitPrice: 10, openingQty: "10" }));
        // Kasa'dan çıkış = peşin alım (giriş); Kasa'ya giriş = peşin satış (çıkış).
        const made = await must("hareket", ctx.api.post(`${STOCK}/${item.id}/moves`, { kind: way === "out" ? "in" : "out", qty: 1, unitPrice: amount, pay: "cash", method: "cash", date: DAY, ...(note ? { note } : {}) }));
        return { id: made.moveId, path: `${STOCK}/${item.id}/moves/${made.moveId}`, del: `${STOCK}/${item.id}/moves/${made.moveId}?cashForce=1` };
      },
      body: amount => ({ unitPrice: amount }),
      amountOf: id => Number(ctx.store.get("SELECT amount FROM stock_moves WHERE id = ?", id)?.amount),
    },
    taksit: {
      table: "plan_entries",
      audit: "plan.entry.updated",
      async make(way, amount, note = "") {
        const account = await must("cari", ctx.api.post(ACC, { name: `Tur1 Kart ${ctx.next()}`, type: "customer", registeredOn: "2026-09-01" }));
        const plan = await must("kart", ctx.api.post(PLANS, { accountId: account.id, name: `Tur1 Kart ${ctx.next()}`, total: "5000", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: DAY }));
        // İade (Kasa'dan çıkış) kartın net tahsilatını aşamaz: önce 2.000 tahsilat.
        if (way === "out") await must("tahsilat", ctx.api.post(`${PLANS}/${plan.id}/entries`, { kind: "in", amount: "2000", date: DAY, method: "cash" }));
        const made = await must("hareket", ctx.api.post(`${PLANS}/${plan.id}/entries`, { kind: way, amount: String(amount), date: DAY, method: "cash", ...(note ? { note } : {}) }));
        return { id: made.entryId, planId: plan.id, path: `${PLANS}/${plan.id}/entries/${made.entryId}`, del: `${PLANS}/${plan.id}/entries/${made.entryId}?cashForce=1` };
      },
      body: amount => ({ amount: String(amount) }),
      amountOf: id => Number(ctx.store.get("SELECT amount FROM plan_entries WHERE id = ?", id)?.amount),
    },
    kasa: {
      table: "cash_entries",
      audit: "cash.entry.updated",
      async make(way, amount) {
        const description = `Tur1 Kasa ${ctx.next()}`;
        const made = await must("hareket", ctx.api.post(CASH, { kind: way, amount: String(amount), date: DAY, description }));
        ctx.kasaKinds ??= new Map();
        ctx.kasaKinds.set(made.id, { kind: way, description });
        return { id: made.id, path: `${CASH}/${made.id}`, del: `${CASH}/${made.id}?cashForce=1` };
      },
      // Kasa düzeltmesi bütün alanları ister (gövde birleştirilmez).
      bodyFor: (id, amount) => ({ kind: ctx.kasaKinds.get(id).kind, amount: String(amount), date: DAY, description: ctx.kasaKinds.get(id).description }),
      amountOf: id => Number(ctx.store.get("SELECT amount FROM cash_entries WHERE id = ?", id)?.amount),
    },
  };
}
const bodyOf = (route, made, amount) => (route.bodyFor ? route.bodyFor(made.id, amount) : route.body(amount));
const NAMES = ["cari", "stok", "taksit", "kasa"];

describe("2.5.0 BİRLEŞİK TUR 1 YB-1 — eşzamanlı düzeltmede korumalar işlemin içindeki GÜNCEL satırla (dört uç)", () => {
  let ctx;
  let R;
  before(async () => {
    ctx = await world();
    R = routes(ctx);
  });
  after(async () => ctx?.server.close());

  test("Kasa Engelle: yöneticinin 100 → 650 düzeltmesi yoldayken muhasebe aynı hareketi 100 → 10 yapar → 409 cash-blocked (güncel satırla), Kasa 590 kalır", async () => {
    const problems = [];
    for (const name of NAMES) {
      const route = R[name];
      await ctx.policy("off"); // hareket açılışı önceki adımın politikasına takılmasın
      const made = await route.make("out", 100);
      await ctx.setKasa(500);
      await ctx.policy("block");
      // Yarışsız denetim (ön koşul): 100 → 650 Kasa 500 iken engellenir.
      const plain = await ctx.api.put(made.path, bodyOf(route, made, 650));
      assert.deepEqual([plain.status, plain.code], [409, "cash-blocked"], `${name}: ön koşul yarışsız 409 cash-blocked (${plain.status} ${plain.error})`);
      const race = await raceWrite(ctx, {
        path: made.path,
        body: bodyOf(route, made, 650),
        during: async () => {
          const res = await ctx.other.put(made.path, bodyOf(route, made, 10));
          return { status: res.status, error: res.error, kasa: await ctx.kasa() };
        },
      });
      assert.deepEqual([race.mid.status, race.mid.kasa], [200, 590], `${name}: ön koşul — öbür kullanıcının 100 → 10 düzeltmesi gövde beklenirken yazıldı (${race.mid.status} ${race.mid.error})`);
      if (race.reply.status !== 409 || race.reply.body.code !== "cash-blocked") problems.push(`${name}: yöneticinin düzeltmesi güncel satırla engellenmeli (409 cash-blocked) — yanıt ${race.reply.status} ${race.reply.body.code || ""}`);
      else if (!/10,00 TL'den 650,00 TL'ye düzeltilince Nakit Kasa'dan 640,00 TL düşer; Nakit Kasa 590,00 TL iken -50,00 TL olur\./.test(race.reply.body.error)) problems.push(`${name}: ileti güncel satırı söylemeli — “${race.reply.body.error}”`);
      const kasa = await ctx.kasa();
      if (kasa !== 590) problems.push(`${name}: Kasa ${kasa} (beklenen 590; Engelle politikasında eksiye düşmez)`);
      if (route.amountOf(made.id) !== 10) problems.push(`${name}: hareket ${route.amountOf(made.id)} (beklenen öbür kullanıcının 10'u)`);
    }
    assert.deepEqual(problems, [], problems.join(" | "));
  });

  test("Kasa Uyar: aynı yarışta soru GÜNCEL satırla sorulur (409 cash-negative); \"Yine de Kaydet\" (cashForce) yazar, Kasa −50, Değişiklik Geçmişi'nin önceki tutarı 10", async () => {
    const problems = [];
    for (const name of NAMES) {
      const route = R[name];
      await ctx.policy("off"); // hareket açılışı önceki adımın politikasına takılmasın
      const made = await route.make("out", 100);
      await ctx.setKasa(500);
      await ctx.policy("warn");
      const race = await raceWrite(ctx, {
        path: made.path,
        body: bodyOf(route, made, 650),
        during: async () => {
          const res = await ctx.other.put(made.path, bodyOf(route, made, 10));
          return { status: res.status, kasa: await ctx.kasa() };
        },
      });
      assert.deepEqual([race.mid.status, race.mid.kasa], [200, 590], `${name}: ön koşul — öbür kullanıcının düzeltmesi yazıldı`);
      if (race.reply.status !== 409 || race.reply.body.code !== "cash-negative") problems.push(`${name}: soru sorulmalı (409 cash-negative) — yanıt ${race.reply.status} ${race.reply.body.code || ""}`);
      else if (!/10,00 TL'den 650,00 TL'ye/.test(race.reply.body.error) || !/590,00 TL iken -50,00 TL/.test(race.reply.body.error)) problems.push(`${name}: soru güncel satırı söylemeli — “${race.reply.body.error}”`);
      const forced = await ctx.api.put(made.path, { ...bodyOf(route, made, 650), cashForce: true });
      if (forced.status !== 200) problems.push(`${name}: Yine de Kaydet 200 olmalı — ${forced.status} ${forced.error}`);
      const kasa = await ctx.kasa();
      if (kasa !== -50) problems.push(`${name}: Kasa ${kasa} (beklenen −50)`);
      if (route.amountOf(made.id) !== 650) problems.push(`${name}: hareket ${route.amountOf(made.id)} (beklenen 650)`);
      const last = ctx.audits(route.audit, made.id).at(-1);
      if (Number(last?.previous?.amount) !== 10) problems.push(`${name}: Değişiklik Geçmişi önceki tutar ${last?.previous?.amount} (beklenen 10)`);
    }
    assert.deepEqual(problems, [], problems.join(" | "));
  });

  test("silinmiş hareket (Kasa Uyar): gövde yoldayken silinirse doğrudan 404 + BS-3 iletisi — önce yanıltıcı Kasa sorusu yok; hiçbir tablo yazılmaz", async () => {
    const problems = [];
    for (const name of NAMES) {
      const route = R[name];
      await ctx.policy("off"); // hareket açılışı önceki adımın politikasına takılmasın
      // Kasa'ya 1.000 giriş; silinince Kasa eksiye düşer, bayat satırla 1.000 → 500 düzeltmesi "Kasa eksiye düşer" sorusu verirdi.
      const made = await route.make("in", 1000);
      await ctx.setKasa(200);
      await ctx.policy("warn");
      let beforeSnap = null;
      const race = await raceWrite(ctx, {
        path: made.path,
        body: bodyOf(route, made, 500),
        during: async () => {
          const res = await ctx.other.del(made.del);
          beforeSnap = ctx.snapshot();
          return { status: res.status, error: res.error };
        },
      });
      assert.equal(race.mid.status, 200, `${name}: ön koşul — hareket gövde beklenirken silindi (${race.mid.status} ${race.mid.error})`);
      assert.ok(!ctx.store.get(`SELECT 1 AS x FROM ${route.table} WHERE id = ?`, made.id), `${name}: ön koşul — satır yok`);
      if (race.reply.status !== 404) problems.push(`${name}: 404 olmalı — yanıt ${race.reply.status} ${race.reply.body.code || ""} ${String(race.reply.body.error || "").slice(0, 120)}`);
      else if (race.reply.body.error !== GONE[name]) problems.push(`${name}: ileti “${race.reply.body.error}” (beklenen “${GONE[name]}”)`);
      const changed = ctx.changedTables(beforeSnap);
      if (changed.length) problems.push(`${name}: hiçbir tablo yazılmamalı — ${changed.join("; ")}`);
      // "Yine de Kaydet" de aynı 404 (silinmiş satıra yazılmaz).
      const forced = await ctx.api.put(made.path, { ...bodyOf(route, made, 500), cashForce: true });
      if (forced.status !== 404) problems.push(`${name}: Yine de Kaydet de 404 — ${forced.status}`);
    }
    assert.deepEqual(problems, [], problems.join(" | "));
  });

  test("taksit K8: tahsilat 600 → 500 düzeltmesi yoldayken muhasebe aynı tahsilatı 600 → 100 yapıp 700 tahsilat ekler → 409 plan-overpay (Fazlasını Avans Yaz sorusu); overpay ile yazılır", async () => {
    await ctx.policy("off");
    const account = await must("cari", ctx.api.post(ACC, { name: "Tur1 K8 Müşterisi", type: "customer", registeredOn: "2026-09-01" }));
    const plan = await must("kart", ctx.api.post(PLANS, { accountId: account.id, name: "Tur1 K8 Kartı", total: "1000", mode: "auto", count: 2, firstDue: "2026-11-01", registeredOn: DAY }));
    const col = await must("tahsilat 600", ctx.api.post(`${PLANS}/${plan.id}/entries`, { kind: "in", amount: "600", date: DAY, method: "cash" }));
    const path = `${PLANS}/${plan.id}/entries/${col.entryId}`;
    let beforeSnap = null;
    const race = await raceWrite(ctx, {
      path,
      body: { amount: "500" },
      during: async () => {
        const a = await ctx.other.put(path, { amount: "100" });
        const b = await ctx.other.post(`${PLANS}/${plan.id}/entries`, { kind: "in", amount: "700", date: DAY, method: "cash" });
        beforeSnap = ctx.snapshot();
        return { status: `${a.status}/${b.status}` };
      },
    });
    assert.equal(race.mid.status, "200/200", "ön koşul: 600 → 100 ve 700 tahsilat yazıldı");
    const net = () => ctx.store.get("SELECT TOTAL(CASE WHEN kind = 'in' THEN amount ELSE -amount END) AS t FROM plan_entries WHERE plan_id = ?", plan.id).t;
    const problems = [];
    if (race.reply.status !== 409 || race.reply.body.code !== "plan-overpay") problems.push(`güncel satır 100 → 500 büyüyor: 409 plan-overpay olmalı — yanıt ${race.reply.status} ${race.reply.body.code || ""}; kartın net tahsilatı ${net()}`);
    else {
      if (!/kalan 300,00 TL, girilen 500,00 TL, fazlası 200,00 TL/.test(race.reply.body.error)) problems.push(`ileti kalanı söylemeli — “${race.reply.body.error}”`);
      const changed = ctx.changedTables(beforeSnap);
      if (changed.length) problems.push(`hiçbir tablo yazılmamalı — ${changed.join("; ")}`);
    }
    if (net() !== 800) problems.push(`kartın net tahsilatı ${net()} (beklenen 800)`);
    assert.deepEqual(problems, [], problems.join(" | "));
    const avans = await ctx.api.put(path, { amount: "500", overpay: true });
    assert.equal(avans.status, 200, `Fazlasını Avans Yaz: ${avans.status} ${avans.error}`);
    assert.equal(net(), 1200);
  });

  test("kayıp güncelleme: gövdede yalnız tutar varken arada öbür kullanıcının açıklama düzeltmesi KORUNUR; Değişiklik Geçmişi'nin önceki hâli güncel satır", async () => {
    await ctx.policy("off");
    const problems = [];
    for (const name of ["cari", "stok", "taksit"]) {
      const route = R[name];
      await ctx.policy("off"); // hareket açılışı önceki adımın politikasına takılmasın
      const made = await route.make("in", 300, "ilk not");
      const race = await raceWrite(ctx, {
        path: made.path,
        body: route.body(350),
        during: async () => {
          const res = await ctx.other.put(made.path, { note: "muhasebenin notu" });
          return { status: res.status, error: res.error };
        },
      });
      assert.equal(race.mid.status, 200, `${name}: ön koşul — açıklama düzeltmesi yazıldı (${race.mid.status} ${race.mid.error})`);
      if (race.reply.status !== 200) problems.push(`${name}: tutar düzeltmesi 200 olmalı — ${race.reply.status} ${race.reply.body.error}`);
      const row = ctx.store.get(`SELECT amount, note FROM ${route.table} WHERE id = ?`, made.id);
      if (Number(row.amount) !== 350) problems.push(`${name}: tutar ${row.amount} (beklenen 350)`);
      if (row.note !== "muhasebenin notu") problems.push(`${name}: açıklama “${row.note}” (beklenen öbür kullanıcının “muhasebenin notu”su — bayat satır gövdeyle birleşip sildi)`);
      const last = ctx.audits(route.audit, made.id).at(-1);
      if (last?.previous?.note !== "muhasebenin notu") problems.push(`${name}: Değişiklik Geçmişi önceki açıklama “${last?.previous?.note}” (beklenen güncel satırın “muhasebenin notu”su)`);
    }
    assert.deepEqual(problems, [], problems.join(" | "));
  });

  test("iyimser kilit (gövdede updatedAt): form açıldıktan sonra öbür kullanıcı düzeltirse 409 <uç>-stale, hiçbir tablo yazılmaz; satır öbür kullanıcının değerinde", async () => {
    await ctx.policy("off");
    const problems = [];
    for (const name of NAMES) {
      const route = R[name];
      await ctx.policy("off"); // hareket açılışı önceki adımın politikasına takılmasın
      const made = await route.make("in", 100);
      // Formun açıldığı andaki sürüm: hiç düzeltilmemiş satırda updatedAt boş (liste "" / null verir).
      const opened = ctx.store.get(`SELECT updated_at AS u FROM ${route.table} WHERE id = ?`, made.id).u || "";
      let beforeSnap = null;
      const race = await raceWrite(ctx, {
        path: made.path,
        body: { ...bodyOf(route, made, 650), updatedAt: opened },
        during: async () => {
          const res = await ctx.other.put(made.path, bodyOf(route, made, 10));
          beforeSnap = ctx.snapshot();
          return { status: res.status };
        },
      });
      assert.equal(race.mid.status, 200, `${name}: ön koşul — öbür kullanıcının düzeltmesi yazıldı`);
      const version = ctx.store.get(`SELECT updated_at AS u FROM ${route.table} WHERE id = ?`, made.id).u;
      if (race.reply.status !== 409 || race.reply.body.code !== STALE[name].code) problems.push(`${name}: 409 ${STALE[name].code} olmalı — yanıt ${race.reply.status} ${race.reply.body.code || ""}`);
      else {
        if (race.reply.body.error !== STALE[name].message) problems.push(`${name}: ileti “${race.reply.body.error}”`);
        if (race.reply.body.updatedAt !== version) problems.push(`${name}: yanıttaki güncel sürüm ${race.reply.body.updatedAt} (beklenen ${version})`);
      }
      const changed = ctx.changedTables(beforeSnap);
      if (changed.length) problems.push(`${name}: hiçbir tablo yazılmamalı — ${changed.join("; ")}`);
      if (route.amountOf(made.id) !== 10) problems.push(`${name}: satır ${route.amountOf(made.id)} (beklenen 10)`);
      // Güncel sürümle yeniden kaydet: 200.
      const again = await ctx.api.put(made.path, { ...bodyOf(route, made, 650), updatedAt: version });
      if (again.status !== 200 || route.amountOf(made.id) !== 650) problems.push(`${name}: güncel sürümle kayıt 200 + 650 olmalı — ${again.status} ${again.error} ${route.amountOf(made.id)}`);
    }
    assert.deepEqual(problems, [], problems.join(" | "));
  });

  test("iyimser kilit sürüm biçimleri: boş / null / createdAt hiç düzeltilmemiş satırda geçer; düzeltilmiş satırda boş, createdAt ve eski sürüm 409; updatedAt yoksa denetim yok (bugünkü davranış)", async () => {
    await ctx.policy("off");
    const problems = [];
    for (const name of NAMES) {
      const route = R[name];
      await ctx.policy("off"); // hareket açılışı önceki adımın politikasına takılmasın
      const row = made => ctx.store.get(`SELECT updated_at AS u, created_at AS c FROM ${route.table} WHERE id = ?`, made.id);
      const cases = [];
      const a = await route.make("in", 100);
      cases.push(["boş, hiç düzeltilmemiş", a, "", 200]);
      const b = await route.make("in", 100);
      cases.push(["null, hiç düzeltilmemiş", b, null, 200]);
      const c = await route.make("in", 100);
      cases.push(["createdAt, hiç düzeltilmemiş", c, row(c).c, 200]);
      for (const [label, made, sent, status] of cases) {
        const res = await ctx.api.put(made.path, { ...bodyOf(route, made, 120), updatedAt: sent });
        if (res.status !== status) problems.push(`${name} ${label}: ${res.status} ${res.code || ""} (beklenen ${status})`);
      }
      // a artık düzeltildi: boş ya da createdAt "hiç düzeltilmemiş hâli açtım" demektir → 409; eski sürüm 409; güncel sürüm 200; sürümsüz 200.
      const first = row(a).u;
      for (const [label, sent] of [["boş, düzeltilmiş", ""], ["createdAt, düzeltilmiş", row(a).c]]) {
        const res = await ctx.api.put(a.path, { ...bodyOf(route, a, 130), updatedAt: sent });
        if (res.status !== 409 || res.code !== STALE[name].code) problems.push(`${name} ${label}: ${res.status} ${res.code || ""} (beklenen 409 ${STALE[name].code})`);
      }
      await sleep(5); // sürüm milisaniye damgasıdır: sonraki yazım ayrı damga alsın (BİLİNEN SINIR: aynı milisaniyedeki iki yazım aynı sürüm)
      const ok1 = await ctx.api.put(a.path, { ...bodyOf(route, a, 140), updatedAt: first });
      if (ok1.status !== 200) problems.push(`${name} güncel sürüm: ${ok1.status} ${ok1.error}`);
      const old = await ctx.api.put(a.path, { ...bodyOf(route, a, 150), updatedAt: first });
      if (old.status !== 409) problems.push(`${name} eski sürüm: ${old.status} (beklenen 409)`);
      const plain = await ctx.api.put(a.path, bodyOf(route, a, 160));
      if (plain.status !== 200 || route.amountOf(a.id) !== 160) problems.push(`${name} sürümsüz: ${plain.status} ${route.amountOf(a.id)} (beklenen 200, 160)`);
    }
    assert.deepEqual(problems, [], problems.join(" | "));
  });

  test("gerileme — yarışsız düzeltme her uçta aynen: Kontrol Yok yazar; Uyar sorar + Yine de Kaydet yazar; Engelle onayla da yazmaz; yinelenen istek ikinci kez yazmaz", async () => {
    const problems = [];
    for (const name of NAMES) {
      const route = R[name];
      await ctx.policy("off"); // hareket açılışı önceki adımın politikasına takılmasın
      // Kontrol Yok: Kasa 500, ödeme 100 → 650 yazılır, Kasa −50.
      const made = await route.make("out", 100);
      await ctx.setKasa(500);
      const free = await ctx.api.put(made.path, bodyOf(route, made, 650));
      if (free.status !== 200 || (await ctx.kasa()) !== -50) problems.push(`${name} Kontrol Yok: ${free.status} Kasa ${await ctx.kasa()} (beklenen 200, −50)`);
      // Uyar: Kasa 500, 100 → 650 → 409 cash-negative; Yine de Kaydet → 200, Kasa −50.
      const warnRow = await route.make("out", 100);
      await ctx.setKasa(500);
      await ctx.policy("warn");
      const asked = await ctx.api.put(warnRow.path, bodyOf(route, warnRow, 650));
      if (asked.status !== 409 || asked.code !== "cash-negative" || !/100,00 TL'den 650,00 TL'ye/.test(asked.error)) problems.push(`${name} Uyar soru: ${asked.status} ${asked.code} “${asked.error}”`);
      const forced = await ctx.api.put(warnRow.path, { ...bodyOf(route, warnRow, 650), cashForce: true });
      if (forced.status !== 200 || (await ctx.kasa()) !== -50 || route.amountOf(warnRow.id) !== 650) problems.push(`${name} Uyar onay: ${forced.status} Kasa ${await ctx.kasa()} hareket ${route.amountOf(warnRow.id)}`);
      // Engelle: 409 cash-blocked; onayla da 409; hareket 100 kalır.
      await ctx.policy("off");
      const blockRow = await route.make("out", 100);
      await ctx.setKasa(500);
      await ctx.policy("block");
      const blocked = await ctx.api.put(blockRow.path, bodyOf(route, blockRow, 650));
      const blockedForced = await ctx.api.put(blockRow.path, { ...bodyOf(route, blockRow, 650), cashForce: true });
      if (blocked.code !== "cash-blocked" || blockedForced.code !== "cash-blocked" || route.amountOf(blockRow.id) !== 100 || (await ctx.kasa()) !== 500) problems.push(`${name} Engelle: ${blocked.status}/${blockedForced.status} hareket ${route.amountOf(blockRow.id)} Kasa ${await ctx.kasa()}`);
      // Engelle'de Kasa'yı artıran düzeltme serbest (100 → 50).
      const shrink = await ctx.api.put(blockRow.path, bodyOf(route, blockRow, 50));
      if (shrink.status !== 200 || (await ctx.kasa()) !== 550) problems.push(`${name} Engelle küçültme: ${shrink.status} Kasa ${await ctx.kasa()} (beklenen 200, 550)`);
      // Yinelenen istek (aynı istek kimliği + aynı gövde): ikinci kez yazılmaz, Değişiklik Geçmişi tek satır.
      await ctx.policy("off");
      const once = await route.make("in", 100);
      const requestId = `birlesik-tur1-${name}-${ctx.next()}-yineleme`;
      const r1 = await ctx.api.put(once.path, { ...bodyOf(route, once, 120), requestId });
      const r2 = await ctx.api.put(once.path, { ...bodyOf(route, once, 120), requestId });
      const count = ctx.audits(route.audit, once.id).length;
      if (r1.status !== 200 || r2.status !== 200 || count !== 1 || route.amountOf(once.id) !== 120) problems.push(`${name} yinelenen istek: ${r1.status}/${r2.status} geçmiş ${count} tutar ${route.amountOf(once.id)} (beklenen 200/200, 1, 120)`);
    }
    await ctx.policy("off");
    assert.deepEqual(problems, [], problems.join(" | "));
  });

  test("gerileme — eksi stok sorusu (stok) ve kart iadesi sınırı (taksit) yarışsız aynen; silinmiş harekete doğrudan düzeltme 404", async () => {
    await ctx.policy("off");
    const item = await must("ürün", ctx.api.post(STOCK, { name: "Tur1 Eksi Stok", unit: "Adet", unitPrice: 10, openingQty: "2" }));
    const sale = await must("satış", ctx.api.post(`${STOCK}/${item.id}/moves`, { kind: "out", qty: 1, unitPrice: 50, pay: "cash", method: "cash", date: DAY }));
    const tooMany = await ctx.api.put(`${STOCK}/${item.id}/moves/${sale.moveId}`, { qty: 5, unitPrice: 50 });
    assert.deepEqual([tooMany.status, tooMany.code], [409, "stock-negative"], `eksi stok sorusu: ${tooMany.status} ${tooMany.error}`);
    assert.equal(tooMany.data.available, 2, "mevcut (bu hareket hariç) 2");
    const forced = await ctx.api.put(`${STOCK}/${item.id}/moves/${sale.moveId}`, { qty: 5, unitPrice: 50, force: true });
    assert.equal(forced.status, 200, `Yine de Kaydet: ${forced.status} ${forced.error}`);
    const refund = R.taksit;
    const made = await refund.make("out", 100);
    const over = await ctx.api.put(made.path, { amount: "2500" });
    assert.deepEqual([over.status, over.code], [400, "refund-exceeds"], `iade tahsil edilenden fazla: ${over.status} ${over.error}`);
    await must("sil", ctx.api.del(made.del));
    const late = await ctx.api.put(made.path, { amount: "50" });
    assert.deepEqual([late.status, late.error], [404, GONE.taksit]);
  });
});

describe("2.5.0 BİRLEŞİK TUR 1 YB-2 — Kasa ↔ Banka transferi: gövde yoldayken silinir ya da öbür tarafı yok olursa 404, hiçbir tablo yazılmaz", () => {
  let ctx;
  before(async () => {
    ctx = await world();
  });
  after(async () => ctx?.server.close());

  const transfer = async () => {
    const made = await must("transfer", ctx.api.post(`${CASH}/transfer`, { direction: "to-cash", amount: "300", date: DAY, description: "Tur1 Transfer" }));
    return made;
  };
  const body = { kind: "in", amount: "350", date: DAY, description: "Tur1 Transfer" };

  test("transfer gövde yoldayken silinir: 404 Kasa iletisi; tablolar silmeden sonraki hâliyle aynı (sahte cash.transfer.updated yok)", async () => {
    const made = await transfer();
    let beforeSnap = null;
    const race = await raceWrite(ctx, {
      path: `${CASH}/${made.id}`,
      body,
      during: async () => {
        const res = await ctx.other.del(`${CASH}/${made.id}?cashForce=1`);
        beforeSnap = ctx.snapshot();
        return res;
      },
    });
    assert.equal(race.mid.status, 200, `ön koşul: transfer silindi (${race.mid.status} ${race.mid.error})`);
    const problems = [];
    if (race.reply.status !== 404 || race.reply.body.error !== GONE.kasa) problems.push(`404 “${GONE.kasa}” olmalı — ${race.reply.status} ${race.reply.text.slice(0, 160)}`);
    const changed = ctx.changedTables(beforeSnap);
    if (changed.length) problems.push(`hiçbir tablo yazılmamalı — ${changed.join("; ")}`);
    if (ctx.audits("cash.transfer.updated", made.transferId).length) problems.push("Değişiklik Geçmişi'ne silinmiş transfer için \"düzeltildi\" yazıldı");
    assert.deepEqual(problems, [], problems.join(" | "));
  });

  test("transferin yalnız öbür tarafı yok (eski / bozuk veri benzetimi, doğrudan silme): 404 \"Transferin öbür tarafı bulunamadı\"; tablolar değişmez", async () => {
    const made = await transfer();
    let beforeSnap = null;
    const race = await raceWrite(ctx, {
      path: `${CASH}/${made.id}`,
      body,
      during: async () => {
        rawRun(ctx.db, "DELETE FROM cash_entries WHERE id = ?", made.bankId);
        beforeSnap = ctx.snapshot();
        return { status: 200 };
      },
    });
    const problems = [];
    if (race.reply.status !== 404 || race.reply.body.error !== "Transferin öbür tarafı bulunamadı. Başka biri silmiş olabilir.") problems.push(`404 olmalı — ${race.reply.status} ${race.reply.text.slice(0, 160)}`);
    const changed = ctx.changedTables(beforeSnap);
    if (changed.length) problems.push(`hiçbir tablo yazılmamalı — ${changed.join("; ")}`);
    assert.deepEqual(problems, [], problems.join(" | "));
  });
});

describe("2.5.0 BİRLEŞİK TUR 1 YB-2 — transfer düzeltmesi yarışsız aynen (gerileme)", () => {
  let ctx;
  before(async () => {
    ctx = await world();
  });
  after(async () => ctx?.server.close());

  test("transfer düzeltmesi iki tarafı birlikte günceller; iyimser kilit transferde de çalışır", async () => {
    const made = await must("transfer", ctx.api.post(`${CASH}/transfer`, { direction: "to-cash", amount: "300", date: DAY, description: "Tur1 Transfer B" }));
    const fixed = await ctx.api.put(`${CASH}/${made.id}`, { kind: "in", amount: "350", date: DAY, description: "Tur1 Transfer B2", updatedAt: "" });
    assert.equal(fixed.status, 200, `${fixed.status} ${fixed.error}`);
    const legs = ctx.store.all("SELECT method, kind, amount, description FROM cash_entries WHERE transfer_id = ? ORDER BY method", made.transferId);
    assert.deepEqual(legs.map(leg => [leg.method, leg.kind, Number(leg.amount), leg.description]), [["bank", "out", 350, "Tur1 Transfer B2"], ["cash", "in", 350, "Tur1 Transfer B2"]]);
    const stale = await ctx.api.put(`${CASH}/${made.id}`, { kind: "in", amount: "360", date: DAY, description: "Tur1 Transfer B3", updatedAt: "" });
    assert.deepEqual([stale.status, stale.code], [409, "cash-entry-stale"]);
    assert.equal(ctx.audits("cash.transfer.updated", made.transferId).length, 1, "Değişiklik Geçmişi tek düzeltme");
    assert.equal((await ctx.kasa()), 350);
  });
});
