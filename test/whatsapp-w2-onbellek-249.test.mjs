// 2.4.9 W-2 + W-2b — ANA OTURUM ONAYI (03.11.2026; docs/2.4.9-tasarim/W-whatsapp-sablon.md §5, §15): "Şablonları Denetle ve Oluştur" gönderim yolunun şablon
// önbelleğini (10 dk / 100 ileti; R2) temizler — kart "gönderilmez" derken süren toplu iş önbellekle sürmez; aynı WhatsApp hesabını (WABA) kullanan İKİNCİ şirketin
// süren işi de; Denetle'nin Meta okuması düşse de. W-2b: önizlemenin (ve başlatmanın) TAZE şablon okuması şablon kaydını da günceller → Yönetim kartı ve gönderim
// penceresinin varsayılan sekmesi (sending-status) onaydan hemen sonra, Denetle'ye basmadan doğru. R2 kuralı (Denetle olmadan 10 dk / 100 ileti) DEĞİŞMEZ
// (test/whatsapp-t1-b3-248.test.mjs B5, test/whatsapp-w2-cekirdek-248.test.mjs).
// Düzenek: gerçek program + yerel sahte Graph (aynı el — kâhin DEĞİL, ders 5; gerçek Meta'ya istek YOK — ders 30) + elle sürülen işçi (ders 20) + sahte saat (ders 13).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startFakeGraph } from "./whatsapp-sahte-graph.mjs";
import { PNID, TOKEN, URLS, WABA, startWa } from "./whatsapp-248-ortak.mjs";

const APP = "1505264761663625";
const MIN = 60_000;
const HOUR = 60 * MIN;
const TTL_FIELD = "message_send_ttl_seconds";
const ENSURE = "/api/workspace/whatsapp/templates/ensure";
const TEMPLATES = "/api/workspace/whatsapp/templates";
const STATUS = "/api/workspace/whatsapp/sending-status";
const ekstre = fake => fake.state.templates.find(item => item.name === "destekofis_ekstre");
const lists = fake => fake.requests.filter(item => item.method === "GET" && /\/message_templates$/.test(item.path));

// Üç kişilik ekstre işi; ilk ileti gider (işçi bir tur), iki iş bekler.
async function runningBatch(ctx, query = "") {
  const ids = [];
  for (let i = 0; i < 3; i += 1) {
    const res = await ctx.api.post(`/api/workspace/accounts${query}`, { name: `Kişi ${i + 1}`, phone: `0555 000 00 0${i + 1}`, openingBalance: "10" });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    ids.push(res.data.data.id);
  }
  const res = await ctx.api.post(`${URLS.batches}${query}`, { kind: "statement", ids, preset: "thisMonth" });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  await ctx.wa.scheduler.runOnce();
  assert.equal(ctx.messages().length, 1, "ön koşul: ilk ileti gitti, iki iş bekliyor");
  return res.data.data.batch.id;
}
const batchOf = async (ctx, id, query = "") => (await ctx.api.get(`${URLS.batches}/${id}${query}`)).data.data;

