// 2.1.0 — Aşama 3 (Banka Hesapları), dilim 2: arayüzün sunucu ve kaynak tarafı (docs/BANKA-MODULU-PLAN.md §8.1, §8.2, §8.3, §8.5, §8.9,
// §8.11, §8.12, §9.2/8; kanıt docs/2.1.0-KANIT.md "Aşama 3 (Dilim 2)"). Ekranın kendisi test/e2e/senaryo-banka-210.mjs'te (arayüzden).
//
// ÇALIŞIYOR MU:
//   - Sol menüde "Banka", Taksitler'in HEMEN altında; bank.view ister, rozetlidir, tıklama Banka penceresini açar (HOF.bank.open).
//   - hof-bank.js hof-invoices.js ve hof-cheques.js'ten sonra, hof-overview.js'ten önce yüklenir; HOF.office'e "=" ile yazmaz.
//   - Kalemle ad değiştirme: "Banka" (side.bank) kaydedilir; önceden kaydedilemeyen "Fatura" (side.invoices) ve "Raporlar" (side.analytics) de.
//   - Rozet: GET /bank/badge?count=1 → Hesabı Belirsiz Yeni Hareketler sayısı (yalnız okuma, ucuz).
//   - Kurulum Sihirbazı "ilk girişte": özet kişinin sihirbazı kapatıp kapatmadığını söyler (setup.dismissed); kapatma kişi ve şirket bazında
//     kaydedilir (başka bilgisayarda da yeniden kendiliğinden açılmaz).
//   - Hesap Detayı: GET /bank/accounts/:id son hareketleri (işaretli tutar, açıklama, İşlem No; açılış dahil) ve açılışın kilitli dönemde olup
//     olmadığını (openingLocked) verir; başka hesabın hareketi gelmez.
//   - Ayarlar ekranı verisi: 2.1.0'da olmayan özelliklerin (POS, Ekstre) bölümleri ve kalemleri "available: false" (yarım özellik görünmez,
//     §12.1); hesap eşlemelerinde hesap adları (chart).
//   - Canlı yenileme: banka yazımı ANLIK DURUM ve açık pencereler için "overview.changed" (kinds: bank) yayımlar; istemcide bu ekrandaki banka
//     yazımı defter değişikliği sayılır (LEDGER_PATHS).
//   - Yönetim → İşlem Geçmişi: her banka işlem geçmişi türünün Türkçe adı var (admin.js EVENT_LABELS).
// NASIL BOZARIM:
//   - Personel: rozet, özet ve sihirbazı kapatma uçları 403; menü öğesi CSS ile gizli (yetki sınıfı kuralı).
//   - Sihirbazı kapatan yönetici; başka kullanıcı (muhasebe) ve başka şirket için kapanmış sayılmaz.
//   - Kilitli dönemdeki açılış: openingLocked true (Açılışı Düzelt ekranda pasif + neden).
//   - Tanınmayan kalem anahtarı yine 400 (açık yalnız bilinen menü adlarına).
//   - Ayarlar ekranında sayı alanı boş bırakılır: boş bırakılabilen (Kambiyo Vergisi Oranı) dışında 400 (önceden Number("") = 0 sessizce
//     kaydediliyordu: Tarih Toleransı boşken 0 gün oluyordu); ekran nullable bilgisini sunucudan alır.
//   - Hesap Detayı'nda başka hesabın satırı görünmez; Açılışı Düzelt'in ters kaydı ve yeni açılışı görünür (iz kaybolmaz).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import { apiOf } from "./banka-210-ortak.mjs";
import { createUser } from "./helpers.mjs";
import { BANK, bootBank, expectStatus, lockPeriod, must, openAcceptanceAccounts, openAccount } from "./banka-210-hesap-ortak.mjs";

const ROOT = new URL("../", import.meta.url);
const read = file => readFileSync(new URL(file, ROOT), "utf8");
const exists = file => {
  try {
    readFileSync(new URL(file, ROOT));
    return true;
  } catch {
    return false;
  }
};

