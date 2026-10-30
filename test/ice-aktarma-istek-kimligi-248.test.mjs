// 2.4.8 I1 — Excel / Google Sheets içe aktarmalarında kalıcı istek kimliği (cari, stok, taksit, çek / senet; lib/import-request.mjs).
// BULGU (2.4.7 çek ajanı; kullanıcı kararı B → 2.4.8): POST /api/workspace/{accounts,stock,plans,cheques}/import istek kimliği almıyordu. Yanıt kaybolunca
// (zaman aşımı, bağlantı kopması) eşleme penceresi açık kalır, kullanıcı yeniden basar: sunucuda zaten yazılmış yükleme İKİNCİ KEZ işlenir — Cari No'suz /
// telefonsuz cariler ve no'suz evrak yeniden açılır, açılış bakiyesi ve "Cariye işle"nin cari etkisi ikinci kez yazılır (mizan iki kat). Stok ve taksitte doğal
// anahtar (ad + birim, ad + grup) ikinci yazımı atlatıyordu ama yanıt "0 açıldı, N satır atlandı" diyerek ilk yüklemeyi gizliyordu.
// KURAL (öbür para uçlarıyla aynı düzen; plan §3.10/1): kimlik x-hof-request (ya da gövdede requestId); anahtar kullanıcı | kapsam | kimlik, şirketin veri
// tabanında (request_keys), yüklemenin işleminde; aynı kimlik + aynı içerik → yazım yok, ilk rapor (replayed: true); farklı içerik → 409 request-id-reused;
// yalnız başarılı yükleme kimlik bırakır; kimliksiz istek (eski istemci) bugünkü gibi; kapsamlar ayrı; kullanıcılar ve şirketler ayrı; yeniden başlatmada hatırlanır;
// yükleme yarıda kesilirse (süreç ölümü) ya hepsi ya hiç ve aynı kimlikle yeniden deneme bir kez işler.
// BAĞIMSIZ BEKLENEN: sayılar yükleme dosyasından elle (program kodundan değil): cari dosyası 3 cari, açılış 1.000 + 2.500,50 = 3.500,50 Borçlu (müşteri, artı
// tutar), 120 Alıcılar +3.500,50; çek dosyası 3 alınan evrak 1.000 + 500 + 250 = 1.750 → 101 Alınan Çekler +1.750, "Cariye işle" ile bağlanan carinin borcu
// 1.000 + 500 = 1.500 düşer (bir kez); stok dosyası 2 ürün, açılış 10 + 4 Adet; taksit dosyası 2 kart (6.000 / 6 ve 2.400 / 3).
// NASIL BOZULUR (testler buradan): yanıt kaybolur + yeniden gönderilir (sıralı ve aynı anda), gönderimler arasında eşleme / seçenek değişir, reddedilen (400)
// istek düzeltilip aynı kimlikle gönderilir, kimliksiz eski istemci, biçimsiz kimlik, aynı kimlik başka içe aktarmada / başka kullanıcıda / başka şirkette,
// kayıtlar silinip aynı kimlikle yeniden gönderim, sunucu yeniden başlatma, yükleme ortasında ve kimlik yazılırken süreç ölümü (SIGKILL).
// Kırmızı kanıt: eski kod (4bca574c, ayrı kopya) docs/kanit/2026-10-30/248-i1-*.
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, createClient, createUser, loginAdmin, startTestServer } from "./helpers.mjs";
import { apiOf, integrityOk, must, unwrap } from "./banka-210-ortak.mjs";
import { expectStatus, trialBalances } from "./banka-210-hesap-ortak.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const RID = suffix => `ithal-248-${suffix}-0123456789`;
const URL_OF = { accounts: "/api/workspace/accounts/import", cheques: "/api/workspace/cheques/import", stock: "/api/workspace/stock/import", plans: "/api/workspace/plans/import" };
const send = (client, kind, body, requestId) => client.post(URL_OF[kind], body, requestId ? { "x-hof-request": requestId } : undefined).then(unwrap);
const withoutReplay = report => {
  const { replayed, ...rest } = report || {};
  return rest;
};

// ---------- Yükleme dosyaları (tarayıcının gönderdiği gövde: hücre matrisi + eşleme) ----------
// Cari: Cari No ve telefon yok → eşleşme kuralı (aynı Cari No + ad ya da aynı ad + telefon) aynı satırı TANIYAMAZ; tekrar işlenirse yeni cari açılır.
const accountsBody = (prefix, extra = {}) => ({
  matrix: [["Ad Soyad", "Açılış Bakiyesi"], [`${prefix} Bir`, "1.000"], [`${prefix} İki`, "2.500,50"], [`${prefix} Üç`, ""]],
  headerAt: 0,
  roles: { 0: "name", 1: "balance" },
  type: "customer",
  mode: "skip",
  openingSide: "auto",
  fileName: `${prefix}-cariler.xlsx`,
  ...extra,
});
// Çek: seri no yok (no'lu satır "zaten kayıtlı" diye atlanır; no'suz satır yeniden açılır). İki satır var olan cariye bağlanır, biri tanınmaz.
const chequesBody = (drawer, extra = {}) => ({
  matrix: [["Keşideci", "Tutar", "Vade Tarihi", "Banka"], [drawer, "1.000", "31.12.2026", "Ziraat"], [drawer, "500", "30.11.2026", "Akbank"], [`${drawer} Tanınmayan`, "250", "15.12.2026", ""]],
  headerAt: 0,
  roles: { 0: "drawer", 1: "amount", 2: "due", 3: "bank" },
  direction: "in",
  instrument: "cheque",
  post: true,
  fileName: "cekler.xlsx",
  ...extra,
});
const stockBody = (prefix, extra = {}) => ({
  matrix: [["Ürün Adı", "Birim", "Miktar", "Alış Fiyatı"], [`${prefix} Raf`, "Adet", "10", "400"], [`${prefix} Masa`, "Adet", "4", "1.200"]],
  headerAt: 0,
  roles: { 0: "name", 1: "unit", 2: "qty", 3: "price" },
  unit: "Adet",
  mode: "skip",
  fileName: "stok.xlsx",
  ...extra,
});
const plansBody = (prefix, extra = {}) => ({
  matrix: [["Ad Soyad", "Telefon", "Toplam Tutar", "Taksit Sayısı", "İlk Vade"], [`${prefix} Hakan`, "0539 111 00 11", "6.000", "6", "01.11.2026"], [`${prefix} İpek`, "0539 222 00 22", "2.400", "3", "15.11.2026"]],
  headerAt: 0,
  roles: { 0: "name", 1: "phone", 2: "total", 3: "count", 4: "firstDue" },
  linkRecords: false,
  fileName: "taksit.xlsx",
  ...extra,
});