describe("2.4.9 W-2 — Şablonları Denetle süren işin şablon önbelleğini temizler", () => {
  it("süren toplu iş, Meta şablonu Pazarlama'ya aldı, kullanıcı Denetle'ye bastı: saat ilerlemeden sonraki adımda iş DURUR (template-marketing), yeni ileti gitmez", async () => {
    const ctx = await startWa();
    try {
      const id = await runningBatch(ctx);
      ekstre(ctx.fake).category = "MARKETING";
      const checked = await ctx.api.post(ENSURE, {});
      assert.equal(checked.status, 200, JSON.stringify(checked.data));
      const card = checked.data.data.items.find(item => item.name === "destekofis_ekstre");
      assert.equal(card.usable, false, "ön koşul: kart 'gönderilmez' diyor (Pazarlama)");
      await ctx.drain();
      const batch = await batchOf(ctx, id);
      assert.equal(ctx.messages().length, 1, `Denetle'den sonra yeni ileti gitmemeli (giden ${ctx.messages().length})`);
      assert.equal(batch.state, "paused", `toplu iş duraklamalı (geldi ${batch.state})`);
      assert.equal(batch.pauseCode, "template-marketing");
    } finally {
      await ctx.close();
    }
  });

  it("Denetle'nin Meta okuması düşse de (502) önbellek temizlenir: sonraki adım şablonu taze okur, Pazarlama'yı görüp durur", async () => {
    const ctx = await startWa();
    try {
      const id = await runningBatch(ctx);
      ekstre(ctx.fake).category = "MARKETING";
      ctx.fake.state.failQueue.push({ match: /^GET \/\d+\/message_templates$/, status: 500, raw: "<html>Bad Gateway</html>" });
      const checked = await ctx.api.post(ENSURE, {});
      assert.equal(checked.status, 502, `ön koşul: Denetle'nin Meta okuması düştü (geldi ${checked.status})`);
      await ctx.drain();
      const batch = await batchOf(ctx, id);
      assert.equal(ctx.messages().length, 1, `yeni ileti gitmemeli (giden ${ctx.messages().length})`);
      assert.equal(batch.state, "paused", `toplu iş duraklamalı (geldi ${batch.state})`);
      assert.equal(batch.pauseCode, "template-marketing");
    } finally {
      await ctx.close();
    }
  });

  it("işçinin şablon okuması SÜRERKEN Denetle biterse (nasıl bozulur 15): o eski okuma önbelleğe yazılmaz — bir sonraki adım yeniden okuyup durur (giden en çok 2)", async () => {
    // 2.4.9 W düzeltme turu 1 (dar kontrol W DÜŞÜK-2; ders 20, 38): işçinin eski okuması sabit bir beklemeyle (300 ms) değil KAPIYLA tutulur — Denetle dönene dek
    // Meta'dan yanıt gelmez. Önceki biçimde Denetle 300 ms'yi aşınca (yavaş makine) eski okuma Denetle'den önce dönüyor, dönem (templateEpoch) koruması hiç
    // sınanmadan hücre yeşil kalıyordu. İstemci zaman aşımı kapıdan uzun (10 sn): işçinin isteği kapıda beklerken düşmez.
    const ctx = await startWa({ whatsappTimeoutMs: 10_000 });
    let release = () => {};
    try {
      const id = await runningBatch(ctx);
      ctx.clock.advance(11 * MIN); // önbellek (10 dk) doldu: işçinin sonraki adımı şablonu Meta'dan okur
      // İşçinin okuması Meta'ya Pazarlama'dan ÖNCE varır (eski liste: onaylı, Utility); yanıtı Denetle döndükten SONRA kapı açılınca gelir.
      const old = { data: ctx.fake.state.templates.map(item => ({ ...item })), paging: { cursors: { before: "QVFIUb", after: "QVFIUa" } } };
      const gate = new Promise(resolve => {
        release = resolve;
      });
      ctx.fake.state.failQueue.push({ match: /^GET \/\d+\/message_templates$/, status: 200, body: old, gate });
      const readsBefore = lists(ctx.fake).length;
      let workerDone = false;
      const worker = ctx.wa.scheduler.runOnce().finally(() => {
        workerDone = true;
      });
      for (let i = 0; i < 200 && lists(ctx.fake).length === readsBefore; i += 1) await new Promise(resolve => setTimeout(resolve, 5));
      assert.equal(lists(ctx.fake).length, readsBefore + 1, "ön koşul: işçinin şablon okuması Meta'da bekliyor");
      ekstre(ctx.fake).category = "MARKETING";
      // Denetle işçiyi bekleseydi (kilit) test asılı kalmasın: 5 sn sonra kapı açılır, aşağıdaki ön koşul kırmızı olur.
      const guard = setTimeout(() => release(), 5_000);
      const checked = await ctx.api.post(ENSURE, {});
      clearTimeout(guard);
      assert.equal(workerDone, false, "ön koşul (yarış): Denetle döndüğünde işçinin eski okuması hâlâ Meta'da bekliyor");
      assert.equal(checked.status, 200, JSON.stringify(checked.data));
      assert.equal(checked.data.data.items.find(item => item.name === "destekofis_ekstre").usable, false, "ön koşul: Denetle Pazarlama'yı gördü (kart 'gönderilmez')");
      release(); // eski liste şimdi döner
      await worker; // eski okumayla süren adım (ileti 2 — Denetle'den önce başlamış iş)
      await ctx.drain();
      const batch = await batchOf(ctx, id);
      assert.ok(ctx.messages().length <= 2, `Denetle'den sonra başlayan adımlar ileti göndermemeli (giden ${ctx.messages().length})`);
      assert.equal(batch.state, "paused", `toplu iş duraklamalı (geldi ${batch.state})`);
      assert.equal(batch.pauseCode, "template-marketing");
    } finally {
      release();
      await ctx.close();
    }
  });

  it("iki şirket AYNI WhatsApp hesabında: 002'de süren iş, 001'de Denetle → 002'nin işi de sonraki adımda durur (giden 1)", async () => {
    const ctx = await startWa({ maxCompanies: 2 });
    try {
      const created = await ctx.api.post("/api/companies", { name: "İkinci Şirket", select: false });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      const second = created.data.data.company || created.data.data;
      const q = `?hofCompany=${encodeURIComponent(second.id)}`;
      assert.equal((await ctx.api.put(`${URLS.conn}${q}`, { phoneNumberId: PNID, wabaId: WABA, token: TOKEN })).status, 200);
      assert.equal((await ctx.api.put(`${URLS.ack}${q}`, { ack: true })).status, 200);
      assert.equal((await ctx.api.put(`/api/admin/office${q}`, { name: "İkinci Şirket" })).status, 200);
      const id = await runningBatch(ctx, q);
      ekstre(ctx.fake).category = "MARKETING";
      assert.equal((await ctx.api.post(ENSURE, {})).status, 200, "001'de Şablonları Denetle");
      await ctx.drain();
      const batch = await batchOf(ctx, id, q);
      assert.equal(ctx.messages().length, 1, `002'nin işinden yeni ileti gitmemeli (giden ${ctx.messages().length})`);
      assert.equal(batch.state, "paused", `002'nin toplu işi duraklamalı (geldi ${batch.state})`);
      assert.equal(batch.pauseCode, "template-marketing");
    } finally {
      await ctx.close();
    }
  });
});