describe("Aşama 3 (dilim 2) — Banka arayüzünün kaynak kuralları", () => {
  it("sol menü: Banka Taksitler'in hemen altında, bank.view ister, rozetli; tıklama HOF.bank.open'a gider", () => {
    const src = read("client/assets/hof-workspace.js");
    const block = src.slice(src.indexOf("const SIDE_ITEMS = ["), src.indexOf("];", src.indexOf("const SIDE_ITEMS = [")));
    const actions = [...block.matchAll(/\{\s*action:\s*"([^"]+)"/g)].map(match => match[1]);
    assert.ok(actions.includes("bank"), `menüde Banka yok (sıra: ${actions.join(", ")})`);
    assert.equal(actions[actions.indexOf("plans") + 1], "bank", `Banka Taksitler'in hemen altında olmalı (sıra: ${actions.join(", ")})`);
    const item = block.split("\n").find(line => /action:\s*"bank"/.test(line));
    assert.match(item, /key:\s*"side\.bank"/);
    assert.match(item, /label:\s*\(\)\s*=>\s*"Banka"/);
    assert.match(item, /requires:\s*"bank\.view"/);
    assert.match(item, /badge:\s*"warn"/);
    assert.match(src, /action === "bank"\)\s*HOF\.bank\?\.open\(/, "tıklama HOF.bank.open'a gitmeli");
    assert.match(src, /\/api\/workspace\/bank\/badge\?count=1/, "rozet sayısı banka rozet ucundan");
  });

  it("hof-bank.js yükleme sırası ve HOF.office kuralı; yetki sınıfı CSS kuralı", () => {
    assert.ok(exists("client/assets/hof-bank.js"), "client/assets/hof-bank.js yok");
    const html = read("client/index.html");
    const at = name => html.indexOf(`/assets/${name}`);
    assert.ok(at("hof-bank.js") > 0, "index.html hof-bank.js'i yüklemiyor");
    assert.ok(at("hof-bank.js") > at("hof-invoices.js") && at("hof-bank.js") > at("hof-cheques.js"), "hof-bank.js fatura ve çek betiklerinden sonra yüklenmeli");
    assert.ok(at("hof-bank.js") < at("hof-overview.js"), "hof-bank.js ANLIK DURUM'dan (hof-overview.js) önce yüklenmeli");
    const bank = read("client/assets/hof-bank.js");
    assert.doesNotMatch(bank, /HOF\.office\s*=[^=]/, "HOF.office hiçbir zaman = ile atanmaz (başka betiklerin alanlarını siler)");
    assert.match(bank, /HOF\.bank\s*=/);
    const css = read("client/assets/hof-ui.css");
    assert.ok(css.includes('html:not(.hof-can-bank-view) [data-requires="bank.view"]'), "bank.view yoksa menü öğesi CSS ile gizlenmeli");
  });

  it("canlı yenileme: istemcide banka yazımı defter değişikliği (LEDGER_PATHS); sunucuda ANLIK DURUM türleri bank'ı kapsar", () => {
    const core = read("client/assets/hof-core.js");
    const ledger = core.slice(core.indexOf("const LEDGER_PATHS = ["), core.indexOf("];", core.indexOf("const LEDGER_PATHS = [")));
    assert.match(ledger, /api\\\/workspace\\\/bank/, "LEDGER_PATHS'ta banka yolu yok");
    const overview = read("server/routes/overview.mjs");
    assert.match(overview, /OVERVIEW_KINDS = new Set\(\[[^\]]*"bank"/, "OVERVIEW_KINDS bank'ı kapsamalı");
  });

  it("Yönetim → İşlem Geçmişi: her banka işlem geçmişi türünün adı var (admin.js EVENT_LABELS)", () => {
    const types = new Set();
    for (const match of read("server/lib/bank/accounts.mjs").matchAll(/audit:\s*\{\s*type:\s*([^,]+),/g)) for (const name of match[1].matchAll(/"(bank\.[\w.]+)"/g)) types.add(name[1]);
    for (const match of read("server/routes/bank.mjs").matchAll(/audit\(user,\s*"(bank\.[\w.]+)"/g)) types.add(match[1]);
    assert.ok(types.size >= 10, `banka işlem geçmişi türleri bulunamadı (${[...types].join(", ")})`);
    const admin = read("client/assets/admin.js");
    const labels = admin.slice(admin.indexOf("const EVENT_LABELS = {"), admin.indexOf("};", admin.indexOf("const EVENT_LABELS = {")));
    const missing = [...types].filter(type => !labels.includes(`"${type}":`));
    assert.deepEqual(missing, [], `İşlem Geçmişi'nde adı olmayan banka türleri: ${missing.join(", ")}`);
  });
});

describe("Aşama 3 (dilim 2) — Banka arayüzünün sunucu uçları", () => {
  let ctx;
  let accounts;
  let personel;
  let muhasebe;
  before(async () => {
    ctx = await bootBank();
    accounts = await openAcceptanceAccounts(ctx.api);
    personel = apiOf(await createUser(ctx.server, ctx.api.client, { username: "personel1", role: "personel" }));
    muhasebe = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe1", role: "muhasebe" }));
  });
  after(() => ctx.server.close());

  it("kalemle ad: Banka, Fatura ve Raporlar adları kaydedilir; tanınmayan anahtar 400", async () => {
    const saved = await must("adlar", ctx.api.put("/api/workspace/labels/batch", { labels: { "side.bank": "Bankalar", "side.invoices": "Faturalar", "side.analytics": "Rapor Merkezi" } }));
    assert.equal(saved.labels["side.bank"], "Bankalar");
    assert.equal(saved.labels["side.invoices"], "Faturalar");
    assert.equal(saved.labels["side.analytics"], "Rapor Merkezi");
    assert.ok(saved.slots["side.bank"], "side.bank kalem listesinde");
    expectStatus(await ctx.api.put("/api/workspace/labels/batch", { labels: { "side.yok": "X" } }), 400, null, "tanınmayan anahtar");
    await must("varsayılana dön", ctx.api.put("/api/workspace/labels/batch", { labels: { "side.bank": "", "side.invoices": "", "side.analytics": "" } }));
  });

  it("rozet: Hesabı Belirsiz Yeni Hareketler sayısı; personel 403", async () => {
    const badge = await must("rozet", ctx.api.get(`${BANK}/badge?count=1`));
    assert.equal(typeof badge.count, "number");
    assert.equal(badge.count, 0, "yeni kurulumda hesabı belirsiz yeni hareket yok");
    ctx.store.setSetting("meta.bank.repair", JSON.stringify({ unassigned: 3 }));
    assert.equal((await must("rozet 3", ctx.api.get(`${BANK}/badge?count=1`))).count, 3);
    ctx.store.setSetting("meta.bank.repair", JSON.stringify({ unassigned: 0 }));
    expectStatus(await personel.get(`${BANK}/badge?count=1`), 403, null, "personel rozeti");
  });

  it("Kurulum Sihirbazı ilk girişte: kapatma kişi ve şirket bazında kaydedilir; personel 403", async () => {
    const first = await must("özet", ctx.api.get(`${BANK}/summary`));
    assert.equal(first.setup.dismissed, false, "yönetici sihirbazı henüz kapatmadı");
    await must("kapat", ctx.api.post(`${BANK}/setup/dismiss`, {}));
    assert.equal((await must("özet 2", ctx.api.get(`${BANK}/summary`))).setup.dismissed, true, "yönetici için kapandı");
    assert.equal((await must("muhasebe özeti", muhasebe.get(`${BANK}/summary`))).setup.dismissed, false, "muhasebe için kapanmadı");
    await must("ikinci kez kapat", ctx.api.post(`${BANK}/setup/dismiss`, {}));
    expectStatus(await personel.post(`${BANK}/setup/dismiss`, {}), 403, null, "personel");
    expectStatus(await personel.get(`${BANK}/summary`), 403, null, "personel özeti");
    // Başka şirket: aynı kişi için kapanmış sayılmaz (şirket verisi ayrı).
    const created = await ctx.api.client.post("/api/companies", { name: "İkinci Şirket" });
    assert.equal(created.status, 200, JSON.stringify(created.data).slice(0, 300));
    const other = created.data.data.company?.id || created.data.data.id;
    const second = await must("002 özeti", ctx.api.get(`${BANK}/summary?hofCompany=${encodeURIComponent(other)}`));
    assert.equal(second.setup.dismissed, false, "başka şirkette kapanmadı");
    assert.equal(second.realBank.defined, false, "boş şirkette Gerçek Banka tanımsız");
  });

  it("Hesap Detayı: son hareketler (açılış dahil, işaretli, açıklamalı), başka hesabın hareketi yok; kilitli açılış işaretli", async () => {
    const { ziraat, garanti } = accounts;
    const card = await must("hesap kartı", ctx.api.get(`${BANK}/accounts/${ziraat.id}`));
    assert.ok(Array.isArray(card.recent), "recent alanı yok");
    assert.equal(card.recent.length, 1, "yalnız açılış");
    const [line] = card.recent;
    assert.equal(line.signedMinor, 10_000_000);
    assert.equal(line.date, "2026-10-01");
    assert.match(line.description, /Açılış Bakiyesi/);
    assert.match(line.eventNo, /^BNK-2026-\d{6}$/);
    assert.equal(card.openingLocked, false);
    // Açılışı Düzelt: ters kayıt ve yeni açılış son hareketlerde; başka hesabınki gelmez.
    await must("Açılışı Düzelt", ctx.api.post(`${BANK}/accounts/${garanti.id}/opening`, { date: "2026-10-01", amount: "55.000", confirmed: true }));
    const garantiCard = await must("garanti kartı", ctx.api.get(`${BANK}/accounts/${garanti.id}`));
    assert.deepEqual(garantiCard.recent.map(item => item.signedMinor).sort((a, b) => a - b), [-5_000_000, 5_000_000, 5_500_000]);
    assert.equal((await must("ziraat yeniden", ctx.api.get(`${BANK}/accounts/${ziraat.id}`))).recent.length, 1, "Garanti'nin hareketi Ziraat'te görünmez");
    await must("Açılışı geri", ctx.api.post(`${BANK}/accounts/${garanti.id}/opening`, { date: "2026-10-01", amount: "50.000", confirmed: true }));
    await lockPeriod(ctx.api, "2026-10-02");
    try {
      assert.equal((await must("kilitli", ctx.api.get(`${BANK}/accounts/${ziraat.id}`))).openingLocked, true, "açılış kilitli dönemde");
      const fresh = await openAccount(ctx.api, { bankName: "Vakıfbank", name: "Ek Hesap", kind: "demand", opening: { date: "2026-10-05", amount: "0" } });
      assert.equal(fresh.openingLocked, false, "kilitten sonraki açılış açık");
    } finally {
      await lockPeriod(ctx.api, "");
    }
  });

  it("Ayarlar ekranı verisi: POS ve Ekstre 2.1.0'da görünmez (available false); hesap eşlemelerinde adlar", async () => {
    const settings = await must("ayarlar", ctx.api.get(`${BANK}/settings`));
    const section = id => settings.sections.find(item => item.id === id);
    for (const id of ["pos", "posAdvanced", "statement"]) assert.equal(section(id).available, false, `${id} bölümü 2.1.0'da görünmemeli`);
    for (const id of ["account", "negative", "similar", "fee", "fx", "gl", "other", "movement"]) assert.equal(section(id).available, true, `${id} bölümü görünmeli`);
    assert.equal(section("account").items.find(item => item.key === "defaultPosId").available, false, "Varsayılan POS görünmemeli");
    assert.equal(section("account").items.find(item => item.key === "defaultAccountId").available, true);
    assert.equal(section("holidayAdvanced").items.find(item => item.key === "shift").available, false, "Tatile Düşen Valör (POS) görünmemeli");
    assert.equal(settings.chart["770"], "Genel Giderler ve Alış Faturaları");
    assert.equal(settings.chart["653"], "Komisyon Giderleri");
    assert.equal(settings.chart["102"], "Bankalar (Havale / EFT)");
    assert.equal(section("fxAdvanced").items.find(item => item.key === "exchangeTaxPermille").nullable, true, "boş bırakılabilen alan ekrana bildirilir");
  });

  it("Ayarlar: boş sayı alanı yalnız boş bırakılabilen kalemde kabul edilir (sessizce 0 olmaz)", async () => {
    expectStatus(await ctx.api.put(`${BANK}/settings`, { values: { statement: { toleranceDays: "" } } }), 400, "bank-setting", "Tarih Toleransı boş");
    expectStatus(await ctx.api.put(`${BANK}/settings`, { values: { posAdvanced: { blockDays: null } } }), 400, "bank-setting", "Bloke Süresi null");
    assert.equal((await must("ayarlar", ctx.api.get(`${BANK}/settings`))).values.statement.toleranceDays, 3, "reddedilen istek değeri değiştirmez");
    const saved = await must("Kambiyo boş", ctx.api.put(`${BANK}/settings`, { values: { fxAdvanced: { exchangeTaxPermille: "" } } }));
    assert.equal(saved.values.fxAdvanced.exchangeTaxPermille, null);
    const two = await must("Kambiyo 2", ctx.api.put(`${BANK}/settings`, { values: { fxAdvanced: { exchangeTaxPermille: "2" } } }));
    assert.equal(two.values.fxAdvanced.exchangeTaxPermille, 2);
    await must("varsayılan", ctx.api.post(`${BANK}/settings/reset`, {}));
  });

  it("canlı yenileme: banka yazımı herkese overview.changed (kinds bank) yayımlar", async () => {
    const seen = [];
    const stop = ctx.app.context.events.tap((event, data) => event === "overview.changed" && seen.push(data));
    try {
      await openAccount(ctx.api, { bankName: "Halkbank", name: "Canlı Hesap", kind: "demand", opening: { date: "2026-10-05", amount: "1.000", confirmed: true } });
      const deadline = Date.now() + 3000;
      while (!seen.some(item => item.kinds?.includes("bank")) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
      assert.ok(seen.some(item => item.kinds?.includes("bank")), `overview.changed bank türüyle gelmedi (${JSON.stringify(seen)})`);
    } finally {
      stop();
    }
  });
});