const like = value => `${value}%`;
/** Veri tabanından okunan sayılar (yanıta değil, kayda bakılır — ders 3). */
const counts = (store, prefix) => ({
  accounts: store.get("SELECT COUNT(*) AS n FROM accounts WHERE deleted_at IS NULL AND name LIKE ?", like(prefix)).n,
  openings: store.get("SELECT COUNT(*) AS n FROM account_entries e JOIN accounts a ON a.id = e.account_id WHERE a.name LIKE ? AND e.is_opening = 1", like(prefix)).n,
  cheques: store.get("SELECT COUNT(*) AS n FROM cheques WHERE deleted_at IS NULL AND drawer LIKE ?", like(prefix)).n,
  chequeEntries: store.get("SELECT COUNT(*) AS n FROM account_entries e JOIN accounts a ON a.id = e.account_id WHERE a.name LIKE ? AND e.source = 'cheque'", like(prefix)).n,
  items: store.get("SELECT COUNT(*) AS n FROM stock_items WHERE deleted_at IS NULL AND name LIKE ?", like(prefix)).n,
  stockOpenings: store.get("SELECT COUNT(*) AS n FROM stock_moves m JOIN stock_items i ON i.id = m.item_id WHERE i.name LIKE ? AND m.is_opening = 1", like(prefix)).n,
  plans: store.get("SELECT COUNT(*) AS n FROM plans WHERE deleted_at IS NULL AND name LIKE ?", like(prefix)).n,
});
const balanceOf = async (api, prefix) => {
  const list = await must("cari listesi", api.get(`/api/workspace/accounts?status=all&limit=500&q=${encodeURIComponent(prefix)}`));
  return Math.round(list.accounts.filter(item => item.name.startsWith(prefix)).reduce((sum, item) => sum + item.balance, 0) * 100) / 100;
};
const ledgerOf = async api => {
  const ledger = await must("mizan", api.get("/api/workspace/ledger"));
  return { tb: Object.fromEntries(ledger.trial.accounts.map(row => [row.code, row.balance])), debit: ledger.trial.totals.debit, entries: ledger.entryCount };
};
const keysOf = (store, requestId) => store.all("SELECT key, scope FROM request_keys WHERE key LIKE ?", `%|${requestId}`);