describe("2.4.9 W-2b — önizlemenin taze şablon okuması kartı ve gönderim penceresini günceller", () => {
  it("Denetle'de 'Onay Bekliyor' → Meta onayladı → önizleme (taze okuma): kart 'Onaylandı / Evet', pencere Otomatik Gönder; Denetle'ye basılmadı, son denetim zamanı değişmedi", async () => {
    const fake = await startFakeGraph({ token: TOKEN, phoneNumberId: PNID, wabaId: WABA, appId: APP });
    const ctx = await startWa({ fake, connect: false });
    try {
      assert.equal((await ctx.api.put(URLS.conn, { phoneNumberId: PNID, wabaId: WABA, appId: APP, token: TOKEN })).status, 200);
      const ensured = await ctx.api.post(ENSURE, {});
      assert.equal(ensured.status, 200, JSON.stringify(ensured.data));
      const checkedAt = ensured.data.data.checkedAt;
      assert.ok(ensured.data.data.items.every(item => item.statusLabel === "Onay Bekliyor" && !item.usable), "ön koşul: iki şablon Onay Bekliyor");
      assert.equal((await ctx.api.get(STATUS)).data.data.templates.statement?.usable, false, "ön koşul: pencere WhatsApp Web ile Gönder'le açılır");
      for (const tpl of fake.state.templates) if (tpl.name.startsWith("destekofis_")) tpl.status = "APPROVED"; // Meta onayladı
      ctx.clock.advance(MIN);
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const before = fake.requests.length;
      const preview = await ctx.api.post(URLS.preview, { kind: "statement", ids: [a.id], preset: "thisMonth" });
      assert.equal(preview.status, 200, JSON.stringify(preview.data));
      assert.equal(preview.data.data.template.ok, true, "önizleme şablonu taze okudu: onaylı");
      assert.equal(lists({ requests: fake.requests.slice(before) }).length, 1, "önizleme Meta'dan bir kez okudu");
      const status = (await ctx.api.get(STATUS)).data.data;
      assert.equal(status.templates.statement?.usable, true, `gönderim penceresi Otomatik Gönder ile açılmalı (geldi ${JSON.stringify(status.templates.statement)})`);
      assert.equal(status.templates.reminder?.usable, true, "aynı liste okumasındaki ödeme hatırlatma şablonu da");
      const card = (await ctx.api.get(TEMPLATES)).data.data;
      for (const item of card.items) {
        assert.equal(item.statusLabel, "Onaylandı", `${item.name}: kart Onaylandı göstermeli (geldi ${item.statusLabel})`);
        assert.equal(item.usable, true);
      }
      assert.equal(card.checkedAt, checkedAt, "son denetim zamanı (Şablonları Denetle) değişmedi");
      assert.equal(fake.requests.filter(item => item.method === "POST" && /\/message_templates$/.test(item.path)).length, 2, "şablon yeniden açılmadı");
    } finally {
      await ctx.close();
      await fake.close();
    }
  });

  it("noteListing (tek değişim yeri): yalnız aynı WABA'nın kaydında, yalnız listede bulunan şablonun Meta alanlarını yazar; kayıttan daha eski okuma ve başka WABA yazmaz", async () => {
    const mod = await import("../server/lib/whatsapp/templates.mjs");
    assert.equal(typeof mod.noteListing, "function", "templates.mjs noteListing dışa açılmalı");
    const rows = new Map();
    const store = { setting: (key, fallback = "") => (rows.has(key) ? rows.get(key) : fallback), setSetting: (key, value) => rows.set(key, value) };
    const base = { v: 1, at: "2026-11-03T06:00:00.000Z", wabaId: WABA, phoneNumberId: PNID, by: "u1", byName: "Yönetici", complete: true, error: null, actions: [{ name: "destekofis_ekstre", ok: true, created: true, message: "x" }],
      items: [{ name: "destekofis_ekstre", meta: { id: "900000000000011", name: "destekofis_ekstre", language: "tr", status: "PENDING", category: "UTILITY" } }, { name: "destekofis_odeme_hatirlatma", meta: { id: "900000000000012", name: "destekofis_odeme_hatirlatma", language: "tr", status: "PENDING", category: "UTILITY" } }] };
    const put = value => rows.set(mod.TEMPLATES_KEY, JSON.stringify(value));
    const read = () => JSON.parse(rows.get(mod.TEMPLATES_KEY));
    const listing = { items: [{ id: "900000000000011", name: "destekofis_ekstre", language: "tr", status: "APPROVED", category: "UTILITY" }, { id: "900000000000099", name: "destekofis_ekstre", language: "en_US", status: "REJECTED", category: "UTILITY" }], complete: true };
    const record = { wabaId: WABA, phoneNumberId: PNID };
    put(base);
    assert.equal(mod.noteListing(store, record, listing, { readAt: "2026-11-03T07:00:00.000Z" }), true);
    const after = read();
    assert.equal(after.items[0].meta.status, "APPROVED", "listede bulunan şablon (aynı ad + dil) güncellendi");
    assert.equal(after.items[0].meta.id, "900000000000011");
    assert.equal(after.items[1].meta.status, "PENDING", "listede olmayan şablonun kaydı korunur");
    assert.equal(after.at, base.at, "son denetim zamanı korunur");
    assert.deepEqual(after.actions, base.actions, "son denetimin işlemleri korunur");
    assert.equal(after.byName, "Yönetici");
    // Denetle kayıttan SONRA bitmişse (okuma kayıttan eski) yazılmaz.
    put({ ...base, at: "2026-11-03T08:00:00.000Z" });
    assert.equal(mod.noteListing(store, record, listing, { readAt: "2026-11-03T07:00:00.000Z" }), false);
    assert.equal(read().items[0].meta.status, "PENDING", "eski okuma yeni denetimin üstüne yazmadı");
    // Başka WABA'nın kaydı, kayıt yok, bozuk kayıt: yazılmaz.
    put({ ...base, wabaId: "999999999999" });
    assert.equal(mod.noteListing(store, record, listing, { readAt: "2026-11-03T09:00:00.000Z" }), false);
    rows.delete(mod.TEMPLATES_KEY);
    assert.equal(mod.noteListing(store, record, listing, { readAt: "2026-11-03T09:00:00.000Z" }), false);
    assert.equal(rows.has(mod.TEMPLATES_KEY), false, "kayıt yokken yeni kayıt açılmaz (Şablonları Denetle'nin işi)");
    // İki önizleme üst üste: daha eski okuma sonra biterse yazmaz.
    put(base);
    assert.equal(mod.noteListing(store, record, listing, { readAt: "2026-11-03T09:00:00.000Z" }), true);
    const older = { items: [{ ...listing.items[0], status: "PAUSED" }], complete: true };
    assert.equal(mod.noteListing(store, record, older, { readAt: "2026-11-03T08:30:00.000Z" }), false);
    assert.equal(read().items[0].meta.status, "APPROVED");
    // 2.4.9 W düzeltme turu 1 (dar kontrol W DÜŞÜK-1, karar (a)): teslim süresi alanı (message_send_ttl_seconds) önizlemeden YAZILMAZ — kayıttaki değer (son
    // Şablonları Denetle'nin okuduğu) korunur; durum / kategori / içerik yine güncellenir. Kayıtta süre yoksa eklenmez, varsa değişmez ve silinmez.
    put(base);
    const withTtl = { items: [{ ...listing.items[0], [TTL_FIELD]: 43_200 }], complete: true };
    assert.equal(mod.noteListing(store, record, withTtl, { readAt: "2026-11-03T09:00:00.000Z" }), true, "durum değişti (PENDING → APPROVED): kayıt güncellenir");
    assert.equal(read().items[0].meta.status, "APPROVED");
    assert.equal(Object.hasOwn(read().items[0].meta, TTL_FIELD), false, `önizleme teslim süresini kayda eklememeli (geldi ${read().items[0].meta[TTL_FIELD]})`);
    const denetlenmis = { ...base, items: [{ name: "destekofis_ekstre", meta: { ...base.items[0].meta, [TTL_FIELD]: 259_200 } }, base.items[1]] };
    put(denetlenmis);
    assert.equal(mod.noteListing(store, record, withTtl, { readAt: "2026-11-03T09:00:00.000Z" }), true);
    assert.equal(read().items[0].meta.status, "APPROVED");
    assert.equal(read().items[0].meta[TTL_FIELD], 259_200, "Denetle'nin kaydettiği teslim süresi önizlemeyle değişmez");
    put({ ...denetlenmis, items: [{ name: "destekofis_ekstre", meta: { ...denetlenmis.items[0].meta, status: "APPROVED" } }, base.items[1]] });
    assert.equal(mod.noteListing(store, record, withTtl, { readAt: "2026-11-03T09:00:00.000Z" }), false, "yalnız teslim süresi farklıysa kayıt yazılmaz");
    assert.equal(mod.noteListing(store, record, listing, { readAt: "2026-11-03T09:00:00.000Z" }), false, "liste süre bildirmiyorsa kayıttaki süre silinmez");
    assert.equal(read().items[0].meta[TTL_FIELD], 259_200);
  });

  it("önizlemenin taze okuması teslim süresini kayda YAZMAZ: Meta listesi süreyi sonradan kısaltınca (12 sa) önceden kabul edilmiş iş Süresi Doldu OLMAZ, aynı dönemde ikinci ekstre gitmez", async () => {
    // 2.4.9 W düzeltme turu 1 — dar kontrol W DÜŞÜK-1 (p3 senaryosu, YALNIZ önizleme yolu), KARAR (a): noteListing teslim süresi alanını yazmaz; açık 2.4.8 düzeyine döner,
    // yeni kural yok. BİLİNEN SINIR (değişmedi, bilerek sınanmaz): kullanıcı burada "Şablonları Denetle ve Oluştur"a basarsa Denetle Meta'nın bildirdiği 12 saati
    // 2.4.8'deki gibi kayda yazar, bakım bu işi geriye dönük Süresi Doldu yapar ve aynı dönemde ikinci ekstre gidebilir (dar kontrol W p3 "denetle" yolu: eski ve
    // yeni kodda 2 ileti). Kök kural (iş kabul anındaki süre — ilke 2 yönünde) → C / 2.5.0.
    const ctx = await startWa();
    try {
      assert.equal((await ctx.api.post(ENSURE, {})).status, 200, "ön koşul: Şablonları Denetle (liste teslim süresi bildirmiyor: 30 gün)");
      const a = await ctx.account("Ayşe Yılmaz", "0532 111 22 33", 1250);
      const body = { kind: "statement", ids: [a.id], preset: "thisMonth" };
      const first = await ctx.batch(body);
      assert.equal(first.status, 200, JSON.stringify(first.data));
      await ctx.drain();
      const job = (await ctx.jobs(first.data.data.batch.id))[0];
      assert.equal(job.state, "accepted", `ön koşul: ekstre Meta'ya kabul edildi (geldi ${job.state})`);
      ctx.statuses([{ id: job.wamid, status: "sent", timestamp: String(Math.floor(ctx.clock.ms() / 1000)) }]); // bildirim yolu canlı (son 7 gün kuralı)
      assert.equal(ctx.messages().length, 1);
      ctx.clock.advance(14 * HOUR);
      for (const tpl of ctx.fake.state.templates) if (tpl.name.startsWith("destekofis_")) tpl[TTL_FIELD] = 43_200; // müşteri WhatsApp Yöneticisi'nde 12 saat yaptı
      const readsBefore = lists(ctx.fake).length;
      const p1 = await ctx.api.post(URLS.preview, body);
      assert.equal(p1.status, 200, JSON.stringify(p1.data));
      assert.equal(lists(ctx.fake).length, readsBefore + 1, "ön koşul: önizleme şablon listesini Meta'dan TAZE okudu (W-2b yolu)");
      assert.equal(p1.data.data.people[0].skip, "Daha Önce Gönderildi");
      await ctx.drain(); // bakım: süre dolumu
      const after = (await ctx.jobs(first.data.data.batch.id))[0];
      assert.notEqual(after.state, "expired", "önceden kabul edilmiş iş önizlemeden sonra geriye dönük Süresi Doldu olmamalı (kayıttaki süre 30 gün)");
      assert.equal(after.state, "sent");
      const saved = JSON.parse(ctx.store.setting("whatsapp.templates", "{}")).items.find(item => item.name === "destekofis_ekstre").meta;
      assert.equal(saved.status, "APPROVED");
      assert.equal(Object.hasOwn(saved, TTL_FIELD), false, `önizleme teslim süresini kayda yazmamalı (geldi ${saved[TTL_FIELD]})`);
      const p2 = await ctx.api.post(URLS.preview, body);
      assert.equal(p2.status, 200, JSON.stringify(p2.data));
      assert.equal(p2.data.data.people[0].skip, "Daha Önce Gönderildi", "aynı dönemde kişi yine elenir (ilke 3)");
      const second = await ctx.batch({ ...body, requestId: "w-tur1-ikinci" });
      assert.equal(second.status, 400, `ikinci toplu iş başlamamalı (geldi ${second.status} ${JSON.stringify(second.data).slice(0, 200)})`);
      await ctx.drain();
      assert.equal(ctx.messages().length, 1, `aynı dönemde kişiye tek ekstre (giden ${ctx.messages().length})`);
    } finally {
      await ctx.close();
    }
  });
});