describe("2.4.8 I1 içe aktarma istek kimliği (tek sunucu)", () => {
  const ctx = {};
  let n = 0;
  const customer = async name => must(`müşteri ${name}`, ctx.api.post("/api/workspace/accounts", { name, type: "customer", registeredOn: "2026-09-01" }));
  before(async () => {
    ctx.server = await startTestServer({ now: NOW });
    ctx.client = await loginAdmin(ctx.server);
    ctx.api = apiOf(ctx.client);
    ctx.store = () => ctx.server.app.store;
  });
  after(() => ctx.server?.close());

  it("Cari: aynı kimlik + aynı dosya (yanıt kayboldu, yeniden basıldı) → 3 cari, açılış bakiyesi bir kez (cari + 120 + yevmiye); ikinci yanıt ilk rapor (replayed)", async () => {
    const prefix = `Kimlik Cari ${++n}`;
    const l0 = await ledgerOf(ctx.api);
    const first = await send(ctx.client, "accounts", accountsBody(prefix), RID("cari-a"));
    expectStatus(first, 200, "", "ilk yükleme");
    assert.notEqual(first.data.replayed, true, "ilk yükleme yeni");
    assert.equal(first.data.created, 3);
    assert.equal(first.data.balances, 2);
    const l1 = await ledgerOf(ctx.api);
    const second = await send(ctx.client, "accounts", accountsBody(prefix), RID("cari-a"));
    expectStatus(second, 200, "", "yeniden gönderim");
    const c = counts(ctx.store(), prefix);
    assert.equal(c.accounts, 3, `aynı istek ikinci yüklemede yeni cari açtı: ${c.accounts} cari (beklenen 3)`);
    assert.equal(c.openings, 2, `açılış bakiyesi ${c.openings} kez yazıldı (beklenen 2 satır)`);
    assert.equal(await balanceOf(ctx.api, prefix), 3500.5, "cari bakiyeleri toplamı 3.500,50 Borçlu (bir kez)");
    const l2 = await ledgerOf(ctx.api);
    assert.equal(Math.round(((l1.tb["120"] ?? 0) - (l0.tb["120"] ?? 0)) * 100) / 100, 3500.5, "120 Alıcılar ilk yüklemede +3.500,50");
    assert.deepEqual(l2, l1, "yeniden gönderimden sonra mizan ve yevmiye ilk yüklemeyle aynı");
    assert.equal(second.data.replayed, true, "ikinci yanıt replayed işaretli");
    assert.deepEqual(withoutReplay(second.data), withoutReplay(first.data), "ikinci yanıt ilk yüklemenin raporu");
    const keys = keysOf(ctx.store(), RID("cari-a"));
    assert.equal(keys.length, 1, "tek kimlik kaydı");
    assert.equal(keys[0].scope, "account.import");
    assert.equal(ctx.store().get("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'account.imported' AND payload_json LIKE ?", `%${prefix}-cariler.xlsx%`).n, 1, "işlem geçmişinde tek yükleme");
    // Gövdedeki requestId de aynı kimliktir.
    const viaBody = await send(ctx.client, "accounts", { ...accountsBody(prefix), requestId: RID("cari-a") });
    expectStatus(viaBody, 200, "", "gövdede kimlik");
    assert.equal(viaBody.data.replayed, true, "gövdedeki requestId de aynı kimlik");
    assert.equal(counts(ctx.store(), prefix).accounts, 3);
    await integrityOk(ctx.api, "cari yüklemesi");
  });

  it("Çek / Senet (Cariye işle): aynı kimlik + aynı dosya → 3 evrak, carinin borcu bir kez 1.500 düşer, 101 +1.750 bir kez; ikinci yanıt ilk rapor", async () => {
    const acc = await customer(`Kimlik Keşideci ${++n}`);
    const l0 = await ledgerOf(ctx.api);
    const first = await send(ctx.client, "cheques", chequesBody(acc.name), RID("cek-a"));
    expectStatus(first, 200, "", "ilk yükleme");
    assert.equal(first.data.created, 3);
    assert.equal(first.data.posted, 2);
    const l1 = await ledgerOf(ctx.api);
    const second = await send(ctx.client, "cheques", chequesBody(acc.name), RID("cek-a"));
    expectStatus(second, 200, "", "yeniden gönderim");
    const c = counts(ctx.store(), acc.name);
    assert.equal(c.cheques, 3, `aynı istek ikinci yüklemede yeni evrak açtı: ${c.cheques} evrak (beklenen 3)`);
    assert.equal(c.chequeEntries, 2, `"Cariye işle" cari etkisi ${c.chequeEntries} kez yazıldı (beklenen 2 satır)`);
    const card = await must("cari kartı", ctx.api.get(`/api/workspace/accounts/${acc.id}`));
    assert.equal(card.totals.balance, -1500, `carinin borcu bir kez 1.500 düşmeli (bakiye ${card.totals.balance})`);
    assert.equal(Math.round(((l1.tb["101"] ?? 0) - (l0.tb["101"] ?? 0)) * 100) / 100, 1750, "101 Alınan Çekler ilk yüklemede +1.750");
    assert.deepEqual(await ledgerOf(ctx.api), l1, "yeniden gönderimden sonra mizan ve yevmiye ilk yüklemeyle aynı");
    assert.equal(second.data.replayed, true);
    assert.deepEqual(withoutReplay(second.data), withoutReplay(first.data));
    assert.equal(keysOf(ctx.store(), RID("cek-a"))[0]?.scope, "cheque.import");
    await integrityOk(ctx.api, "çek yüklemesi");
  });

  it("Stok: aynı kimlik + aynı dosya → 2 ürün, açılış stoku bir kez; ikinci yanıt ilk yüklemenin bildirimi (önceden '0 ürün açıldı, 2 satır atlandı')", async () => {
    const prefix = `Kimlik Stok ${++n}`;
    const first = await send(ctx.client, "stock", stockBody(prefix), RID("stok-a"));
    expectStatus(first, 200, "", "ilk yükleme");
    assert.equal(first.data.created, 2);
    assert.match(first.data.message, /^2 ürün açıldı, 2 ürüne açılış stoku yazıldı\./);
    const second = await send(ctx.client, "stock", stockBody(prefix), RID("stok-a"));
    expectStatus(second, 200, "", "yeniden gönderim");
    const c = counts(ctx.store(), prefix);
    assert.equal(c.items, 2, `ürün sayısı ${c.items} (beklenen 2)`);
    assert.equal(c.stockOpenings, 2, `açılış stoku ${c.stockOpenings} kez (beklenen 2 hareket)`);
    assert.equal(second.data.replayed, true, `ikinci yanıt ilk yüklemeyi göstermeli; gelen: "${second.data.message}" (created ${second.data.created}, atlanan ${second.data.skippedTotal})`);
    assert.deepEqual(withoutReplay(second.data), withoutReplay(first.data));
    assert.equal(keysOf(ctx.store(), RID("stok-a"))[0]?.scope, "stock.import");
  });

  it("Taksit: aynı kimlik + aynı dosya → 2 kart, tek aktarım kaydı (Geri Al aynı); ikinci yanıt ilk rapor (önceden '0 kart, 2 satır atlandı')", async () => {
    const prefix = `Kimlik Taksit ${++n}`;
    const first = await send(ctx.client, "plans", plansBody(prefix), RID("taksit-a"));
    expectStatus(first, 200, "", "ilk yükleme");
    assert.equal(first.data.created, 2);
    assert.ok(first.data.importId, "aktarım kimliği");
    const second = await send(ctx.client, "plans", plansBody(prefix), RID("taksit-a"));
    expectStatus(second, 200, "", "yeniden gönderim");
    assert.equal(counts(ctx.store(), prefix).plans, 2, "iki kart");
    assert.equal(ctx.store().get("SELECT COUNT(*) AS n FROM plan_imports WHERE id = ?", first.data.importId).n, 1, "tek aktarım kaydı");
    assert.equal(second.data.replayed, true, `ikinci yanıt ilk yüklemeyi göstermeli; gelen: created ${second.data.created}, atlanan ${second.data.skipped?.length} (${second.data.skipped?.[0]?.reason || ""})`);
    assert.equal(second.data.importId, first.data.importId, "Geri Al aynı aktarımı gösterir");
    assert.deepEqual(withoutReplay(second.data), withoutReplay(first.data));
    assert.equal(keysOf(ctx.store(), RID("taksit-a"))[0]?.scope, "plan.import");
  });

  it("aynı anda iki kopya (aynı kimlik, Promise.all) → cari ve çek bir kez; biri yeni, öbürü replayed", async () => {
    const prefix = `Yarış Cari ${++n}`;
    const [x, y] = await Promise.all([send(ctx.client, "accounts", accountsBody(prefix), RID("yaris-cari")), send(ctx.client, "accounts", accountsBody(prefix), RID("yaris-cari"))]);
    expectStatus(x, 200, "", "x");
    expectStatus(y, 200, "", "y");
    assert.equal(counts(ctx.store(), prefix).accounts, 3, `aynı anda iki kopya ${counts(ctx.store(), prefix).accounts} cari açtı`);
    assert.equal([x.data.replayed, y.data.replayed].filter(Boolean).length, 1, "biri yeni, öbürü replayed");
    const acc = await customer(`Yarış Keşideci ${++n}`);
    const [a, b] = await Promise.all([send(ctx.client, "cheques", chequesBody(acc.name), RID("yaris-cek")), send(ctx.client, "cheques", chequesBody(acc.name), RID("yaris-cek"))]);
    expectStatus(a, 200, "", "a");
    expectStatus(b, 200, "", "b");
    assert.equal(counts(ctx.store(), acc.name).cheques, 3, "tek yükleme");
    assert.equal((await must("kart", ctx.api.get(`/api/workspace/accounts/${acc.id}`))).totals.balance, -1500, "cari bir kez");
    assert.equal([a.data.replayed, b.data.replayed].filter(Boolean).length, 1);
  });

  it("taksit: işlemden önceki bekleme (tablo dizini; bağlı Sheets'in ilk eşitlemesi) iki kopyayı iç içe geçirir → yine tek yükleme, biri replayed (denetim işlemin içinde)", async () => {
    // Ön koşul zorla kurulur (ders 20): dataset.view yavaşlatılır, iki istek de beklemeye girer (en çok eşzamanlı = 2 görülmeden sonuç sayılmaz).
    const dataset = ctx.server.app.context.dataset;
    const original = dataset.view;
    let inside = 0;
    let most = 0;
    dataset.view = async (...args) => {
      inside += 1;
      most = Math.max(most, inside);
      try {
        await sleep(400);
        return await original.apply(dataset, args);
      } finally {
        inside -= 1;
      }
    };
    try {
      const prefix = `Yarış Taksit ${++n}`;
      const [p, q] = await Promise.all([send(ctx.client, "plans", plansBody(prefix, { linkRecords: true }), RID("yaris-taksit")), send(ctx.client, "plans", plansBody(prefix, { linkRecords: true }), RID("yaris-taksit"))]);
      assert.equal(most, 2, `ön koşul: iki kopya aynı anda beklemede olmalı (en çok ${most})`);
      expectStatus(p, 200, "", "p");
      expectStatus(q, 200, "", "q");
      assert.equal(counts(ctx.store(), prefix).plans, 2, "tek yükleme");
      assert.equal([p.data.replayed, q.data.replayed].filter(Boolean).length, 1, `biri yeni, öbürü replayed (created ${p.data.created} / ${q.data.created})`);
      assert.equal(p.data.importId, q.data.importId, "iki yanıt aynı aktarımı gösterir");
    } finally {
      dataset.view = original;
    }
  });

  // Dar kontrol I1 ORTA-1: yanıt kaybolduktan sonra seçenek değiştirilip yeniden basılınca 409 iletisi ilk yüklemenin ÖNCEKİ seçeneklerle kaydedildiğini sayılarıyla
  // söyler ve dosyanın yeniden yüklenmesine YÖNLENDİRMEZ (önceden "pencereyi kapatıp dosyayı yeniden seçin" deniyordu; yeni pencere yeni kimlik → cari 3 → 6).
  // 409 gövdesinde ilk raporun yalnız özet sayıları (first); satır listeleri ve ham rapor (refId) yok.
  it("aynı kimlik + farklı içerik (seçenek ya da eşleme değişti) → 409 request-id-reused, hiçbir şey yazılmaz; ileti ilk yüklemenin sayılarını söyler, yeniden yüklemeye yönlendirmez", async () => {
    const acc = await customer(`Farklı Gövde ${++n}`);
    expectStatus(await send(ctx.client, "cheques", chequesBody(acc.name), RID("farkli-cek")), 200, "", "ilk");
    const before_ = counts(ctx.store(), acc.name);
    const changed = await send(ctx.client, "cheques", chequesBody(acc.name, { post: false }), RID("farkli-cek"));
    expectStatus(changed, 409, "request-id-reused", "Cariye işle kaldırılıp aynı kimlikle");
    assert.equal(changed.error, "İlk yükleme (önceki seçeneklerle) kaydedildi: 3 evrak portföye alındı, 2 cari hareketi yazıldı; ikinci kez yazılmadı. Çek / Senet listesini kontrol edin. Dosyayı yeniden yüklerseniz numarasız evrak ikinci kez açılır (“Bağlanan carilere de işle” seçiliyse cari etkisi de); değişikliği evrak kartlarında yapın. Cariye işlenmeden açılan evrak sonradan cariye işlenmez; gerekiyorsa bu yüklemede açılan evrakı listeden silip dosyayı bu seçenek işaretli yeniden yükleyin.", `çek 409 iletisi: "${changed.error}"`);
    assert.doesNotMatch(changed.error, /dosyayı yeniden seçin/, "ileti dosyanın yeniden yüklenmesine yönlendirmez");
    assert.deepEqual(changed.data?.first, { created: 3, linked: 2, posted: 2, skippedTotal: 0 }, "409 gövdesinde ilk yüklemenin özet sayıları");
    assert.equal(changed.data?.refId, undefined, "409 içinde ilk yüklemenin ham raporu yok");
    assert.equal(changed.data?.skipped, undefined, "409 içinde satır listesi yok");
    assert.deepEqual(counts(ctx.store(), acc.name), before_, "yeni evrak / cari satırı yok");
    const prefix = `Farklı Cari ${++n}`;
    expectStatus(await send(ctx.client, "accounts", accountsBody(prefix), RID("farkli-cari")), 200, "", "ilk cari");
    const remapped = await send(ctx.client, "accounts", accountsBody(prefix, { roles: { 0: "name" } }), RID("farkli-cari"));
    expectStatus(remapped, 409, "request-id-reused", "eşleme değişti");
    assert.equal(remapped.error, "İlk yükleme (önceki seçeneklerle) kaydedildi: 3 cari açıldı, 2 açılış bakiyesi yazıldı; ikinci kez yazılmadı. Cari listesini kontrol edin. Dosyayı yeniden yüklerseniz Cari No'suz ya da telefonsuz satırlar ikinci kez açılır; değişikliği cari kartlarında yapın.", `cari 409 iletisi: "${remapped.error}"`);
    assert.deepEqual(remapped.data?.first, { created: 3, updated: 0, balances: 2 }, "cari 409 özeti (atlanan yoksa skippedTotal alanı raporda yok)");
    expectStatus(await send(ctx.client, "accounts", accountsBody(prefix, { matrix: [...accountsBody(prefix).matrix, [`${prefix} Dört`, "10"]] }), RID("farkli-cari")), 409, "request-id-reused", "dosya değişti");
    assert.equal(counts(ctx.store(), prefix).accounts, 3);
    const sprefix = `Farklı Stok ${++n}`;
    expectStatus(await send(ctx.client, "stock", stockBody(sprefix), RID("farkli-stok")), 200, "", "ilk stok");
    const restocked = await send(ctx.client, "stock", stockBody(sprefix, { mode: "update" }), RID("farkli-stok"));
    expectStatus(restocked, 409, "request-id-reused", "stok seçenek");
    assert.equal(restocked.error, "İlk yükleme (önceki seçeneklerle) kaydedildi: 2 ürün açıldı, 2 ürüne açılış stoku yazıldı; ikinci kez yazılmadı. Ürün listesini kontrol edin. Dosyayı yeniden yüklerseniz birim ya da ad eşlemesi değiştiyse ürünler ve açılış stoku ikinci kez yazılır; değişikliği ürün kartlarında yapın.", `stok 409 iletisi: "${restocked.error}"`);
    assert.deepEqual(restocked.data?.first, { created: 2, updated: 0, opening: 2, skippedTotal: 0 });
    const pprefix = `Farklı Taksit ${++n}`;
    const planFirst = await send(ctx.client, "plans", plansBody(pprefix), RID("farkli-taksit"));
    expectStatus(planFirst, 200, "", "ilk taksit");
    const regrouped = await send(ctx.client, "plans", plansBody(pprefix, { groupName: "Başka Grup" }), RID("farkli-taksit"));
    expectStatus(regrouped, 409, "request-id-reused", "taksit seçenek");
    assert.equal(regrouped.error, "İlk yükleme (önceki seçeneklerle) kaydedildi: 2 kart oluşturuldu; ikinci kez yazılmadı. Taksitler listesini kontrol edin. Dosyayı başka seçenekle yeniden yüklerseniz kartlar ikinci kez açılabilir; değişikliği kartlarda yapın ya da önce Son Aktarımlar’dan geri alın.", `taksit 409 iletisi: "${regrouped.error}"`);
    assert.deepEqual(regrouped.data?.first, { created: 2, importId: planFirst.data.importId }, "taksit 409 özeti Geri Al'ın aktarımını gösterir");
    assert.equal(counts(ctx.store(), pprefix).plans, 2);
  });

  // Dar kontrol 2 (I1): çek 409 iletisinin "cariye işlenmeden açılan evrak sonradan cariye işlenmez; bu yüklemede açılan evrakı silip seçenek işaretli
  // yeniden yükleyin" önerisi izlenince çift evrak ya da çift cari etkisi doğmaz (silinen evrak tekrar denetiminde sayılmaz). Beklenen dosyadan: 3 evrak,
  // bağlanan carinin 2 evrakı (1.000 + 500) → 2 cari hareketi; Tanınmayan keşidecinin evrakı cariye işlenmez.
  it("çek 409 önerisi izlenir: cariye işlenmemiş yükleme silinip “Bağlanan carilere de işle” ile yeniden yüklenince 3 evrak, 2 cari hareketi (bir kez)", async () => {
    const acc = await customer(`Öneri Çek ${++n}`);
    const first = await send(ctx.client, "cheques", chequesBody(acc.name, { post: false }), RID("oneri-cek-1"));
    expectStatus(first, 200, "", "ilk yükleme (cariye işlenmeden)");
    assert.deepEqual([counts(ctx.store(), acc.name).cheques, counts(ctx.store(), acc.name).chequeEntries], [3, 0], "ilk yükleme: 3 evrak, cari hareketi yok");
    expectStatus(await send(ctx.client, "cheques", chequesBody(acc.name), RID("oneri-cek-1")), 409, "request-id-reused", "seçenek işaretlenip aynı kimlikle");
    const ids = ctx.store().all("SELECT id FROM cheques WHERE deleted_at IS NULL AND drawer LIKE ?", `${acc.name}%`).map(row => row.id);
    for (const id of ids) assert.equal((await ctx.client.del(`/api/workspace/cheques/${id}`)).status, 200, `evrak ${id} silinemedi`);
    const again = await send(ctx.client, "cheques", chequesBody(acc.name), RID("oneri-cek-2"));
    expectStatus(again, 200, "", "seçenek işaretli yeniden yükleme (yeni pencere, yeni kimlik)");
    assert.equal(again.data?.created, 3, "yeniden yüklemede 3 evrak açıldı (silinenler tekrar sayılmadı)");
    const c = counts(ctx.store(), acc.name);
    assert.deepEqual([c.cheques, c.chequeEntries], [3, 2], `öneri izlenince çift yazım: ${JSON.stringify(c)}`);
  });

  it("aynı kimlik başka içe aktarmada ayrı kapsamdır (cari yüklemesinin kimliği çek yüklemesini engellemez, sonucu sızmaz)", async () => {
    const prefix = `Kapsam ${++n}`;
    const id = RID("kapsam");
    expectStatus(await send(ctx.client, "accounts", accountsBody(prefix), id), 200, "", "cari");
    const cheque = await send(ctx.client, "cheques", chequesBody(`${prefix} Bir`), id);
    expectStatus(cheque, 200, "", "aynı kimlikle çek yüklemesi");
    assert.notEqual(cheque.data.replayed, true, "çek yüklemesi yeni (cari yüklemesinin raporu dönmez)");
    assert.equal(cheque.data.created, 3);
    const stock = await send(ctx.client, "stock", stockBody(prefix), id);
    expectStatus(stock, 200, "", "aynı kimlikle stok");
    assert.equal(stock.data.created, 2);
    const plan = await send(ctx.client, "plans", plansBody(prefix), id);
    expectStatus(plan, 200, "", "aynı kimlikle taksit");
    assert.equal(plan.data.created, 2);
    assert.deepEqual(keysOf(ctx.store(), id).map(row => row.scope).sort(), ["account.import", "cheque.import", "plan.import", "stock.import"], "her içe aktarmanın kendi kapsamında kimlik kaydı");
  });

  it("kimliksiz istek (eski istemci) bugünkü gibi işlenir: aynı dosya iki kez → no'suz / telefonsuz satırlar yeniden açılır (koruma yalnız kimlikli istemcide)", async () => {
    const prefix = `Kimliksiz ${++n}`;
    expectStatus(await send(ctx.client, "accounts", accountsBody(prefix)), 200, "", "kimliksiz 1");
    expectStatus(await send(ctx.client, "accounts", accountsBody(prefix)), 200, "", "kimliksiz 2");
    assert.equal(counts(ctx.store(), prefix).accounts, 6, "kimliksiz iki istek iki yükleme (2.0.19 kuralı: emin olunamayan satır yeni cari açar)");
    const acc = await customer(`Kimliksiz Keşideci ${++n}`);
    expectStatus(await send(ctx.client, "cheques", chequesBody(acc.name)), 200, "", "kimliksiz çek 1");
    expectStatus(await send(ctx.client, "cheques", chequesBody(acc.name)), 200, "", "kimliksiz çek 2");
    assert.equal(counts(ctx.store(), acc.name).cheques, 6);
    // Yeni pencere = yeni kimlik: aynı dosyanın bilerek ikinci yüklenişi de bugünkü kuraldadır.
    const fresh = `Yeni Pencere ${++n}`;
    expectStatus(await send(ctx.client, "accounts", accountsBody(fresh), RID("pencere-1")), 200, "", "pencere 1");
    expectStatus(await send(ctx.client, "accounts", accountsBody(fresh), RID("pencere-2")), 200, "", "pencere 2");
    assert.equal(counts(ctx.store(), fresh).accounts, 6, "iki ayrı pencere iki yükleme");
    assert.equal(ctx.store().get("SELECT COUNT(*) AS n FROM request_keys WHERE key LIKE ?", `%|${prefix}%`).n, 0);
  });

  it("biçimsiz kimlik → 400 request-id-invalid, yazım yok; reddedilen istek (400 'Tutar kolonunu seçin') kimlik bırakmaz, düzeltilip aynı kimlikle kaydedilir", async () => {
    const prefix = `Biçimsiz ${++n}`;
    expectStatus(await send(ctx.client, "accounts", accountsBody(prefix), "kisa"), 400, "request-id-invalid", "16 karakterden kısa");
    expectStatus(await send(ctx.client, "stock", { ...stockBody(prefix), requestId: "kötü kimlik; DROP TABLE request_keys" }), 400, "request-id-invalid", "izinsiz karakter (gövdede)");
    assert.equal(counts(ctx.store(), prefix).accounts + counts(ctx.store(), prefix).items, 0);
    const acc = await customer(`Reddedilen ${++n}`);
    const rejected = await send(ctx.client, "cheques", chequesBody(acc.name, { roles: { 0: "drawer", 2: "due", 3: "bank" } }), RID("red"));
    expectStatus(rejected, 400, "", "tutar kolonu seçilmemiş");
    assert.equal(keysOf(ctx.store(), RID("red")).length, 0, "reddedilen istek kimlik bırakmaz");
    const fixed = await send(ctx.client, "cheques", chequesBody(acc.name), RID("red"));
    expectStatus(fixed, 200, "", "düzeltilmiş eşleme, aynı kimlik");
    assert.notEqual(fixed.data.replayed, true);
    assert.equal(counts(ctx.store(), acc.name).cheques, 3);
  });

  it("kayıtlar silindikten sonra aynı kimlikle yeniden gönderim yeniden açmaz (ilk rapor döner; silinen geri gelmez)", async () => {
    const acc = await customer(`Silinen ${++n}`);
    const first = await send(ctx.client, "cheques", chequesBody(acc.name), RID("silinen"));
    expectStatus(first, 200, "", "ilk");
    for (const row of ctx.store().all("SELECT id FROM cheques WHERE drawer LIKE ? AND deleted_at IS NULL", like(acc.name))) await must("evrak sil", ctx.api.del(`/api/workspace/cheques/${row.id}`));
    assert.equal(counts(ctx.store(), acc.name).cheques, 0);
    const again = await send(ctx.client, "cheques", chequesBody(acc.name), RID("silinen"));
    expectStatus(again, 200, "", "aynı kimlikle yeniden");
    assert.equal(again.data.replayed, true, `silinen yüklemenin kimliği yeniden işlendi: ${again.data.created} evrak yeniden açıldı (${counts(ctx.store(), acc.name).cheques} etkin evrak)`);
    assert.equal(counts(ctx.store(), acc.name).cheques, 0, "silinen evrak yeniden açılmadı");
    assert.equal((await must("kart", ctx.api.get(`/api/workspace/accounts/${acc.id}`))).totals.balance, 0, "cari etkisi geri alındı ve yeniden yazılmadı");
  });

  it("başka kullanıcının aynı kimliği ayrıdır (sonuç sızmaz)", async () => {
    const other = await createUser(ctx.server, ctx.client, { username: "ithal248muhasebe", role: "muhasebe" });
    const prefix = `İki Kullanıcı ${++n}`;
    expectStatus(await send(ctx.client, "stock", stockBody(prefix), RID("kullanici")), 200, "", "benim");
    const theirs = await send(other, "stock", stockBody(`${prefix} Öbür`), RID("kullanici"));
    expectStatus(theirs, 200, "", "öbür kullanıcı");
    assert.notEqual(theirs.data.replayed, true);
    assert.equal(theirs.data.created, 2);
  });
});

describe("2.4.8 I1 içe aktarma istek kimliği: yeniden başlatma ve şirketler", () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "ithal-248-"));
  const ctx = {};
  const boot = async () => {
    ctx.server = await startTestServer({ dataDir, now: NOW });
    ctx.client = await loginAdmin(ctx.server);
    ctx.api = apiOf(ctx.client);
  };
  before(boot);
  after(async () => {
    await ctx.server?.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("sunucu yeniden başlasa da aynı kimlik → ilk rapor, farklı içerik → 409; iki şirket ayrı (001'in kimliği 002'de yeni yükleme)", async () => {
    const first = await send(ctx.client, "accounts", accountsBody("Yeniden Başlatma"), RID("restart"));
    expectStatus(first, 200, "", "ilk");
    await ctx.server.close();
    await boot();
    const again = await send(ctx.client, "accounts", accountsBody("Yeniden Başlatma"), RID("restart"));
    expectStatus(again, 200, "", "yeniden başlatmadan sonra");
    assert.equal(again.data.replayed, true, `yeniden başlatmadan sonra aynı istek yeniden işlendi: ${again.data.created} cari açıldı (${counts(ctx.server.app.store, "Yeniden Başlatma").accounts} cari)`);
    expectStatus(await send(ctx.client, "accounts", accountsBody("Yeniden Başlatma", { type: "supplier" }), RID("restart")), 409, "request-id-reused", "farklı gövde");
    assert.equal(counts(ctx.server.app.store, "Yeniden Başlatma").accounts, 3);
    const created = await must("002", ctx.api.post("/api/companies", { code: "002", name: "İthal İkinci Şirket" }));
    const companyB = created.company?.id || created.id;
    // Dar kontrol I1 DÜŞÜK-2: şirketin sayısı o şirketin API'sinden (?hofCompany=) okunur; app.store istek dışında 001'i okur.
    const inCompany = async company => (await must(`cari listesi ${company}`, ctx.api.get(`/api/workspace/accounts?status=all&limit=50&q=${encodeURIComponent("Yeniden Başlatma")}&hofCompany=${encodeURIComponent(company)}`))).accounts.filter(item => item.name.startsWith("Yeniden Başlatma")).length;
    assert.equal(await inCompany("sirket-001"), 3, "001'de 3 cari");
    assert.equal(await inCompany(companyB), 0, "002 boş başlar");
    await must("002 seç", ctx.api.post("/api/companies/select", { id: companyB }));
    try {
      const inB = await send(ctx.client, "accounts", accountsBody("Yeniden Başlatma"), RID("restart"));
      expectStatus(inB, 200, "", "002");
      assert.notEqual(inB.data.replayed, true, "002'de yeni yükleme (001'in sonucu sızmaz)");
      assert.equal(inB.data.created, 3);
      const againB = await send(ctx.client, "accounts", accountsBody("Yeniden Başlatma"), RID("restart"));
      expectStatus(againB, 200, "", "002 yeniden");
      assert.equal(againB.data.replayed, true, `002'de aynı istek yeniden işlendi: ${againB.data.created} cari açıldı`);
      assert.equal(await inCompany(companyB), 3, "002'de tek yükleme (002'nin API'sinden)");
    } finally {
      await must("001 seç", ctx.api.post("/api/companies/select", { id: "sirket-001" }));
    }
    assert.equal(await inCompany("sirket-001"), 3, "001'de tek yükleme (001'in API'sinden)");
    await integrityOk(ctx.api, "001");
  });
});

// ---------- Süreç ölümü (SIGKILL = elektrik kesintisi) ----------
// banka-210-post-kesinti-cocuk.mjs: uygulamayı verilen veri klasöründe açar, verilen tabloya verilen koşulla satır yazılacağı anda (yüklemenin işleminin ortası,
// COMMIT'ten önce) süreci dondurur, işaret dosyası bırakır; ebeveyn SIGKILL gönderir.
const CHILD = path.join(path.dirname(fileURLToPath(import.meta.url)), "banka-210-post-kesinti-cocuk.mjs");
const DEAD_LICENSE_URL = "http://127.0.0.1:9";
const pad = value => String(value).padStart(2, "0");
const d = new Date();
const TODAY = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
async function crashDuring(root, { table, when, prepare, act }) {
  const dataDir = path.join(root, "data");
  const marker = path.join(root, `donduruldu-${Date.now()}`);
  const child = fork(CHILD, [dataDir, path.join(root, "backups"), marker, ADMIN_PASSWORD, table, when], { stdio: ["ignore", "ignore", "pipe", "ipc"], execArgv: ["--disable-warning=ExperimentalWarning"], env: { ...process.env, HUKUK_LICENSE_URL: DEAD_LICENSE_URL } });
  let stderr = "";
  child.stderr.on("data", chunk => (stderr += chunk));
  const exited = new Promise(resolve => child.once("exit", resolve));
  const { port } = await new Promise((resolve, reject) => {
    child.once("message", resolve);
    child.once("exit", code => reject(new Error(`çocuk süreç açılmadı (${code}): ${stderr.slice(0, 500)}`)));
  });
  // Çocuk her durumda öldürülür (dondurma noktasına ulaşılmasa da: eski kodda kimlik kaydı hiç yazılmaz, süreç açık kalıp koşuyu asmasın).
  let reached = false;
  let prepared = null;
  let pending = null;
  try {
    const client = createClient(`http://127.0.0.1:${port}`);
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    prepared = prepare ? await prepare(client) : null;
    pending = act(client, prepared).catch(() => null);
    for (let i = 0; i < 400 && !existsSync(marker); i += 1) await sleep(25);
    reached = existsSync(marker);
  } finally {
    child.kill("SIGKILL");
    await exited;
    await pending;
  }
  assert.ok(reached, `yükleme dondurma noktasına (${table}: ${when}) ulaşmalı`);
  return { dataDir, prepared };
}

describe("2.4.8 I1 içe aktarma ortasında SIGKILL: satırlar, cari / yevmiye etkisi, işlem geçmişi ve kimlik kaydı ya birlikte ya hiç", () => {
  const roots = [];
  after(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })));
  const zero = (store, prefix, label) => {
    const c = counts(store, prefix);
    assert.equal(c.cheques + c.chequeEntries + c.openings, 0, `${label}: yarım yükleme kaldı ${JSON.stringify(c)}`);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM request_keys").n, 0, `${label}: kimlik kaydı kaldı`);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM audit_events WHERE type IN ('cheque.imported', 'account.imported')").n, 0, `${label}: işlem geçmişi kaldı`);
  };

  for (const point of [
    { name: "üçüncü evrak yazılırken (ortada)", table: "cheques", when: "NEW.amount = 250" },
    { name: "kimlik kaydı yazılırken (en son yazım)", table: "request_keys", when: "NEW.scope = 'cheque.import'" },
  ]) {
    it(`çek yüklemesi (Cariye işle), ${point.name} kesinti → hiçbir parça yok; aynı kimlikle yeniden deneme bir kez işler, bir daha replayed`, async () => {
      const root = mkdtempSync(path.join(tmpdir(), "ithal-248-kesinti-"));
      roots.push(root);
      const drawer = "Kesinti Keşidecisi";
      const { dataDir, prepared } = await crashDuring(root, {
        table: point.table,
        when: point.when,
        prepare: async client => unwrap(await client.post("/api/workspace/accounts", { name: drawer, type: "customer", registeredOn: TODAY })).data,
        act: client => send(client, "cheques", chequesBody(drawer), RID("kesinti-cek")),
      });
      const server = await startTestServer({ dataDir });
      try {
        const store = server.app.store;
        zero(store, drawer, point.name);
        const client = server.client();
        await client.login("admin", ADMIN_PASSWORD);
        const api = apiOf(client);
        const l0 = await ledgerOf(api);
        const retry = await send(client, "cheques", chequesBody(drawer), RID("kesinti-cek"));
        expectStatus(retry, 200, "", "yeniden deneme");
        assert.notEqual(retry.data.replayed, true, "kesintide kimlik yazılmamıştı: yeniden deneme işler");
        assert.equal(retry.data.created, 3);
        const again = await send(client, "cheques", chequesBody(drawer), RID("kesinti-cek"));
        assert.equal(again.data.replayed, true, `yeniden denemenin tekrarı ikinci kez işlendi: ${again.data.created} evrak daha (${counts(store, drawer).cheques} evrak)`);
        const c = counts(store, drawer);
        assert.equal(c.cheques, 3, "tek yükleme");
        assert.equal(c.chequeEntries, 2);
        assert.equal((await must("kart", api.get(`/api/workspace/accounts/${prepared.id}`))).totals.balance, -1500, "cari bir kez");
        const l1 = await ledgerOf(api);
        assert.equal(Math.round(((l1.tb["101"] ?? 0) - (l0.tb["101"] ?? 0)) * 100) / 100, 1750, "101 bir kez +1.750");
        assert.equal(server.app.integrity.run().ok, true);
      } finally {
        await server.close();
      }
    });
  }

  it("cari yüklemesi (açılış bakiyeli), kimlik kaydı yazılırken kesinti → cari, açılış, yevmiye, kimlik yok; aynı kimlikle yeniden deneme bir kez işler", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ithal-248-kesinti-"));
    roots.push(root);
    const prefix = "Kesinti Cari";
    const { dataDir } = await crashDuring(root, {
      table: "request_keys",
      when: "NEW.scope = 'account.import'",
      act: client => send(client, "accounts", accountsBody(prefix), RID("kesinti-cari")),
    });
    const server = await startTestServer({ dataDir });
    try {
      const store = server.app.store;
      assert.equal(counts(store, prefix).accounts, 0, "cari yok");
      zero(store, prefix, "cari kesintisi");
      const client = server.client();
      await client.login("admin", ADMIN_PASSWORD);
      const api = apiOf(client);
      const retry = await send(client, "accounts", accountsBody(prefix), RID("kesinti-cari"));
      expectStatus(retry, 200, "", "yeniden deneme");
      assert.equal(retry.data.created, 3);
      const twice = await send(client, "accounts", accountsBody(prefix), RID("kesinti-cari"));
      assert.equal(twice.data.replayed, true, `yeniden denemenin tekrarı ikinci kez işlendi: ${twice.data.created} cari daha`);
      assert.equal(counts(store, prefix).accounts, 3);
      assert.equal(counts(store, prefix).openings, 2);
      assert.equal(await balanceOf(api, prefix), 3500.5);
      assert.equal((await trialBalances(api))["120"], 3500.5, "120 Alıcılar bir kez");
      assert.equal(server.app.integrity.run().ok, true);
    } finally {
      await server.close();
    }
  });
});
